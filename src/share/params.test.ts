import { describe, expect, it } from 'vitest'
import { buildShareSearch, parseShareParams } from './params'

describe('share params', () => {
  it('round-trips url, season, tree, lock, and mode', () => {
    const search = buildShareSearch({
      url: 'https://example.com/a b',
      season: 'spring',
      tree: 'maple',
      locked: true,
      mode: 'reveal',
    })
    expect(search).toContain('t=maple')
    expect(parseShareParams(search)).toEqual({
      url: 'https://example.com/a b',
      season: 'spring',
      tree: 'maple',
      locked: true,
      mode: 'reveal',
    })
  })

  it('falls back to defaults for missing or invalid values', () => {
    expect(parseShareParams('')).toEqual({
      url: '',
      season: 'autumn',
      tree: 'cherry',
      locked: false,
      mode: 'create',
    })
    expect(parseShareParams('?s=winter&t=banana&u=ok')).toEqual({
      url: 'ok',
      season: 'autumn',
      tree: 'cherry',
      locked: false,
      mode: 'create',
    })
    expect(parseShareParams('?u=gv1.abc&s=summer')).toEqual({
      url: 'gv1.abc',
      season: 'summer',
      tree: 'cherry',
      locked: true,
      mode: 'reveal',
    })
  })

  it('opens links minted with the old palette swatches on the tree they showed', () => {
    expect(parseShareParams('?u=ok&p=coral').tree).toBe('maple')
    expect(parseShareParams('?u=ok&p=gold').tree).toBe('apple')
    expect(parseShareParams('?u=ok&p=snow').tree).toBe('pine')
    expect(parseShareParams('?u=ok&p=lavender').tree).toBe('willow')
    expect(parseShareParams('?u=ok&p=default').tree).toBe('cherry')
    expect(parseShareParams('?u=ok&p=coral&t=pine').tree).toBe('pine')
  })

  it('round-trips a plain-text payload without adding a scheme', () => {
    const search = buildShareSearch({
      url: '你好',
      season: 'autumn',
      tree: 'cherry',
      locked: false,
      mode: 'create',
    })
    expect(search).toContain('u=%E4%BD%A0%E5%A5%BD')
    expect(parseShareParams(search).url).toBe('你好')
  })
})
