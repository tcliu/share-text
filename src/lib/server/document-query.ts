export const ADMIN_SORT_COLUMNS: Record<string, string> = {
  id: 'key',
  name: 'name',
  documentType: 'document_type',
  length: 'content_size',
  createdBy: 'created_by',
  updatedBy: 'updated_by',
  updatedAt: 'updated_at',
}

export const DOCUMENT_SEARCH_COLUMNS: Record<string, string> = {
  id: 'key',
  name: 'name',
  documentType: 'document_type',
  tags: 'tags',
  updatedBy: 'updated_by',
}

export const ADMIN_SEARCH_COLUMNS: Record<string, string> = {
  ...DOCUMENT_SEARCH_COLUMNS,
  createdBy: 'created_by',
}

export const DOCUMENT_SEARCH_KEYS = Object.keys(DOCUMENT_SEARCH_COLUMNS)
