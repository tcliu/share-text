import { beforeEach, describe, expect, it } from 'vitest'
import {
  createI18nStore,
  createShareTextI18n,
  settingDescription,
  settingLabel,
  type ShareTextI18n,
} from '$lib/i18n.svelte'

describe('i18n', () => {
  let i18n: ShareTextI18n

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.lang = ''
    i18n = createShareTextI18n()
  })

  it('defaults to English', () => {
    expect(i18n.locale).toBe('en')
    expect(i18n.t('list.login')).toBe('Login')
  })

  it('switches the active locale', () => {
    i18n.setLocale('zh-CN')
    expect(i18n.locale).toBe('zh-CN')
    expect(i18n.t('list.login')).toBe('登录')
    i18n.setLocale('zh-TW')
    expect(i18n.t('list.login')).toBe('登入')
  })

  it('keeps store instances independent', () => {
    const other = createShareTextI18n()
    i18n.setLocale('zh-CN')
    expect(other.locale).toBe('en')
    expect(other.t('list.login')).toBe('Login')
  })

  it('interpolates placeholders', () => {
    expect(i18n.t('list.signedInAs', { name: 'alice' })).toBe('Signed in as alice')
    i18n.setLocale('zh-CN')
    expect(i18n.t('list.signedInAs', { name: 'alice' })).toBe('已登录为 alice')
  })

  it('translates admin console keys', () => {
    expect(i18n.t('admin.tab.properties')).toBe('Properties')
    expect(i18n.t('admin.tab.documents')).toBe('Documents')
    expect(i18n.t('admin.tab.users')).toBe('Users')
    i18n.setLocale('zh-CN')
    expect(i18n.t('admin.tab.properties')).toBe('属性')
    expect(i18n.t('admin.tab.documents')).toBe('文档')
    expect(i18n.t('admin.tab.users')).toBe('用户')
  })

  it('resolves plural keys by count', () => {
    expect(i18n.t('admin.documents.deleted', { count: 1 })).toBe('1 document deleted')
    expect(i18n.t('admin.documents.deletedPlural', { count: 3 })).toBe('3 documents deleted')
    i18n.setLocale('zh-CN')
    expect(i18n.t('admin.documents.deleted', { count: 1 })).toBe('已删除 1 个文档')
    expect(i18n.t('admin.documents.deletedPlural', { count: 3 })).toBe('已删除 3 个文档')
  })

  it('composes the bulk-status toast without duplicated particles', () => {
    const state = (enabled: boolean) => (enabled ? i18n.t('admin.enabled') : i18n.t('admin.disabled'))
    i18n.setLocale('zh-CN')
    expect(i18n.t('admin.users.statusUpdated', { count: 3, state: state(true) })).toBe('3 个用户已启用')
    expect(i18n.t('admin.users.statusUpdated', { count: 1, state: state(false) })).toBe('1 个用户已停用')
    i18n.setLocale('zh-TW')
    expect(i18n.t('admin.users.statusUpdated', { count: 3, state: state(true) })).toBe('3 個使用者已啟用')
  })

  it('falls back to the key when no dictionary has it', () => {
    expect(i18n.t('missing.key' as never)).toBe('missing.key')
  })

  it('persists the locale and updates the html lang', () => {
    i18n.setLocale('zh-TW')
    expect(localStorage.getItem('share-text:locale')).toBe('zh-TW')
    expect(document.documentElement.lang).toBe('zh-TW')
  })

  it('applies a saved locale at creation', () => {
    localStorage.setItem('share-text:locale', 'zh-CN')
    expect(createShareTextI18n().locale).toBe('zh-CN')
  })

  it('ignores invalid saved values at creation', () => {
    localStorage.setItem('share-text:locale', 'fr')
    expect(createShareTextI18n().locale).toBe('en')
  })

  it('supports a null storage key without persisting', () => {
    const ephemeral = createI18nStore({ en: { hello: 'Hello' } }, 'en', null)
    ephemeral.setLocale('en')
    expect(localStorage.getItem('share-text:locale')).toBeNull()
    expect(ephemeral.t('hello')).toBe('Hello')
  })

  it('resolves setting labels and descriptions per locale', () => {
    expect(settingLabel(i18n, 'max_documents_per_ip')).toBe('Max documents per IP')
    expect(settingDescription(i18n, 'max_document_versions')).toContain('content versions')
    i18n.setLocale('zh-CN')
    expect(settingLabel(i18n, 'max_documents_per_ip')).toBe('单 IP 最大文档数')
    expect(settingDescription(i18n, 'max_document_versions')).toContain('版本')
    i18n.setLocale('zh-TW')
    expect(settingLabel(i18n, 'max_content_length')).toBe('最大內容長度（字元）')
  })

  it('returns null for unknown settings so callers fall back to the server label', () => {
    expect(settingLabel(i18n, 'unknown_setting')).toBeNull()
    expect(settingDescription(i18n, 'unknown_setting')).toBeNull()
  })
})
