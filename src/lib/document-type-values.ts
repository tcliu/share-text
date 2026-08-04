export const DOCUMENT_TYPE_VALUES = ['text', 'json', 'markdown', 'csv', 'yaml'] as const

export type DocumentTypeValue = (typeof DOCUMENT_TYPE_VALUES)[number]

export function isDocumentTypeValue(value: unknown): value is DocumentTypeValue {
  return DOCUMENT_TYPE_VALUES.includes(value as DocumentTypeValue)
}
