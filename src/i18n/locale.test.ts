import { describe, expect, it } from 'vitest'
import { matchLocale, pickLocale } from './locale'
import { LOCALES, MESSAGES, translateMessage, type Messages } from './messages'
import { TOO_LONG_MESSAGE } from '../qr/payload'
import { STILL_ERROR } from '../share/importStill'
import { STILL_NO_CANVAS } from '../share/exportStill'
import { WRAP_TOO_LONG } from '../share/secret'

/** Every string in a message tree as [path, value]; error keys contain periods, so paths use a tab. */
function leaves(value: unknown, prefix = ''): [string, unknown][] {
  if (typeof value !== 'object' || value === null) return [[prefix, value]]
  return Object.entries(value).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}\t${key}` : key))
}

describe('locale detection', () => {
  it('maps browser tags onto the supported locales', () => {
    expect(matchLocale('en-US')).toBe('en')
    expect(matchLocale('zh')).toBe('zh-CN')
    expect(matchLocale('zh-CN')).toBe('zh-CN')
    expect(matchLocale('zh-Hans-SG')).toBe('zh-CN')
    expect(matchLocale('zh-TW')).toBe('zh-TW')
    expect(matchLocale('zh-Hant-HK')).toBe('zh-TW')
    expect(matchLocale('zh-HK')).toBe('zh-TW')
    expect(matchLocale('ja-JP')).toBe('ja')
    expect(matchLocale('ru-RU')).toBe('ru')
    expect(matchLocale('fr-CA')).toBe('fr')
    expect(matchLocale('de-DE')).toBeNull()
  })

  it('prefers a stored choice, then the first supported browser language, then English', () => {
    expect(pickLocale('ja', ['zh-CN'])).toBe('ja')
    expect(pickLocale('klingon', ['de-DE', 'zh-TW', 'en'])).toBe('zh-TW')
    expect(pickLocale(null, ['de-DE', 'it-IT'])).toBe('en')
    expect(pickLocale(null, ['fr-FR', 'en'])).toBe('fr')
    expect(pickLocale(undefined, [])).toBe('en')
  })
})

describe('messages', () => {
  it('has every key in every language, and a name for every locale', () => {
    const reference = leaves(MESSAGES.en).map(([path]) => path).sort()
    for (const { id, name } of LOCALES) {
      expect(name.length).toBeGreaterThan(0)
      const entries = leaves(MESSAGES[id])
      expect(entries.map(([path]) => path).sort()).toEqual(reference)
      for (const [path, value] of entries) {
        expect(typeof value === 'string' && value.length > 0, `${id}: ${path}`).toBe(true)
      }
    }
  })

  it('translates every thrown module error and passes unknown text through', () => {
    for (const { id } of LOCALES) {
      const t: Messages = MESSAGES[id]
      for (const text of [TOO_LONG_MESSAGE, STILL_ERROR, STILL_NO_CANVAS, WRAP_TOO_LONG, 'Could not lock the URL']) {
        expect(t.errors[text], `${id}: ${text}`).toBeTruthy()
      }
      expect(translateMessage(t, 'something else')).toBe('something else')
    }
    expect(translateMessage(MESSAGES['zh-CN'], TOO_LONG_MESSAGE)).toBe('网址太长，无法可靠扫描')
  })
})
