import { describe, expect, it } from 'vitest'
import { buildShareSearch, parseShareParams } from './params'

describe('share params', () => {
  it('round-trips url, season, and palette', () => {
    const search = buildShareSearch({
      url: 'https://example.com/a b',
      season: 'spring',
      palette: 'coral',
    })
    expect(parseShareParams(search)).toEqual({
      url: 'https://example.com/a b',
      season: 'spring',
      palette: 'coral',
    })
  })

  it('falls back to defaults for missing or invalid values', () => {
    expect(parseShareParams('')).toEqual({
      url: '',
      season: 'autumn',
      palette: 'default',
    })
    expect(parseShareParams('?s=winter&p=neon&u=ok')).toEqual({
      url: 'ok',
      season: 'autumn',
      palette: 'default',
    })
  })
})
