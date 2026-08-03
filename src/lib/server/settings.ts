import { getDb } from './db'

export interface SettingDefinition {
  key: string
  label: string
  description: string
  defaultValue: number
  envKey: string
  min: number
  max: number
}

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: 'max_documents_per_ip',
    label: 'Max documents per IP',
    description: 'Maximum number of documents a single client IP can create.',
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
    defaultValue: 6,
    envKey: 'DOCUMENT_KEY_LENGTH',
    min: 4,
    max: 32,
  },
]

export type SettingSource = 'database' | 'environment' | 'default'

export interface ResolvedSetting extends SettingDefinition {
  value: number
  source: SettingSource
}

interface SettingRow {
  key: string
  value: string
}

function readNumber(value: string | undefined): number | null {
  if (value === undefined) {
    return null
  }
  const parsed = Number(value.trim())
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function resolveSettingSource(definition: SettingDefinition, dbValue: string | null): SettingSource {
  if (dbValue !== null) {
    return 'database'
  }
  if (readNumber(process.env[definition.envKey]) !== null) {
    return 'environment'
  }
  return 'default'
}

export function getEffectiveSettingValue(definition: SettingDefinition, dbValue: string | null) {
  const envValue = readNumber(process.env[definition.envKey])
  if (dbValue !== null) {
    const stored = readNumber(dbValue)
    if (stored !== null) {
      return stored
    }
  }
  return envValue ?? definition.defaultValue
}

export async function getSettingValue(key: string): Promise<number> {
  const definition = SETTING_DEFINITIONS.find(item => item.key === key)
  if (!definition) {
    throw new Error(`Unknown setting: ${key}`)
  }
  const cached = valueCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }
  const value = await readSettingValue(key)
  valueCache.set(key, { value, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS })
  return value
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

const SETTINGS_CACHE_TTL_MS = 5000
const valueCache = new Map<string, { value: number; expiresAt: number }>()

async function readSettingValue(key: string) {
  const definition = SETTING_DEFINITIONS.find(item => item.key === key)
  if (!definition) {
    throw new Error(`Unknown setting: ${key}`)
  }
  const db = await getDb()
  const result = await db.query<SettingRow>('select key, value from app_config where key = $1', [key])
  return getEffectiveSettingValue(definition, result.rows[0]?.value ?? null)
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

export function validateSettingValue(key: string, value: unknown): number {
  const definition = SETTING_DEFINITIONS.find(item => item.key === key)
  if (!definition) {
    throw new Error(`Unknown setting: ${key}`)
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) {
    throw new Error(`${definition.label} must be an integer`)
  }
  if (parsed < definition.min || parsed > definition.max) {
    throw new Error(`${definition.label} must be between ${definition.min} and ${definition.max}`)
  }
  return parsed
}

export async function setSettingValue(key: string, value: unknown) {
  const definition = SETTING_DEFINITIONS.find(item => item.key === key)
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
  const definition = SETTING_DEFINITIONS.find(item => item.key === key)
  if (!definition) {
    throw new Error(`Unknown setting: ${key}`)
  }
  const db = await getDb()
  await db.query('delete from app_config where key = $1', [key])
  invalidateSettingCache(key)
}
