import { describe, expect, it } from 'vitest'
import { colorsOf, hexRgb } from './palettes'
import { branchTones } from './treeAppearance'
import { VIEW_PITCH } from './tree'
import { OVERHEAD } from './view'

describe('branchTones', () => {
  const colors = colorsOf('autumn', 'default')

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
