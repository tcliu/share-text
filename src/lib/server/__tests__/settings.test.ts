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
  getMaxDocumentVersions,
  getMaxDocumentsPerUser,
  getSettingStringValue,
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
  delete process.env.MAX_DOCUMENT_VERSIONS
  delete process.env.TTS_SERVICE_URL
  delete process.env.TTS_MAX_SEGMENT_LENGTH
  delete process.env.TTS_SYNTHESIS_CONCURRENCY
})

describe('setting resolution', () => {
  it('falls back to the built-in default when neither env nor database has a value', async () => {
    expect(await getSettingValue('max_documents_per_ip')).toBe(10)
    expect(await getMaxContentLength()).toBe(1024 * 1024)
    expect(await getDocumentKeyLength()).toBe(6)
    expect(await getMaxDocumentVersions()).toBe(20)
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

  it('resolves the max_document_versions setting from the environment', async () => {
    process.env.MAX_DOCUMENT_VERSIONS = '5'
    expect(await getMaxDocumentVersions()).toBe(5)
    const settings = await listSettings()
    expect(settings.find(setting => setting.key === 'max_document_versions')).toMatchObject({
      value: 5,
      source: 'environment',
    })
  })

  it('ignores out-of-range environment values and falls back to the default', async () => {
    process.env.DOCUMENT_KEY_LENGTH = '99'

    expect(await getDocumentKeyLength()).toBe(6)

    const settings = await listSettings()
    expect(settings.find(setting => setting.key === 'document_key_length')).toMatchObject({
      value: 6,
      source: 'default',
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

  it('ignores out-of-range database overrides and falls back to env/default', async () => {
    const db = await getDb()
    await db.query(
      'insert into app_config (key, value, updated_at) values ($1, $2, current_timestamp)',
      ['document_key_length', '99'],
    )

    expect(await getDocumentKeyLength()).toBe(6)

    const settings = await listSettings()
    expect(settings.find(setting => setting.key === 'document_key_length')).toMatchObject({
      value: 6,
      source: 'default',
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

describe('string settings', () => {
  it('falls back to the empty default when neither env nor database has a value', async () => {
    expect(await getSettingStringValue('tts_service_url')).toBe('')
    const settings = await listSettings()
    expect(settings.find(setting => setting.key === 'tts_service_url')).toMatchObject({
      value: '',
      source: 'default',
      kind: 'string',
    })
  })

  it('uses the environment value when no database override exists', async () => {
    process.env.TTS_SERVICE_URL = 'http://127.0.0.1:8000'
    expect(await getSettingStringValue('tts_service_url')).toBe('http://127.0.0.1:8000')
    const settings = await listSettings()
    expect(settings.find(setting => setting.key === 'tts_service_url')).toMatchObject({
      value: 'http://127.0.0.1:8000',
      source: 'environment',
    })
  })

  it('lets a database override win over the environment', async () => {
    process.env.TTS_SERVICE_URL = 'http://127.0.0.1:8000'
    await setSettingValue('tts_service_url', 'http://tts.internal:9000')
    expect(await getSettingStringValue('tts_service_url')).toBe('http://tts.internal:9000')
    const settings = await listSettings()
    expect(settings.find(setting => setting.key === 'tts_service_url')).toMatchObject({
      value: 'http://tts.internal:9000',
      source: 'database',
    })
  })

  it('can be cleared back to the environment or default by deleting the override', async () => {
    await setSettingValue('tts_service_url', 'http://tts.internal:9000')
    await deleteSettingValue('tts_service_url')
    expect(await getSettingStringValue('tts_service_url')).toBe('')
  })

  it('validates and trims string values', () => {
    expect(validateSettingValue('tts_service_url', '  http://tts:8000  ')).toBe('http://tts:8000')
    expect(validateSettingValue('tts_service_url', '')).toBe('')
  })

  it('rejects non-string values for string settings', () => {
    expect(() => validateSettingValue('tts_service_url', 42)).toThrow('must be a string')
  })
})

describe('TTS client settings', () => {
  it('resolves the tts_max_segment_length setting from the default and environment', async () => {
    expect(await getSettingValue('tts_max_segment_length')).toBe(500)
    const settings = await listSettings()
    expect(settings.find(setting => setting.key === 'tts_max_segment_length')).toMatchObject({
      value: 500,
      source: 'default',
      kind: 'number',
    })

    process.env.TTS_MAX_SEGMENT_LENGTH = '300'
    clearSettingsCache()
    expect(await getSettingValue('tts_max_segment_length')).toBe(300)
  })

  it('resolves the tts_synthesis_concurrency setting from the default and environment', async () => {
    expect(await getSettingValue('tts_synthesis_concurrency')).toBe(4)
    const settings = await listSettings()
    expect(settings.find(setting => setting.key === 'tts_synthesis_concurrency')).toMatchObject({
      value: 4,
      source: 'default',
      kind: 'number',
    })

    process.env.TTS_SYNTHESIS_CONCURRENCY = '2'
    clearSettingsCache()
    expect(await getSettingValue('tts_synthesis_concurrency')).toBe(2)
  })

  it('validates the bounds of the TTS client settings', () => {
    expect(validateSettingValue('tts_max_segment_length', 50)).toBe(50)
    expect(() => validateSettingValue('tts_max_segment_length', 49)).toThrow('must be between')
    expect(() => validateSettingValue('tts_max_segment_length', 5001)).toThrow('must be between')
    expect(validateSettingValue('tts_synthesis_concurrency', 1)).toBe(1)
    expect(() => validateSettingValue('tts_synthesis_concurrency', 0)).toThrow('must be between')
    expect(() => validateSettingValue('tts_synthesis_concurrency', 9)).toThrow('must be between')
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
    expect(() => validateSettingValue('max_document_versions', 0)).toThrow('must be between')
    expect(() => validateSettingValue('max_document_versions', 101)).toThrow('must be between')
  })
})
