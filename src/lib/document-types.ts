import type { Component } from 'svelte'
import type { Extension } from '@codemirror/state'
import {
  convertJsonToYaml,
  convertYamlToJson,
  formatJson,
  formatYaml,
  validateCsv,
  validateJson,
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

export interface DocumentTypeDefinition {
  value: DocumentTypeValue
  label: string
  extension: string
  mimeType: string
  editorLanguage: () => Promise<Extension | null>
  validate: (text: string) => Promise<ValidationResult>
  format?: FormatSpec
  convertTo?: ConversionSpec
  actions?: () => Promise<Component<TypeActionsProps>>
}

export const DOCUMENT_TYPES: DocumentTypeDefinition[] = [
  {
    value: 'text',
    label: 'Text',
    extension: 'txt',
    mimeType: 'text/plain',
    editorLanguage: async () => null,
    validate: async () => ({ valid: true }),
  },
  {
    value: 'json',
    label: 'JSON',
    extension: 'json',
    mimeType: 'application/json',
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
    editorLanguage: () => import('@codemirror/lang-markdown').then(m => m.markdown()),
    validate: async () => ({ valid: true }),
  },
  {
    value: 'csv',
    label: 'CSV',
    extension: 'csv',
    mimeType: 'text/csv',
    editorLanguage: async () => null,
    validate: async text => validateCsv(text),
  },
  {
    value: 'yaml',
    label: 'YAML',
    extension: 'yml',
    mimeType: 'text/plain',
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
