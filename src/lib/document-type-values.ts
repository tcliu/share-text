export const DOCUMENT_TYPE_VALUES = ['text', 'csv', 'html', 'javascript', 'json', 'markdown', 'xml', 'yaml'] as const

export type DocumentTypeValue = (typeof DOCUMENT_TYPE_VALUES)[number]

export function isDocumentTypeValue(value: unknown): value is DocumentTypeValue {
  return DOCUMENT_TYPE_VALUES.includes(value as DocumentTypeValue)
}
