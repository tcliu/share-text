import { parseXmlStructure, type StructuredParseResult, type ValidationResult } from './xml-utils'

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

export type { StructuredParseResult, ValidationResult } from './xml-utils'

// The XML, properties, and markup surfaces moved to focused sibling modules;
// re-exported here so existing importers keep reaching them through
// `$lib/document-type-utils`.
export {
  parseXmlDom,
  parseXml,
  parseXmlStructure,
  serializeXmlStructure,
  validateXml,
  type XmlChildNode,
  type XmlElementNode,
  type XmlScalar,
} from './xml-utils'

export {
  convertPropertiesToJson,
  formatProperties,
  parseProperties,
  serializeProperties,
  validateProperties,
  type PropertiesParseResult,
} from './properties-utils'

export { formatHtml, formatXml } from './markup-format'

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
