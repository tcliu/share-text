let yamlModulePromise: Promise<typeof import('yaml')> | null = null

function loadYaml() {
  if (!yamlModulePromise) {
    yamlModulePromise = import('yaml').catch(error => {
      yamlModulePromise = null
      throw error
    })
  }
  return yamlModulePromise
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateJson(text: string): ValidationResult {
  try {
    JSON.parse(text)
    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    }
  }
}

export async function validateYaml(text: string): Promise<ValidationResult> {
  try {
    const { parse } = await loadYaml()
    parse(text)
    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid YAML',
    }
  }
}

export function formatJson(text: string, indent: number): { ok: boolean; value?: string; error?: string } {
  try {
    const parsed = JSON.parse(text)
    return { ok: true, value: JSON.stringify(parsed, null, indent) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    }
  }
}

export async function formatYaml(text: string, indent = 2): Promise<{ ok: boolean; value?: string; error?: string }> {
  if (text.trim() === '') {
    return { ok: true, value: '' }
  }
  try {
    const { parse, stringify } = await loadYaml()
    const parsed = parse(text)
    return { ok: true, value: stringify(parsed, { indent, lineWidth: 0 }) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid YAML',
    }
  }
}

export interface StructuredParseResult {
  ok: boolean
  value?: unknown
  error?: string
}

export async function parseStructured(text: string): Promise<StructuredParseResult> {
  const trimmed = text.trim()
  if (trimmed === '') {
    return { ok: true, value: undefined }
  }
  if (trimmed.startsWith('<')) {
    return parseXmlStructure(text)
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) }
  } catch {
    // not JSON; fall back to YAML
  }
  try {
    const { parse } = await loadYaml()
    const value = parse(trimmed)
    return { ok: true, value }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid content',
    }
  }
}

export interface XmlElementNode {
  tag: string
  attributes: Record<string, string>
  children: XmlScalar | XmlChildNode[]
}

export type XmlScalar = string | number | boolean | null

export type XmlChildNode = XmlScalar | XmlElementNode

const ELEMENT_NODE = 1
const TEXT_NODE = 3
const CDATA_SECTION_NODE = 4

function xmlElementToNode(el: Element): XmlElementNode {
  const attributes: Record<string, string> = {}
  for (const attr of Array.from(el.attributes)) {
    attributes[attr.name] = attr.value
  }
  const nodes: XmlChildNode[] = []
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === ELEMENT_NODE) {
      nodes.push(xmlElementToNode(child as Element))
    } else if (child.nodeType === TEXT_NODE || child.nodeType === CDATA_SECTION_NODE) {
      const text = child.textContent ?? ''
      if (text.trim() !== '') {
        nodes.push(text)
      }
    }
  }
  const children: string | XmlChildNode[] =
    nodes.length === 0
      ? ''
      : nodes.length === 1 && typeof nodes[0] === 'string'
        ? nodes[0]
        : nodes
  return { tag: el.tagName, attributes, children }
}

export function parseXmlStructure(text: string): StructuredParseResult {
  const { error, doc } = parseXmlDom(text)
  if (error) {
    return { ok: false, error }
  }
  const root = doc!.documentElement
  if (!root) {
    return { ok: true, value: undefined }
  }
  return { ok: true, value: xmlElementToNode(root) }
}

const XML_ELEMENT_NAME_RE = /^[A-Za-z_][A-Za-z0-9_.:-]*$/

function escapeXmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeXmlAttribute(text: string): string {
  return escapeXmlText(text).replace(/"/g, '&quot;')
}

function isXmlElementNode(value: unknown): value is XmlElementNode {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const node = value as Record<string, unknown>
  return (
    typeof node.tag === 'string' &&
    node.attributes !== null &&
    typeof node.attributes === 'object' &&
    !Array.isArray(node.attributes) &&
    (isXmlScalar(node.children) || Array.isArray(node.children))
  )
}

function isXmlScalar(value: unknown): value is XmlScalar {
  return value === null || typeof value !== 'object'
}

function escapeXmlChild(child: XmlScalar): string {
  if (typeof child === 'string') return escapeXmlText(child)
  if (child === null) return 'null'
  return escapeXmlText(String(child))
}

function xmlAttributesToString(node: XmlElementNode): string | null {
  let result = ''
  for (const [name, value] of Object.entries(node.attributes)) {
    if (!XML_ELEMENT_NAME_RE.test(name)) {
      return null
    }
    result += ` ${name}="${escapeXmlAttribute(String(value))}"`
  }
  return result
}

function serializeXmlInline(node: XmlElementNode): string | null {
  if (!XML_ELEMENT_NAME_RE.test(node.tag)) {
    return null
  }
  const attrs = xmlAttributesToString(node)
  if (attrs === null) {
    return null
  }
  const open = `<${node.tag}${attrs}`
  const children = node.children
  if (isXmlScalar(children)) {
    return children === '' && typeof children === 'string'
      ? `${open} />`
      : `${open}>${escapeXmlChild(children)}</${node.tag}>`
  }
  if (children.length === 0) {
    return `${open} />`
  }
  let inner = ''
  for (const child of children) {
    if (isXmlScalar(child)) {
      inner += escapeXmlChild(child)
    } else {
      const serialized = serializeXmlInline(child)
      if (serialized === null) {
        return null
      }
      inner += serialized
    }
  }
  return `${open}>${inner}</${node.tag}>`
}

function serializeXmlElement(node: XmlElementNode, indent: string, depth: number): string | null {
  if (!XML_ELEMENT_NAME_RE.test(node.tag)) {
    return null
  }
  const attrs = xmlAttributesToString(node)
  if (attrs === null) {
    return null
  }
  const open = indent.repeat(depth) + `<${node.tag}${attrs}`
  const children = node.children
  if (isXmlScalar(children)) {
    return children === '' && typeof children === 'string'
      ? `${open} />`
      : `${open}>${escapeXmlChild(children)}</${node.tag}>`
  }
  if (children.length === 0) {
    return `${open} />`
  }
  if (children.some(child => isXmlScalar(child))) {
    const parts: string[] = []
    for (const child of children) {
      if (isXmlScalar(child)) {
        parts.push(escapeXmlChild(child))
      } else {
        const serialized = serializeXmlInline(child)
        if (serialized === null) {
          return null
        }
        parts.push(serialized)
      }
    }
    return `${open}>${parts.join('')}</${node.tag}>`
  }
  const parts: string[] = []
  for (const child of children as XmlElementNode[]) {
    const serialized = serializeXmlElement(child, indent, depth + 1)
    if (serialized === null) {
      return null
    }
    parts.push(serialized)
  }
  return `${open}>\n${parts.join('\n')}\n${indent.repeat(depth)}</${node.tag}>`
}

export function serializeXmlStructure(value: unknown): string | null {
  if (!isXmlElementNode(value)) {
    return null
  }
  return serializeXmlElement(value, '  ', 0)
}

export async function convertJsonToYaml(
  text: string,
  indent = 2,
): Promise<{ ok: boolean; value?: string; error?: string }> {
  try {
    const { stringify } = await loadYaml()
    const parsed = JSON.parse(text)
    return { ok: true, value: stringify(parsed, { indent, lineWidth: 0 }) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    }
  }
}

export async function convertYamlToJson(
  text: string,
  indent = 2,
): Promise<{ ok: boolean; value?: string; error?: string }> {
  if (text.trim() === '') {
    return { ok: true, value: '' }
  }
  try {
    const { parse } = await loadYaml()
    const parsed = parse(text)
    return { ok: true, value: JSON.stringify(parsed, null, indent) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid YAML',
    }
  }
}

function parseXmlDom(text: string): { error?: string; doc?: Document } {
  if (typeof DOMParser === 'undefined') {
    return { error: 'XML parsing is not available' }
  }
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const parserError = doc.querySelector('parsererror')
  if (parserError) {
    return { error: (parserError.textContent ?? 'Invalid XML').trim() }
  }
  return { doc }
}

function parseXml(text: string): { error?: string } {
  return parseXmlDom(text)
}

export function validateXml(text: string): ValidationResult {
  if (text.trim() === '') {
    return { valid: true }
  }
  const { error } = parseXml(text)
  return error ? { valid: false, error } : { valid: true }
}

const MARKUP_VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

const MARKUP_RAW_BLOCK_TAGS = ['script', 'style', 'pre', 'textarea']

function tokenizeMarkup(text: string, html: boolean): string[] {
  const rawBlocks = html
    ? '<script\\b[^>]*>[\\s\\S]*?<\\/script\\s*>|<style\\b[^>]*>[\\s\\S]*?<\\/style\\s*>|<pre\\b[^>]*>[\\s\\S]*?<\\/pre\\s*>|<textarea\\b[^>]*>[\\s\\S]*?<\\/textarea\\s*>|'
    : ''
  const re = new RegExp(
    `(<!--[\\s\\S]*?-->|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>|<!DOCTYPE[\\s\\S]*?>|<\\?[\\s\\S]*?\\?>|${rawBlocks}<[^>]+>|[^<]+)`,
    'gi',
  )
  return text.match(re) ?? []
}

function formatMarkup(
  text: string,
  indent: number,
  html: boolean,
): { ok: boolean; value?: string; error?: string } {
  if (text.trim() === '') {
    return { ok: true, value: '' }
  }
  if (!html) {
    const { error } = parseXml(text)
    if (error) {
      return { ok: false, error }
    }
  }
  const pad = ' '.repeat(indent)
  const lines: string[] = []
  let depth = 0
  for (const token of tokenizeMarkup(text, html)) {
    if (token.startsWith('<!--') || token.startsWith('<![CDATA[')) {
      lines.push(pad.repeat(depth) + token)
      continue
    }
    if (token.startsWith('<!DOCTYPE') || token.startsWith('<?')) {
      lines.push(pad.repeat(depth) + token)
      continue
    }
    const rawOpen = token.match(/^<(script|style|pre|textarea)\b[^>]*>/i)
    if (rawOpen) {
      const closeStart = token.lastIndexOf('</')
      const openEnd = token.indexOf('>') + 1
      if (closeStart > openEnd) {
        lines.push(pad.repeat(depth) + token.slice(0, openEnd))
        const inner = token
          .slice(openEnd, closeStart)
          .replace(/^\r?\n/, '')
          .replace(/\r?\n$/, '')
        for (const line of inner.split(/\r?\n/)) {
          lines.push(pad.repeat(depth) + line)
        }
        lines.push(pad.repeat(depth) + token.slice(closeStart))
        continue
      }
    }
    if (token.startsWith('</')) {
      depth = Math.max(0, depth - 1)
      lines.push(pad.repeat(depth) + token)
      continue
    }
    if (token.startsWith('<')) {
      const name = token.match(/^<([\w:-]+)/)?.[1]?.toLowerCase()
      const isSelfClosing = token.endsWith('/>') || (html && name !== undefined && MARKUP_VOID_TAGS.has(name))
      lines.push(pad.repeat(depth) + token)
      if (!isSelfClosing && name !== undefined) {
        depth += 1
      }
      continue
    }
    const collapsed = token.replace(/\s+/g, ' ').trim()
    if (collapsed !== '') {
      lines.push(pad.repeat(depth) + collapsed)
    }
  }
  return { ok: true, value: lines.join('\n') }
}

export function formatHtml(text: string, indent = 2): { ok: boolean; value?: string; error?: string } {
  return formatMarkup(text, indent, true)
}

export function formatXml(text: string, indent = 2): { ok: boolean; value?: string; error?: string } {
  return formatMarkup(text, indent, false)
}
