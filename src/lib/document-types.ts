import type { Component } from 'svelte'
import type { Extension } from '@codemirror/state'
import {
  convertJsonToYaml,
  convertYamlToJson,
  formatHtml,
  formatJson,
  formatXml,
  formatYaml,
  validateCsv,
  validateJson,
  validateXml,
  validateYaml,
} from './document-type-utils'
import { DOCUMENT_TYPE_VALUES, isDocumentTypeValue, type DocumentTypeValue } from './document-type-values'

export interface ValidationResult {
  valid: boolean
  error?: string
}

export interface ConversionResult {
  ok: boolean
  value?: string
  error?: string
}

export interface ConversionSpec {
  target: DocumentTypeValue
  targetLabel: string
  convert: (text: string, indent: number) => Promise<ConversionResult>
}

export interface FormatSpec {
  title: string
  hasIndent: boolean
  format: (text: string, indent: number) => Promise<ConversionResult>
}

export interface TypeActionsProps {
  type: DocumentTypeDefinition
  content: string
  onContentChange: (value: string) => void
  onTypeChange: (type: string) => void
}

export interface PreviewProps {
  content: string
}

export interface DocumentTypeDefinition {
  value: DocumentTypeValue
  label: string
  extension: string
  mimeType: string
  chipColor: string
  editorLanguage: () => Promise<Extension | null>
  validate: (text: string) => Promise<ValidationResult>
  format?: FormatSpec
  convertTo?: ConversionSpec
  actions?: () => Promise<Component<TypeActionsProps>>
  preview?: () => Promise<Component<PreviewProps>>
}

export const DOCUMENT_TYPES: DocumentTypeDefinition[] = [
  {
    value: 'text',
    label: 'Text',
    extension: 'txt',
    mimeType: 'text/plain',
    chipColor: '#94A3B8',
    editorLanguage: async () => null,
    validate: async () => ({ valid: true }),
  },
  {
    value: 'csv',
    label: 'CSV',
    extension: 'csv',
    mimeType: 'text/csv',
    chipColor: '#55A6FF',
    editorLanguage: async () => null,
    validate: async text => validateCsv(text),
  },
  {
    value: 'html',
    label: 'HTML',
    extension: 'html',
    mimeType: 'text/html',
    chipColor: '#FF8800',
    editorLanguage: () => import('@codemirror/lang-html').then(m => m.html()),
    validate: async () => ({ valid: true }),
    format: {
      title: 'Format HTML',
      hasIndent: true,
      format: (text, indent) => Promise.resolve(formatHtml(text, indent)),
    },
    actions: () => import('./components/TypeActions.svelte').then(m => m.default),
    preview: () => import('./components/HtmlPreview.svelte').then(m => m.default),
  },
  {
    value: 'javascript',
    label: 'JavaScript',
    extension: 'js',
    mimeType: 'text/javascript',
    chipColor: '#FFE600',
    editorLanguage: () => import('@codemirror/lang-javascript').then(m => m.javascript()),
    validate: async () => ({ valid: true }),
  },
  {
    value: 'json',
    label: 'JSON',
    extension: 'json',
    mimeType: 'application/json',
    chipColor: '#00F0FF',
    editorLanguage: () => import('@codemirror/lang-json').then(m => m.json()),
    validate: async text => validateJson(text),
    format: {
      title: 'Format JSON',
      hasIndent: true,
      format: (text, indent) => Promise.resolve(formatJson(text, indent)),
    },
    convertTo: { target: 'yaml', targetLabel: 'YAML', convert: convertJsonToYaml },
    actions: () => import('./components/TypeActions.svelte').then(m => m.default),
  },
  {
    value: 'markdown',
    label: 'Markdown',
    extension: 'md',
    mimeType: 'text/plain',
    chipColor: '#55FF55',
    editorLanguage: () => import('@codemirror/lang-markdown').then(m => m.markdown()),
    validate: async () => ({ valid: true }),
    preview: () => import('./components/MarkdownPreview.svelte').then(m => m.default),
  },
  {
    value: 'xml',
    label: 'XML',
    extension: 'xml',
    mimeType: 'text/xml',
    chipColor: '#D466FF',
    editorLanguage: () => import('@codemirror/lang-xml').then(m => m.xml()),
    validate: async text => validateXml(text),
    format: {
      title: 'Format XML',
      hasIndent: true,
      format: (text, indent) => Promise.resolve(formatXml(text, indent)),
    },
    actions: () => import('./components/TypeActions.svelte').then(m => m.default),
  },
  {
    value: 'yaml',
    label: 'YAML',
    extension: 'yml',
    mimeType: 'text/plain',
    chipColor: '#FF33CC',
    editorLanguage: () => import('@codemirror/lang-yaml').then(m => m.yaml()),
    validate: async text => validateYaml(text),
    format: {
      title: 'Format YAML',
      hasIndent: true,
      format: (text, indent) => formatYaml(text, indent),
    },
    convertTo: { target: 'json', targetLabel: 'JSON', convert: convertYamlToJson },
    actions: () => import('./components/TypeActions.svelte').then(m => m.default),
  },
]

const DOCUMENT_TYPE_BY_VALUE = new Map<string, DocumentTypeDefinition>(DOCUMENT_TYPES.map(type => [type.value, type]))

export function getDocumentType(value: string): DocumentTypeDefinition {
  return DOCUMENT_TYPE_BY_VALUE.get(value) ?? DOCUMENT_TYPES[0]
}

export { DOCUMENT_TYPE_VALUES, isDocumentTypeValue }
export type { DocumentTypeValue }
