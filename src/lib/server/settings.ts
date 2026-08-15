import { getDb } from './db'

export type SettingKind = 'number' | 'string'

export interface SettingDefinition {
  key: string
  label: string
  description: string
  kind: SettingKind
  defaultValue: number | string
  envKey: string
  min?: number
  max?: number
}

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: 'max_documents_per_ip',
    label: 'Max documents per IP',
    description: 'Maximum number of documents a single client IP can create.',
    kind: 'number',
    defaultValue: 10,
    envKey: 'MAX_DOCUMENTS_PER_IP',
    min: 1,
    max: 1000,
  },
  {
    key: 'max_content_length',
    label: 'Max content length (chars)',
    description:
      'Maximum number of characters allowed in document content. Also subject to the hard 1 MiB UTF-8 byte cap.',
    kind: 'number',
    defaultValue: 1024 * 1024,
    envKey: 'MAX_CONTENT_LENGTH',
    min: 1,
    max: 1024 * 1024,
  },
  {
    key: 'document_key_length',
    label: 'Document key length (chars)',
    description:
      'Number of characters in generated document ids. New documents are named after their id. Existing documents keep their original ids.',
    kind: 'number',
    defaultValue: 6,
    envKey: 'DOCUMENT_KEY_LENGTH',
    min: 4,
    max: 32,
  },
  {
    key: 'max_document_versions',
    label: 'Max document versions',
    description:
      'Maximum number of content versions kept per document. Older versions beyond this count are pruned on save.',
    kind: 'number',
    defaultValue: 20,
    envKey: 'MAX_DOCUMENT_VERSIONS',
    min: 1,
    max: 100,
  },
  {
    key: 'tts_service_url',
    label: 'TTS service URL',
    description:
      'Base URL of the external text-to-speech service used by the Read aloud feature. Empty disables the feature.',
    kind: 'string',
    defaultValue: '',
    envKey: 'TTS_SERVICE_URL',
  },
]

export type SettingSource = 'database' | 'environment' | 'default'

export interface ResolvedSetting extends SettingDefinition {
  value: number | string
  source: SettingSource
}

interface SettingRow {
  key: string
  value: string
}

function getSettingDefinition(key: string) {
  return SETTING_DEFINITIONS.find(item => item.key === key)
}

function readNumber(value: string | undefined): number | null {
  if (value === undefined) {
    return null
  }
  const parsed = Number(value.trim())
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function isWithinRange(value: number, definition: SettingDefinition) {
  return (
    definition.min !== undefined &&
    definition.max !== undefined &&
    value >= definition.min &&
    value <= definition.max
  )
}

export function resolveSettingSource(definition: SettingDefinition, dbValue: string | null): SettingSource {
  if (definition.kind === 'string') {
    if (dbValue !== null) {
      return 'database'
    }
    if ((process.env[definition.envKey] ?? '').trim() !== '') {
      return 'environment'
    }
    return 'default'
  }
  if (dbValue !== null && isWithinRange(readNumber(dbValue) ?? Number.NaN, definition)) {
    return 'database'
  }
  if (isWithinRange(readNumber(process.env[definition.envKey]) ?? Number.NaN, definition)) {
    return 'environment'
  }
  return 'default'
}

export function getEffectiveSettingValue(definition: SettingDefinition, dbValue: string | null) {
  if (definition.kind === 'string') {
    if (dbValue !== null) {
      return dbValue
    }
    const envValue = (process.env[definition.envKey] ?? '').trim()
    return envValue !== '' ? envValue : definition.defaultValue
  }
  const envValue = readNumber(process.env[definition.envKey])
  if (dbValue !== null) {
    const stored = readNumber(dbValue)
    if (stored !== null && isWithinRange(stored, definition)) {
      return stored
    }
  }
  return envValue !== null && isWithinRange(envValue, definition) ? envValue : definition.defaultValue
}

export async function getSettingValue(key: string): Promise<number> {
  const value = await getResolvedSettingValue(key)
  if (typeof value !== 'number') {
    throw new Error(`Setting ${key} is not numeric`)
  }
  return value
}

export async function getSettingStringValue(key: string): Promise<string> {
  const value = await getResolvedSettingValue(key)
  return typeof value === 'string' ? value : String(value)
}

export async function getMaxDocumentsPerUser() {
  return getSettingValue('max_documents_per_ip')
}

export async function getMaxContentLength() {
  return getSettingValue('max_content_length')
}

export async function getDocumentKeyLength() {
  return getSettingValue('document_key_length')
}

export async function getMaxDocumentVersions() {
  return getSettingValue('max_document_versions')
}

const SETTINGS_CACHE_TTL_MS = 5000
const valueCache = new Map<string, { value: number | string; expiresAt: number }>()

async function getResolvedSettingValue(key: string): Promise<number | string> {
  const definition = getSettingDefinition(key)
  if (!definition) {
    throw new Error(`Unknown setting: ${key}`)
  }
  const cached = valueCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }
  const db = await getDb()
  const result = await db.query<SettingRow>('select key, value from app_config where key = $1', [key])
  const value = getEffectiveSettingValue(definition, result.rows[0]?.value ?? null)
  valueCache.set(key, { value, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS })
  return value
}

function invalidateSettingCache(key: string) {
  valueCache.delete(key)
}

export function clearSettingsCache() {
  valueCache.clear()
}

export async function listSettings(): Promise<ResolvedSetting[]> {
  const db = await getDb()
  const result = await db.query<SettingRow>('select key, value from app_config')
  const stored = new Map(result.rows.map(row => [row.key, row.value]))

  return SETTING_DEFINITIONS.map(definition => {
    const dbValue = stored.get(definition.key) ?? null
    return {
      ...definition,
      value: getEffectiveSettingValue(definition, dbValue),
      source: resolveSettingSource(definition, dbValue),
    }
  })
}

export function validateSettingValue(key: string, value: unknown): number | string {
  const definition = getSettingDefinition(key)
  if (!definition) {
    throw new Error(`Unknown setting: ${key}`)
  }
  if (definition.kind === 'string') {
    if (typeof value !== 'string') {
      throw new Error(`${definition.label} must be a string`)
    }
    return value.trim()
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) {
    throw new Error(`${definition.label} must be an integer`)
  }
  if (parsed < (definition.min ?? Number.NEGATIVE_INFINITY) || parsed > (definition.max ?? Number.POSITIVE_INFINITY)) {
    throw new Error(`${definition.label} must be between ${definition.min} and ${definition.max}`)
  }
  return parsed
}

export async function setSettingValue(key: string, value: unknown) {
  const definition = getSettingDefinition(key)
  if (!definition) {
    throw new Error(`Unknown setting: ${key}`)
  }
  const normalized = validateSettingValue(key, value)
  const db = await getDb()
  await db.query<SettingRow>(
    `insert into app_config (key, value, updated_at) values ($1, $2, current_timestamp)
     on conflict (key) do update set value = excluded.value, updated_at = current_timestamp`,
    [key, String(normalized)],
  )
  invalidateSettingCache(key)
  return normalized
}

export async function deleteSettingValue(key: string) {
  const definition = getSettingDefinition(key)
  if (!definition) {
    throw new Error(`Unknown setting: ${key}`)
  }
  const db = await getDb()
  await db.query('delete from app_config where key = $1', [key])
  invalidateSettingCache(key)
}

export function assertKnownSettingKey(key: string) {
  if (!getSettingDefinition(key)) {
    throw new Error(`Unknown setting: ${key}`)
  }
}
