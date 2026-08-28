import { describe, expect, it } from 'vitest'
import { buildShareSearch, parseShareParams } from './params'

describe('share params', () => {
  it('round-trips url, season, and palette', () => {
    const search = buildShareSearch({
      url: 'https://example.com/a b',
      season: 'spring',
      palette: 'coral',
      variety: 'maple',
    })
    expect(parseShareParams(search)).toEqual({
      url: 'https://example.com/a b',
      season: 'spring',
      palette: 'coral',
      variety: 'maple',
    })
  })

  it('falls back to defaults for missing or invalid values', () => {
    expect(parseShareParams('')).toEqual({
      url: '',
      season: 'autumn',
      palette: 'default',
      variety: 'auto',
    })
    expect(parseShareParams('?s=winter&p=neon&u=ok&t=willow')).toEqual({
      url: 'ok',
      season: 'autumn',
      palette: 'default',
      variety: 'auto',
    })
    expect(parseShareParams('?t=sparse')).toEqual({
      url: '',
      season: 'autumn',
      palette: 'default',
      variety: 'sparse',
    })
  })
})
