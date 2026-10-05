import { parseCronExpression } from '../cron-expression'
import {
  getDefinition,
  PROPERTY_DEFINITIONS,
  type AdminProperty,
  type BooleanPropertyDefinition,
  type CronPropertyDefinition,
  type NumberPropertyDefinition,
  type PropertyDefinition,
  type PropertyKind,
  type PropertySource,
  type StringPropertyDefinition,
} from './property-definitions'
import { deletePropertyRow, readPropertyRow, readPropertyRows, writePropertyRow } from './property-store'

// Re-exported so importers keep one canonical source for the property surface.
export {
  getDefinition,
  PROPERTY_DEFINITIONS,
  type AdminProperty,
  type BooleanPropertyDefinition,
  type CronPropertyDefinition,
  type NumberPropertyDefinition,
  type PropertyDefinition,
  type PropertyKind,
  type PropertySource,
  type StringPropertyDefinition,
} from './property-definitions'

export function assertKnownPropertyKey(key: string): PropertyDefinition {
  const definition = getDefinition(key)
  if (!definition) {
    throw new PropertyValidationError('unknown', key)
  }
  return definition
}

function readNumber(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) {
    return null
  }
  const trimmed = raw.trim().replace(/,/g, '')
  if (!trimmed) {
    return null
  }
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function isWithinRange(definition: NumberPropertyDefinition, value: number): boolean {
  return Number.isInteger(value) && value >= definition.min && (definition.max === undefined || value <= definition.max)
}

// Boolean values are stored as the strings `true`/`false`; environment values
// use the usual truthy/falsy spellings. Unrecognized spellings fall through.
const TRUE_VALUES = ['1', 'true', 'yes', 'on']
const FALSE_VALUES = ['0', 'false', 'no', 'off']

function readBoolean(value: string | null | undefined): boolean | null {
  if (value === null || value === undefined) {
    return null
  }
  const trimmed = value.trim().toLowerCase()
  if (TRUE_VALUES.includes(trimmed)) {
    return true
  }
  if (FALSE_VALUES.includes(trimmed)) {
    return false
  }
  return null
}

function effectiveBoolean(
  definition: BooleanPropertyDefinition,
  dbValue: string | null,
): { value: boolean; source: PropertySource } {
  if (dbValue !== null) {
    const stored = readBoolean(dbValue)
    if (stored !== null) {
      return { value: stored, source: 'database' }
    }
  }
  const envValue = readBoolean(process.env[definition.envKey])
  return envValue !== null
    ? { value: envValue, source: 'environment' }
    : { value: definition.defaultValue, source: 'default' }
}

function effectiveString(
  definition: StringPropertyDefinition,
  dbValue: string | null,
): { value: string; source: PropertySource } {
  if (dbValue !== null && dbValue) {
    return { value: dbValue, source: 'database' }
  }
  const envValue = (process.env[definition.envKey] ?? '').trim()
  if (envValue) {
    return { value: envValue, source: 'environment' }
  }
  return { value: definition.defaultValue, source: 'default' }
}

// A cron value only counts when it parses, so an invalid stored/env
// expression degrades to the default instead of stopping a scheduler.
function effectiveCron(
  definition: CronPropertyDefinition,
  dbValue: string | null,
): { value: string; source: PropertySource } {
  if (dbValue !== null && parseCronExpression(dbValue)) {
    return { value: dbValue.trim(), source: 'database' }
  }
  const envValue = (process.env[definition.envKey] ?? '').trim()
  if (envValue && parseCronExpression(envValue)) {
    return { value: envValue, source: 'environment' }
  }
  return { value: definition.defaultValue, source: 'default' }
}

function effectiveNumber(
  definition: NumberPropertyDefinition,
  dbValue: string | null,
): { value: number; source: PropertySource } {
  const stored = readNumber(dbValue)
  if (stored !== null && isWithinRange(definition, stored)) {
    return { value: stored, source: 'database' }
  }
  const envValue = readNumber(process.env[definition.envKey])
  if (envValue !== null && isWithinRange(definition, envValue)) {
    return { value: envValue, source: 'environment' }
  }
  return { value: definition.defaultValue, source: 'default' }
}

function effectiveValue(
  definition: PropertyDefinition,
  dbValue: string | null,
): { value: number | string | boolean; source: PropertySource } {
  if (definition.kind === 'boolean') {
    return effectiveBoolean(definition, dbValue)
  }
  if (definition.kind === 'string') {
    return effectiveString(definition, dbValue)
  }
  if (definition.kind === 'cron') {
    return effectiveCron(definition, dbValue)
  }
  return effectiveNumber(definition, dbValue)
}

export async function listProperties(): Promise<AdminProperty[]> {
  const stored = new Map((await readPropertyRows()).map(row => [row.key, row.value]))
  return PROPERTY_DEFINITIONS.map(definition => {
    const { value, source } = effectiveValue(definition, stored.get(definition.key) ?? null)
    const base = {
      key: definition.key,
      labelKey: definition.labelKey,
      descriptionKey: definition.descriptionKey,
      envKey: definition.envKey,
      tags: [...definition.tags],
      kind: definition.kind as PropertyKind,
      defaultValue: definition.defaultValue,
      value,
      source,
    }
    if (definition.kind === 'number') {
      return { ...base, min: definition.min, max: definition.max }
    }
    if (definition.kind === 'string') {
      return { ...base, masked: definition.masked }
    }
    return base
  }).sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0))
}

export type PropertyValidationReason = 'unknown' | 'integer' | 'range' | 'empty' | 'invalid'

export class PropertyValidationError extends Error {
  readonly reason: PropertyValidationReason
  readonly propertyKey: string
  constructor(reason: PropertyValidationReason, propertyKey: string, message?: string) {
    super(message ?? (reason === 'unknown' ? `Unknown setting: ${propertyKey}` : reason))
    this.name = 'PropertyValidationError'
    this.reason = reason
    this.propertyKey = propertyKey
  }
}

export function validatePropertyValue(key: string, value: unknown): number | string | boolean {
  const definition = getDefinition(key)
  if (!definition) {
    throw new PropertyValidationError('unknown', key)
  }
  if (definition.kind === 'string') {
    const text = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value)
    if (!text.trim()) {
      throw new PropertyValidationError('empty', key)
    }
    return text
  }
  if (definition.kind === 'boolean') {
    if (typeof value === 'boolean') {
      return value
    }
    const parsed = typeof value === 'string' ? readBoolean(value) : value === 0 || value === 1 ? value === 1 : null
    if (parsed === null) {
      throw new PropertyValidationError('invalid', key, `${key} must be a boolean`)
    }
    return parsed
  }
  if (definition.kind === 'cron') {
    const text = typeof value === 'string' ? value.trim() : ''
    if (!parseCronExpression(text)) {
      throw new PropertyValidationError('invalid', key, `${key} must be a valid cron expression`)
    }
    return text
  }
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN
  if (!Number.isInteger(parsed)) {
    throw new PropertyValidationError('integer', key, `${key} must be an integer`)
  }
  if (parsed < definition.min || (definition.max !== undefined && parsed > definition.max)) {
    throw new PropertyValidationError('range', key, `${key} must be between ${definition.min} and ${definition.max}`)
  }
  return parsed
}

async function getResolvedPropertyValue(key: string): Promise<number | string | boolean> {
  const definition = assertKnownPropertyKey(key)
  const cached = valueCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }
  const value = effectiveValue(definition, await readPropertyRow(key)).value
  valueCache.set(key, { value, expiresAt: Date.now() + PROPERTIES_CACHE_TTL_MS })
  return value
}

export async function getPropertyValue(key: string): Promise<number> {
  const value = await getResolvedPropertyValue(key)
  if (typeof value !== 'number') {
    throw new Error(`Property ${key} is not numeric`)
  }
  return value
}

export async function getPropertyStringValue(key: string): Promise<string> {
  const value = await getResolvedPropertyValue(key)
  return typeof value === 'string' ? value : String(value)
}

export async function getMaxDocumentsPerUser() {
  return getPropertyValue('max_documents_per_ip')
}

export async function getMaxContentLength() {
  return getPropertyValue('max_content_length')
}

export async function getDocumentKeyLength() {
  return getPropertyValue('document_key_length')
}

export async function getMaxDocumentVersions() {
  return getPropertyValue('max_document_versions')
}

// Opt-out flag served as the `active` field of `GET /api/info`; a catalog scan
// skips this instance entirely when false. Defaults on. Best-effort: a database
// hiccup must never fail the public info card, so it reports active.
export async function getAppActive(): Promise<boolean> {
  try {
    const value = await getResolvedPropertyValue('app_active')
    return typeof value === 'boolean' ? value : true
  } catch {
    return true
  }
}

const PROPERTIES_CACHE_TTL_MS = 5000
const valueCache = new Map<string, { value: number | string | boolean; expiresAt: number }>()

function invalidatePropertyCache(key: string) {
  valueCache.delete(key)
}

export function clearPropertiesCache() {
  valueCache.clear()
}

export async function setPropertyValue(key: string, value: unknown) {
  assertKnownPropertyKey(key)
  const normalized = validatePropertyValue(key, value)
  await writePropertyRow(key, String(normalized))
  invalidatePropertyCache(key)
  return normalized
}

export async function deletePropertyValue(key: string) {
  assertKnownPropertyKey(key)
  await deletePropertyRow(key)
  invalidatePropertyCache(key)
}
