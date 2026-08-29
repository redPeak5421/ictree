import { describe, expect, it } from 'vitest'
import { parseShareParams } from './params'
import { frameStillPayload, unframeStillPayload } from './stillEncode'

const SEARCH = '?u=https://example.com/a%20b&s=spring&t=maple'

describe('still payload framing', () => {
  it('frames and unframes the share search', () => {
    const framed = frameStillPayload(SEARCH)
    expect(unframeStillPayload(framed)).toBe(SEARCH)
    expect(parseShareParams(SEARCH)).toEqual({
      url: 'https://example.com/a b',
      season: 'spring',
      tree: 'maple',
      locked: false,
      mode: 'create',
    })
  })
})
