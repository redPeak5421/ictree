import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PAYLOAD,
  MAX_PAYLOAD_CHARS,
  TOO_LONG_MESSAGE,
  defaultPayload,
  normalizePayload,
  payloadError,
} from './payload'

describe('normalizePayload', () => {
  it('uses the default site URL when input is empty', () => {
    expect(DEFAULT_PAYLOAD).toBe('https://www.example.com/')
    expect(normalizePayload('')).toBe(DEFAULT_PAYLOAD)
    expect(normalizePayload('   ')).toBe(DEFAULT_PAYLOAD)
  })

  it('prepends https:// only when the text looks like a host', () => {
    expect(normalizePayload('example.com')).toBe('https://example.com')
    expect(normalizePayload('www.example.com/a')).toBe('https://www.example.com/a')
    expect(normalizePayload('localhost:3000')).toBe('https://localhost:3000')
  })

  it('keeps plain text so a shared 你好 is not rewritten as a URL', () => {
    expect(normalizePayload('你好')).toBe('你好')
    expect(normalizePayload('hello')).toBe('hello')
    expect(normalizePayload('hello world')).toBe('hello world')
  })

  it('keeps an explicit http URL', () => {
    expect(normalizePayload('http://example.com/')).toBe('http://example.com/')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizePayload('  https://example.com/  ')).toBe('https://example.com/')
  })
})

describe('defaultPayload', () => {
  it('keeps example.com without an origin and on local hosts', () => {
    expect(defaultPayload()).toBe(DEFAULT_PAYLOAD)
    expect(defaultPayload('http://localhost:5173')).toBe(DEFAULT_PAYLOAD)
    expect(defaultPayload('http://127.0.0.1:5199')).toBe(DEFAULT_PAYLOAD)
    expect(defaultPayload('http://[::1]/')).toBe(DEFAULT_PAYLOAD)
  })

  it('uses the deployed origin', () => {
    expect(defaultPayload('https://ictree.example.workers.dev')).toBe('https://ictree.example.workers.dev/')
    expect(defaultPayload('https://grove.example.com/')).toBe('https://grove.example.com/')
  })
})

describe('payloadError', () => {
  it('rejects input longer than the scan-safe cap', () => {
    const raw = 'https://example.com/' + 'a'.repeat(MAX_PAYLOAD_CHARS)
    expect(payloadError(raw)).toBe(TOO_LONG_MESSAGE)
  })

  it('accepts a typical URL', () => {
    expect(payloadError('https://example.com/')).toBeNull()
  })
})
