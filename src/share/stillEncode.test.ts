import { describe, expect, it } from 'vitest'
import { parseShareParams } from './params'
import { frameStillPayload, unframeStillPayload } from './stillEncode'

const SEARCH = '?u=https://example.com/a%20b&s=spring&p=coral'

describe('still payload framing', () => {
  it('frames and unframes the share search', () => {
    const framed = frameStillPayload(SEARCH)
    expect(unframeStillPayload(framed)).toBe(SEARCH)
    expect(parseShareParams(SEARCH)).toEqual({
      url: 'https://example.com/a b',
      season: 'spring',
      palette: 'coral',
      locked: false,
      mode: 'create',
    })
  })
})
