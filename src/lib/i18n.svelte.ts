import { browser } from '$app/environment'
import { getContext, hasContext, setContext } from 'svelte'
import { en, type MessageKey } from './locales/en'
import { zhCN } from './locales/zh-CN'
import { zhTW } from './locales/zh-TW'

export const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
] as const

export type Locale = (typeof LOCALES)[number]['code']

const DEFAULT_LOCALE: Locale = 'en'
const STORAGE_KEY = 'share-text:locale'

export type { MessageKey } from './locales/en'

const dictionaries: Record<Locale, Record<MessageKey, string>> = {
  en,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
}

export interface I18nStore<TKey extends string = string, TLocale extends string = string> {
  readonly locale: TLocale
  setLocale(next: TLocale): void
  t(key: TKey, params?: Record<string, string | number>): string
}

export const I18N_CONTEXT_KEY = 'i18n'

function readInitialLocale<TKey extends string, TLocale extends string>(
  dictionaries: Record<TLocale, Record<TKey, string>>,
  defaultLocale: TLocale,
  storageKey: string | null,
): TLocale {
  if (!browser) return defaultLocale
  try {
    const saved = storageKey ? localStorage.getItem(storageKey) : null
    if (saved !== null && Object.prototype.hasOwnProperty.call(dictionaries, saved)) {
      return saved as TLocale
    }
  } catch {
    // ignore storage errors
  }
  return defaultLocale
}

export function createI18nStore<TKey extends string, TLocale extends string>(
  dictionaries: Record<TLocale, Record<TKey, string>>,
  defaultLocale: TLocale,
  storageKey: string | null,
): I18nStore<TKey, TLocale> {
  const initialLocale = readInitialLocale(dictionaries, defaultLocale, storageKey)
  let current = $state<TLocale>(initialLocale)

  if (browser) {
    document.documentElement.lang = initialLocale
  }

  return {
    get locale() {
      return current
    },
    setLocale(next: TLocale) {
      current = next
      if (!browser) return
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, next)
        } catch {
          // ignore storage errors
        }
      }
      document.documentElement.lang = next
    },
    t(key: TKey, params?: Record<string, string | number>): string {
      const dictionary = dictionaries[current]
      let message: string = dictionary[key] ?? dictionaries[defaultLocale][key] ?? key
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          message = message.replaceAll(`{${name}}`, String(value))
        }
      }
      return message
    },
  }
}

export type ShareTextI18n = I18nStore<MessageKey, Locale>

export function createShareTextI18n(): ShareTextI18n {
  return createI18nStore(dictionaries, DEFAULT_LOCALE, STORAGE_KEY)
}

export function setI18nContext(store: ShareTextI18n): ShareTextI18n {
  setContext(I18N_CONTEXT_KEY, store)
  return store
}

let defaultStore: ShareTextI18n | null = null

export function getI18nContext(): ShareTextI18n {
  if (hasContext(I18N_CONTEXT_KEY)) {
    return getContext<ShareTextI18n>(I18N_CONTEXT_KEY)
  }
  // per-test provider; app code always runs under the layout store. Warn in
  // dev so a provider-less component in app code fails loudly instead of
  // silently rendering English.
  if (import.meta.env.DEV) {
    console.warn('getI18nContext: no i18n provider above; using the default English store')
  }
  if (!defaultStore) {
    defaultStore = createShareTextI18n()
  }
  return defaultStore
}

const SETTING_KEYS = {
  document_key_length: {
    label: 'setting.document_key_length',
    description: 'setting.document_key_lengthDescription',
  },
  max_content_length: {
    label: 'setting.max_content_length',
    description: 'setting.max_content_lengthDescription',
  },
  max_document_versions: {
    label: 'setting.max_document_versions',
    description: 'setting.max_document_versionsDescription',
  },
  max_documents_per_ip: {
    label: 'setting.max_documents_per_ip',
    description: 'setting.max_documents_per_ipDescription',
  },
} as const

export function settingLabel(i18n: ShareTextI18n, key: string): string | null {
  const setting = SETTING_KEYS[key as keyof typeof SETTING_KEYS]
  return setting ? i18n.t(setting.label) : null
}

export function settingDescription(i18n: ShareTextI18n, key: string): string | null {
  const setting = SETTING_KEYS[key as keyof typeof SETTING_KEYS]
  return setting ? i18n.t(setting.description) : null
}
