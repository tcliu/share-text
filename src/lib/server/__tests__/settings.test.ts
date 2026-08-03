// @vitest-environment node
process.env.PROFILE = 'dev'
process.env.SQLITE_PATH = ':memory:'

import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '$lib/server/db'
import {
  clearSettingsCache,
  deleteSettingValue,
  getDocumentKeyLength,
  getMaxContentLength,
  getMaxDocumentsPerUser,
  getSettingValue,
  listSettings,
  setSettingValue,
  validateSettingValue,
} from '$lib/server/settings'

beforeEach(async () => {
  clearSettingsCache()
  const db = await getDb()
  await db.query('delete from app_config')
  delete process.env.MAX_DOCUMENTS_PER_IP
  delete process.env.MAX_CONTENT_LENGTH
  delete process.env.DOCUMENT_KEY_LENGTH
})

describe('setting resolution', () => {
  it('falls back to the built-in default when neither env nor database has a value', async () => {
    expect(await getSettingValue('max_documents_per_ip')).toBe(10)
    expect(await getMaxContentLength()).toBe(1024 * 1024)
    expect(await getDocumentKeyLength()).toBe(6)
    const settings = await listSettings()
    expect(settings.every(setting => setting.source === 'default')).toBe(true)
  })

  it('uses the environment value when no database override exists', async () => {
    process.env.MAX_DOCUMENTS_PER_IP = '25'
    expect(await getMaxDocumentsPerUser()).toBe(25)
    const settings = await listSettings()
    expect(settings.find(setting => setting.key === 'max_documents_per_ip')).toMatchObject({
      value: 25,
      source: 'environment',
    })
  })

  it('lets a database override win over the environment', async () => {
    process.env.MAX_DOCUMENTS_PER_IP = '25'
    await setSettingValue('max_documents_per_ip', 50)
    expect(await getMaxDocumentsPerUser()).toBe(50)
    const settings = await listSettings()
    expect(settings.find(setting => setting.key === 'max_documents_per_ip')).toMatchObject({
      value: 50,
      source: 'database',
    })
  })

  it('reverts to environment or default when the override is deleted', async () => {
    await setSettingValue('max_content_length', 1000)
    await deleteSettingValue('max_content_length')
    expect(await getMaxContentLength()).toBe(1024 * 1024)

    process.env.MAX_DOCUMENTS_PER_IP = '25'
    await setSettingValue('max_documents_per_ip', 50)
    await deleteSettingValue('max_documents_per_ip')
    expect(await getMaxDocumentsPerUser()).toBe(25)
  })

  it('reflects overrides immediately after a write (cache invalidation)', async () => {
    expect(await getSettingValue('max_content_length')).toBe(1024 * 1024)
    await setSettingValue('max_content_length', 2048)
    expect(await getSettingValue('max_content_length')).toBe(2048)
    await deleteSettingValue('max_content_length')
    expect(await getSettingValue('max_content_length')).toBe(1024 * 1024)
  })
})

describe('setting validation', () => {
  it('accepts in-range integers', () => {
    expect(validateSettingValue('max_documents_per_ip', 5)).toBe(5)
  })

  it('rejects unknown keys', () => {
    expect(() => validateSettingValue('unknown_key', 5)).toThrow('Unknown setting')
  })

  it('rejects non-integers', () => {
    expect(() => validateSettingValue('max_documents_per_ip', 1.5)).toThrow('must be an integer')
  })

  it('rejects out-of-range values', () => {
    expect(() => validateSettingValue('max_documents_per_ip', 0)).toThrow('must be between')
    expect(() => validateSettingValue('max_content_length', 1024 * 1024 + 1)).toThrow('must be between')
    expect(() => validateSettingValue('document_key_length', 3)).toThrow('must be between')
    expect(() => validateSettingValue('document_key_length', 33)).toThrow('must be between')
  })
})
