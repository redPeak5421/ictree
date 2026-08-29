import { describe, expect, it } from 'vitest'
import { buildShareSearch, parseShareParams } from './params'

describe('share params', () => {
  it('round-trips url, season, palette, lock, and mode', () => {
    const search = buildShareSearch({
      url: 'https://example.com/a b',
      season: 'spring',
      palette: 'coral',
      locked: true,
      mode: 'reveal',
    })
    expect(parseShareParams(search)).toEqual({
      url: 'https://example.com/a b',
      season: 'spring',
      palette: 'coral',
      locked: true,
      mode: 'reveal',
    })
  })

  it('falls back to defaults for missing or invalid values', () => {
    expect(parseShareParams('')).toEqual({
      url: '',
      season: 'autumn',
      palette: 'default',
      locked: false,
      mode: 'create',
    })
    expect(parseShareParams('?s=winter&p=neon&u=ok&t=willow')).toEqual({
      url: 'ok',
      season: 'autumn',
      palette: 'default',
      locked: false,
      mode: 'create',
    })
    expect(parseShareParams('?u=gv1.abc&s=summer')).toEqual({
      url: 'gv1.abc',
      season: 'summer',
      palette: 'default',
      locked: true,
      mode: 'reveal',
    })
  })

  it('round-trips a plain-text payload without adding a scheme', () => {
    const search = buildShareSearch({
      url: '你好',
      season: 'autumn',
      palette: 'default',
      locked: false,
      mode: 'create',
    })
    expect(search).toContain('u=%E4%BD%A0%E5%A5%BD')
    expect(parseShareParams(search).url).toBe('你好')
  })
})
