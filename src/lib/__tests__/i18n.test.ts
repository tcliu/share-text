import { beforeEach, describe, expect, it } from 'vitest'
import { getLocale, initLocale, setLocale, settingDescription, settingLabel, t } from '$lib/i18n.svelte'

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear()
    setLocale('en')
  })

  it('defaults to English', () => {
    expect(getLocale()).toBe('en')
    expect(t('list.login')).toBe('Login')
  })

  it('switches the active locale', () => {
    setLocale('zh-CN')
    expect(getLocale()).toBe('zh-CN')
    expect(t('list.login')).toBe('登录')
    setLocale('zh-TW')
    expect(t('list.login')).toBe('登入')
  })

  it('interpolates placeholders', () => {
    expect(t('list.signedInAs', { name: 'alice' })).toBe('Signed in as alice')
    setLocale('zh-CN')
    expect(t('list.signedInAs', { name: 'alice' })).toBe('已登录为 alice')
  })

  it('translates admin console keys', () => {
    expect(t('admin.tab.properties')).toBe('Properties')
    expect(t('admin.tab.documents')).toBe('Documents')
    expect(t('admin.tab.users')).toBe('Users')
    setLocale('zh-CN')
    expect(t('admin.tab.properties')).toBe('属性')
    expect(t('admin.tab.documents')).toBe('文档')
    expect(t('admin.tab.users')).toBe('用户')
  })

  it('resolves plural keys by count', () => {
    expect(t('admin.documents.deleted', { count: 1 })).toBe('1 document deleted')
    expect(t('admin.documents.deletedPlural', { count: 3 })).toBe('3 documents deleted')
    setLocale('zh-CN')
    expect(t('admin.documents.deleted', { count: 1 })).toBe('已删除 1 个文档')
    expect(t('admin.documents.deletedPlural', { count: 3 })).toBe('已删除 3 个文档')
  })

  it('composes the bulk-status toast without duplicated particles', () => {
    const state = (enabled: boolean) => (enabled ? t('admin.enabled') : t('admin.disabled'))
    setLocale('zh-CN')
    expect(t('admin.users.statusUpdated', { count: 3, state: state(true) })).toBe('3 个用户已启用')
    expect(t('admin.users.statusUpdated', { count: 1, state: state(false) })).toBe('1 个用户已停用')
    setLocale('zh-TW')
    expect(t('admin.users.statusUpdated', { count: 3, state: state(true) })).toBe('3 個使用者已啟用')
  })

  it('persists the locale and updates the html lang', () => {
    setLocale('zh-TW')
    expect(localStorage.getItem('share-text:locale')).toBe('zh-TW')
    expect(document.documentElement.lang).toBe('zh-TW')
  })

  it('initLocale applies a saved locale', () => {
    localStorage.setItem('share-text:locale', 'zh-CN')
    initLocale()
    expect(getLocale()).toBe('zh-CN')
  })

  it('initLocale ignores invalid saved values', () => {
    localStorage.setItem('share-text:locale', 'fr')
    initLocale()
    expect(getLocale()).toBe('en')
  })

  it('resolves setting labels and descriptions per locale', () => {
    expect(settingLabel('tts_max_segment_length')).toBe('TTS max segment length (chars)')
    expect(settingDescription('max_document_versions')).toContain('content versions')
    setLocale('zh-CN')
    expect(settingLabel('tts_max_segment_length')).toBe('TTS 最大分段长度（字符）')
    expect(settingDescription('max_document_versions')).toContain('版本')
    setLocale('zh-TW')
    expect(settingLabel('tts_service_url')).toBe('TTS 服務 URL')
  })

  it('returns null for unknown settings so callers fall back to the server label', () => {
    expect(settingLabel('unknown_setting')).toBeNull()
    expect(settingDescription('unknown_setting')).toBeNull()
  })
})
