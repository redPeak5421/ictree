import { describe, expect, it } from 'vitest'
import { colorsOf, hexRgb } from './palettes'
import { branchTones, leafLuma, SHOWCASE_LEAF_LUMA } from './treeAppearance'
import { VIEW_PITCH } from './tree'
import { OVERHEAD } from './view'

describe('branchTones', () => {
  const colors = colorsOf('autumn', 'cherry')

  it('uses natural brown wood in the oblique showcase view', () => {
    const tones = branchTones(colors, VIEW_PITCH)

    for (const tone of tones) {
      const [r, g, b] = hexRgb(tone)
      expect(r).toBeGreaterThan(g)
      expect(g).toBeGreaterThan(b)
      expect(r + g + b).toBeLessThan(390)
    }
    expect(new Set(tones).size).toBe(2)
  })

  it('returns to QR-safe pale wood at the overhead scan view', () => {
    expect(branchTones(colors, OVERHEAD)).toEqual([colors.trunk, colors.trunk])
  })
})

describe('leafLuma', () => {
  const ink = 0.418

  it('is exactly the pinned ink at the overhead scan view', () => {
    expect(leafLuma(colorsOf('autumn', 'maple').foliage, ink, OVERHEAD)).toBe(ink)
    expect(leafLuma(colorsOf('spring', 'cherry').foliage, ink, OVERHEAD)).toBe(ink)
  })

  it('lets bright tones brighten in the oblique showcase, capped', () => {
    const maple = leafLuma(colorsOf('autumn', 'maple').foliageVar, ink, VIEW_PITCH)
    const spring = leafLuma(colorsOf('spring', 'cherry').foliage, ink, VIEW_PITCH)
    expect(maple).toBeGreaterThan(ink + 0.1)
    expect(spring).toBeGreaterThan(ink + 0.1)
    expect(maple).toBeLessThanOrEqual(SHOWCASE_LEAF_LUMA)
    expect(spring).toBeLessThanOrEqual(SHOWCASE_LEAF_LUMA)
  })

  it('never lifts a tone that is naturally darker than the ink', () => {
    expect(leafLuma(colorsOf('autumn', 'pine').foliage, ink, VIEW_PITCH)).toBe(ink)
  })

  it('keeps spring paler than summer from the side', () => {
    const spring = leafLuma(colorsOf('spring', 'apple').foliage, ink + 0.03, VIEW_PITCH)
    const summer = leafLuma(colorsOf('summer', 'apple').foliage, ink, VIEW_PITCH)
    expect(spring).toBeGreaterThan(summer + 0.04)
  })
})
