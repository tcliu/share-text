export interface ValidationResult {
  valid: boolean
  error?: string
}

export interface StructuredParseResult {
  ok: boolean
  value?: unknown
  error?: string
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
    nodes.length === 0 ? '' : nodes.length === 1 && typeof nodes[0] === 'string' ? nodes[0] : nodes
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

export function parseXmlDom(text: string): { error?: string; doc?: Document } {
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

export function parseXml(text: string): { error?: string } {
  return parseXmlDom(text)
}

export function validateXml(text: string): ValidationResult {
  if (text.trim() === '') {
    return { valid: true }
  }
  const { error } = parseXml(text)
  return error ? { valid: false, error } : { valid: true }
}
