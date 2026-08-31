import { describe, expect, it } from 'vitest'
import { buildShareSearch, parseShareParams } from './params'
import { wrapSecret } from './secret'

describe('share params', () => {
  it('round-trips url, season, tree, lock, and mode', () => {
    const search = buildShareSearch({
      url: 'https://example.com/a b',
      season: 'spring',
      tree: 'maple',
      locked: true,
      mode: 'reveal',
      ink: 'blocks',
    })
    expect(search).toContain('t=maple')
    expect(search).toContain('k=b')
    expect(parseShareParams(search)).toEqual({
      url: 'https://example.com/a b',
      season: 'spring',
      tree: 'maple',
      locked: true,
      mode: 'reveal',
      ink: 'blocks',
    })
  })

  it('falls back to defaults for missing or invalid values', () => {
    expect(parseShareParams('')).toEqual({
      url: '',
      season: 'autumn',
      tree: 'cherry',
      locked: false,
      mode: 'create',
      ink: 'plants',
    })
    expect(parseShareParams('?s=winter&t=banana&u=ok')).toEqual({
      url: 'ok',
      season: 'autumn',
      tree: 'cherry',
      locked: false,
      mode: 'create',
      ink: 'plants',
    })
    expect(parseShareParams('?u=gv2.abc&s=summer')).toEqual({
      url: 'gv2.abc',
      season: 'summer',
      tree: 'cherry',
      locked: true,
      mode: 'reveal',
      ink: 'plants',
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
      ink: 'plants',
    })
    expect(search).toContain('u=%E4%BD%A0%E5%A5%BD')
    expect(parseShareParams(search).url).toBe('你好')
  })

  it('opens a colour-block grove from k=b and defaults to plants', () => {
    expect(parseShareParams('?u=ok&k=b').ink).toBe('blocks')
    expect(parseShareParams('?u=ok').ink).toBe('plants')
    expect(buildShareSearch({
      url: 'ok',
      season: 'autumn',
      tree: 'cherry',
      locked: false,
      mode: 'create',
      ink: 'plants',
    })).not.toContain('k=')
  })

  it('round-trips seamless blocks through k=s', () => {
    expect(parseShareParams('?u=ok&k=s').ink).toBe('solid')
    const search = buildShareSearch({
      url: 'ok',
      season: 'autumn',
      tree: 'cherry',
      locked: false,
      mode: 'create',
      ink: 'solid',
    })
    expect(search).toContain('k=s')
    expect(parseShareParams(search).ink).toBe('solid')
  })

  it('round-trips a binary wrapped token in the share search', async () => {
    const token = await wrapSecret('https://example.com/a b', 'grove')
    const search = buildShareSearch({
      url: token,
      season: 'autumn',
      tree: 'cherry',
      locked: true,
      mode: 'reveal',
      ink: 'plants',
    })
    expect(parseShareParams(search).url).toBe(token)
    expect(parseShareParams(search).locked).toBe(true)
  })
})
