export type PropertySource = 'database' | 'environment' | 'default'
export type PropertyKind = 'number' | 'string' | 'boolean' | 'cron'

export interface NumberPropertyDefinition {
  key: string
  labelKey: string
  descriptionKey: string
  envKey: string
  tags: string[]
  kind: 'number'
  defaultValue: number
  min: number
  // No `max` means unbounded above.
  max?: number
}

export interface StringPropertyDefinition {
  key: string
  labelKey: string
  descriptionKey: string
  envKey: string
  tags: string[]
  kind: 'string'
  defaultValue: string
  masked?: boolean
}

export interface BooleanPropertyDefinition {
  key: string
  labelKey: string
  descriptionKey: string
  envKey: string
  tags: string[]
  kind: 'boolean'
  defaultValue: boolean
}

export interface CronPropertyDefinition {
  key: string
  labelKey: string
  descriptionKey: string
  envKey: string
  tags: string[]
  kind: 'cron'
  defaultValue: string
}

export type PropertyDefinition =
  NumberPropertyDefinition | StringPropertyDefinition | BooleanPropertyDefinition | CronPropertyDefinition

export interface AdminProperty {
  key: string
  labelKey: string
  descriptionKey: string
  envKey: string
  tags: string[]
  kind: PropertyKind
  defaultValue: number | string | boolean
  min?: number
  max?: number
  masked?: boolean
  value: number | string | boolean
  source: PropertySource
}

// Tunables: database overrides environment, environment overrides default.
// Number bounds are inclusive and enforced on read (out-of-range db/env values
// fall through) and on write (writes reject them). String values are
// validated as non-empty when present. Cron values must parse.
export const PROPERTY_DEFINITIONS: PropertyDefinition[] = [
  {
    key: 'app_active',
    labelKey: 'setting.app_active',
    descriptionKey: 'setting.app_activeDescription',
    envKey: 'APP_ACTIVE',
    tags: ['app'],
    kind: 'boolean',
    defaultValue: true,
  },
  {
    key: 'document_key_length',
    labelKey: 'setting.document_key_length',
    descriptionKey: 'setting.document_key_lengthDescription',
    envKey: 'DOCUMENT_KEY_LENGTH',
    tags: ['documents'],
    kind: 'number',
    defaultValue: 6,
    min: 4,
    max: 32,
  },
  {
    key: 'max_content_length',
    labelKey: 'setting.max_content_length',
    descriptionKey: 'setting.max_content_lengthDescription',
    envKey: 'MAX_CONTENT_LENGTH',
    tags: ['documents'],
    kind: 'number',
    defaultValue: 1024 * 1024,
    min: 1,
    max: 1024 * 1024,
  },
  {
    key: 'max_document_versions',
    labelKey: 'setting.max_document_versions',
    descriptionKey: 'setting.max_document_versionsDescription',
    envKey: 'MAX_DOCUMENT_VERSIONS',
    tags: ['documents'],
    kind: 'number',
    defaultValue: 20,
    min: 1,
    max: 100,
  },
  {
    key: 'max_documents_per_ip',
    labelKey: 'setting.max_documents_per_ip',
    descriptionKey: 'setting.max_documents_per_ipDescription',
    envKey: 'MAX_DOCUMENTS_PER_IP',
    tags: ['documents'],
    kind: 'number',
    defaultValue: 10,
    min: 1,
    max: 1000,
  },
]

export function getDefinition(key: string): PropertyDefinition | undefined {
  return PROPERTY_DEFINITIONS.find(definition => definition.key === key)
}
