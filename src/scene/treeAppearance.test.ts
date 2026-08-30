import { describe, expect, it } from 'vitest'
import { lumaOfHex } from '../qr/contrast'
import { colorsOf, hexRgb } from './palettes'
import { branchTones, leafLuma } from './treeAppearance'
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
      expect(r + g + b).toBeGreaterThan(420)
      expect(r + g + b).toBeLessThan(620)
    }
    expect(new Set(tones).size).toBe(2)
  })

  it('returns to QR-safe pale wood at the overhead scan view', () => {
    expect(branchTones(colors, OVERHEAD)).toEqual([colors.trunk, colors.trunk])
  })
})

describe('leafLuma', () => {
  it('keeps a leaf at its own brightness from above and from the side', () => {
    const hex = colorsOf('spring', 'cherry').foliage
    const natural = lumaOfHex(hex)
    expect(leafLuma(hex, 0.418, OVERHEAD)).toBeCloseTo(natural, 5)
    expect(leafLuma(hex, 0.418, VIEW_PITCH)).toBeCloseTo(natural, 5)
    expect(natural).toBeGreaterThan(0.7)
  })

  it('keeps spring paler than summer', () => {
    const spring = leafLuma(colorsOf('spring', 'apple').foliage, 0.45, OVERHEAD)
    const summer = leafLuma(colorsOf('summer', 'apple').foliage, 0.418, OVERHEAD)
    expect(spring).toBeGreaterThan(summer + 0.04)
  })
})
