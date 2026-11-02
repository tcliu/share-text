// i18n.svelte.ts — the app's translations, over the package's store.
//
// The shared components read their labels through the package's store, so the
// app sets that store: its own dictionary carries the app's keys, the
// package's dictionary carries the shared ones, and the app's key wins where
// both define a name. The store itself, the context and the lookup come from
// the package, so there is exactly one store in the app.

import {
  createI18nStore,
  getI18nContext as getPackageI18nContext,
  setDefaultI18nStore,
  setI18nContext as setPackageI18nContext,
} from '@codepg/ui-lib/i18n/store.svelte'
import type { I18nStore as PackageI18nStore } from '@codepg/ui-lib/i18n/store.svelte'
import { en as sharedEn } from '@codepg/ui-lib/i18n/locales/en'
import { zhCN as sharedZhCN } from '@codepg/ui-lib/i18n/locales/zh-CN'
import { zhTW as sharedZhTW } from '@codepg/ui-lib/i18n/locales/zh-TW'
import { en } from './locales/en'
import { zhCN } from './locales/zh-CN'
import { zhTW } from './locales/zh-TW'

export type Locale = 'en' | 'zh-CN' | 'zh-TW'

// Switcher entries; every locale is labelled in its own language.
export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
]

const STORAGE_KEY: string | null = 'share-text:locale'

// The app's store: the shared dictionary under the app's own, so a shared
// label the app does not define still resolves. The merge is deep: a shallow
// spread would replace a whole group, so the shared keys inside a group the
// app also defines would be lost. The key union comes from the merged
// dictionary, so a shared component's key and the app's own key are both part
// of it.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// The type-level twin of the runtime merge below: a group both dictionaries
// define carries both key sets, and the app's value wins on a conflict. An
// intersection type cannot express this — a key only one side defines would
// read as `never` and vanish from the key union.
type MergedDictionaries<TShared, TOwn> = {
  [K in keyof TShared | keyof TOwn]: K extends keyof TOwn
    ? TOwn[K] extends Record<string, unknown>
      ? K extends keyof TShared
        ? TShared[K] extends Record<string, unknown>
          ? MergedDictionaries<TShared[K], TOwn[K]>
          : TOwn[K]
        : TOwn[K]
      : TOwn[K]
    : K extends keyof TShared
      ? TShared[K]
      : never
}

function mergeDictionary<TShared extends Record<string, unknown>, TOwn extends Record<string, unknown>>(
  shared: TShared,
  own: TOwn,
): MergedDictionaries<TShared, TOwn> {
  const merged: Record<string, unknown> = { ...shared }
  for (const [key, value] of Object.entries(own)) {
    const base = merged[key]
    merged[key] = isPlainObject(base) && isPlainObject(value) ? mergeDictionary(base, value) : value
  }
  return merged as MergedDictionaries<TShared, TOwn>
}

// Dotted-path key union over the merged dictionary. Call sites keep using the
// same strings; only the dictionary shape changed.
type DottedKey<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${DottedKey<T[K]>}`
}[keyof T & string]

// Nested message tree matching the source shape, with plain strings at the
// leaves. Typing each app locale against `en` keeps a missing translation a
// build error even though the store is the package's.
type LocaleMessages<T> = {
  [K in keyof T]: T[K] extends string ? string : LocaleMessages<T[K]>
}

const APP_DICTIONARIES = {
  en,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
} satisfies Record<Locale, LocaleMessages<typeof en>>

const dictionaries = {
  'en': mergeDictionary(sharedEn, APP_DICTIONARIES.en),
  'zh-CN': mergeDictionary(sharedZhCN, APP_DICTIONARIES['zh-CN']),
  'zh-TW': mergeDictionary(sharedZhTW, APP_DICTIONARIES['zh-TW']),
}

export type MessageKey = DottedKey<typeof dictionaries.en>

// The store factory is the package's; the app re-exports it so its own tests
// and helpers build a store the same way.
export { createI18nStore }

// The store type is the package's, keyed by the app's dictionary: a shared
// component reads the store it is handed, and the app's own keys have to be
// part of it.
export type I18nStore<TKey extends string = MessageKey, TLocale extends string = Locale> = PackageI18nStore<
  TKey,
  TLocale
>

export function createAppI18n() {
  return createI18nStore<MessageKey, Locale>(dictionaries, 'en', STORAGE_KEY)
}

// The app's store is the fallback for a component rendered without a provider
// (a test, an island), so the app's own labels resolve there too.
setDefaultI18nStore(() => createAppI18n())

export function setI18nContext(store: ReturnType<typeof createAppI18n>) {
  return setPackageI18nContext(store)
}

export function getI18nContext() {
  return getPackageI18nContext<MessageKey>()
}
