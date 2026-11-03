// @vitest-environment node
process.env.PROFILE = 'dev'
process.env.SQLITE_PATH = ':memory:'

import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '#lib/server/db/index.js'
import {
  clearPropertiesCache,
  deletePropertyValue,
  getAppActive,
  getDocumentKeyLength,
  getMaxContentLength,
  getMaxDocumentVersions,
  getMaxDocumentsPerUser,
  getPropertyStringValue,
  getPropertyValue,
  listProperties,
  setPropertyValue,
  validatePropertyValue,
} from '#lib/server/admin-properties.js'

beforeEach(async () => {
  clearPropertiesCache()
  const db = await getDb()
  await db.query('delete from app_config')
  delete process.env.MAX_DOCUMENTS_PER_IP
  delete process.env.MAX_CONTENT_LENGTH
  delete process.env.DOCUMENT_KEY_LENGTH
  delete process.env.MAX_DOCUMENT_VERSIONS
  delete process.env.APP_ACTIVE
})

describe('setting resolution', () => {
  it('falls back to the built-in default when neither env nor database has a value', async () => {
    expect(await getPropertyValue('max_documents_per_ip')).toBe(10)
    expect(await getMaxContentLength()).toBe(1024 * 1024)
    expect(await getDocumentKeyLength()).toBe(6)
    expect(await getMaxDocumentVersions()).toBe(20)
    const settings = await listProperties()
    expect(settings.every(setting => setting.source === 'default')).toBe(true)
  })

  it('uses the environment value when no database override exists', async () => {
    process.env.MAX_DOCUMENTS_PER_IP = '25'
    expect(await getMaxDocumentsPerUser()).toBe(25)
    const settings = await listProperties()
    expect(settings.find(setting => setting.key === 'max_documents_per_ip')).toMatchObject({
      value: 25,
      source: 'environment',
    })
  })

  it('resolves the max_document_versions setting from the environment', async () => {
    process.env.MAX_DOCUMENT_VERSIONS = '5'
    expect(await getMaxDocumentVersions()).toBe(5)
    const settings = await listProperties()
    expect(settings.find(setting => setting.key === 'max_document_versions')).toMatchObject({
      value: 5,
      source: 'environment',
    })
  })

  it('ignores out-of-range environment values and falls back to the default', async () => {
    process.env.DOCUMENT_KEY_LENGTH = '99'

    expect(await getDocumentKeyLength()).toBe(6)

    const settings = await listProperties()
    expect(settings.find(setting => setting.key === 'document_key_length')).toMatchObject({
      value: 6,
      source: 'default',
    })
  })

  it('lets a database override win over the environment', async () => {
    process.env.MAX_DOCUMENTS_PER_IP = '25'
    await setPropertyValue('max_documents_per_ip', 50)
    expect(await getMaxDocumentsPerUser()).toBe(50)
    const settings = await listProperties()
    expect(settings.find(setting => setting.key === 'max_documents_per_ip')).toMatchObject({
      value: 50,
      source: 'database',
    })
  })

  it('ignores out-of-range database overrides and falls back to env/default', async () => {
    const db = await getDb()
    await db.query('insert into app_config (key, value, updated_at) values ($1, $2, current_timestamp)', [
      'document_key_length',
      '99',
    ])

    expect(await getDocumentKeyLength()).toBe(6)

    const settings = await listProperties()
    expect(settings.find(setting => setting.key === 'document_key_length')).toMatchObject({
      value: 6,
      source: 'default',
    })
  })

  it('reverts to environment or default when the override is deleted', async () => {
    await setPropertyValue('max_content_length', 1000)
    await deletePropertyValue('max_content_length')
    expect(await getMaxContentLength()).toBe(1024 * 1024)

    process.env.MAX_DOCUMENTS_PER_IP = '25'
    await setPropertyValue('max_documents_per_ip', 50)
    await deletePropertyValue('max_documents_per_ip')
    expect(await getMaxDocumentsPerUser()).toBe(25)
  })

  it('reflects overrides immediately after a write (cache invalidation)', async () => {
    expect(await getPropertyValue('max_content_length')).toBe(1024 * 1024)
    await setPropertyValue('max_content_length', 2048)
    expect(await getPropertyValue('max_content_length')).toBe(2048)
    await deletePropertyValue('max_content_length')
    expect(await getPropertyValue('max_content_length')).toBe(1024 * 1024)
  })
})

describe('boolean app_active setting', () => {
  it('resolves from database over environment over default with a true fallback', async () => {
    expect(await getAppActive()).toBe(true)
    process.env.APP_ACTIVE = 'false'
    clearPropertiesCache()
    expect(await getAppActive()).toBe(false)
    expect((await listProperties()).find(setting => setting.key === 'app_active')).toMatchObject({
      value: false,
      source: 'environment',
    })
    await setPropertyValue('app_active', true)
    expect(await getAppActive()).toBe(true)
    expect((await listProperties()).find(setting => setting.key === 'app_active')).toMatchObject({
      value: true,
      source: 'database',
    })
  })

  it('validates boolean writes and rejects unrecognized spellings', () => {
    expect(validatePropertyValue('app_active', false)).toBe(false)
    expect(validatePropertyValue('app_active', 'no')).toBe(false)
    expect(validatePropertyValue('app_active', 'yes')).toBe(true)
    expect(() => validatePropertyValue('app_active', 'maybe')).toThrow('must be a boolean')
  })
})

describe('setting validation', () => {
  it('accepts in-range integers', () => {
    expect(validatePropertyValue('max_documents_per_ip', 5)).toBe(5)
  })

  it('rejects unknown keys', () => {
    expect(() => validatePropertyValue('unknown_key', 5)).toThrow('Unknown setting')
  })

  it('rejects non-integers', () => {
    expect(() => validatePropertyValue('max_documents_per_ip', 1.5)).toThrow('must be an integer')
  })

  it('rejects out-of-range values', () => {
    expect(() => validatePropertyValue('max_documents_per_ip', 0)).toThrow('must be between')
    expect(() => validatePropertyValue('max_content_length', 1024 * 1024 + 1)).toThrow('must be between')
    expect(() => validatePropertyValue('document_key_length', 3)).toThrow('must be between')
    expect(() => validatePropertyValue('document_key_length', 33)).toThrow('must be between')
    expect(() => validatePropertyValue('max_document_versions', 0)).toThrow('must be between')
    expect(() => validatePropertyValue('max_document_versions', 101)).toThrow('must be between')
  })
})
