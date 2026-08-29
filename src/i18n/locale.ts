import { LOCALES, type Locale } from './messages'

export const LOCALE_STORAGE_KEY = 'grove.locale'

export function isLocale(value: string): value is Locale {
  return LOCALES.some((locale) => locale.id === value)
}

/** Map one BCP 47 tag onto a supported locale, or null when it is none of ours. */
export function matchLocale(tag: string): Locale | null {
  const lower = tag.toLowerCase()
  if (lower.startsWith('zh')) {
    const parts = lower.split(/[-_]/)
    const traditional = parts.includes('hant') || parts.includes('tw') || parts.includes('hk') || parts.includes('mo')
    return traditional ? 'zh-TW' : 'zh-CN'
  }
  if (lower.startsWith('ja')) return 'ja'
  if (lower.startsWith('ru')) return 'ru'
  if (lower.startsWith('fr')) return 'fr'
  if (lower.startsWith('en')) return 'en'
  return null
}

/**
 * A stored choice wins; otherwise the first browser language we support;
 * otherwise English.
 */
export function pickLocale(stored: string | null | undefined, languages: readonly string[]): Locale {
  if (stored && isLocale(stored)) return stored
  for (const tag of languages) {
    const found = matchLocale(tag)
    if (found) return found
  }
  return 'en'
}
