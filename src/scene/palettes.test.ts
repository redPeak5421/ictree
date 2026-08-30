import { describe, expect, it } from 'vitest'
import { colorsOf, foliageTones, grassTones, groundCoverOf, hexRgb, lerpColors, ornamentOf, type Season } from './palettes'
import { TREE_IDS } from './treeSpecies'

const SEASONS: Season[] = ['spring', 'summer', 'autumn']

function isGreenDominant(hex: string): boolean {
  const [r, g, b] = hexRgb(hex)
  return g > r + 20 && g > b
}

function isYellowDominant(hex: string): boolean {
  const [r, g, b] = hexRgb(hex)
  return r > b + 60 && g > b + 60
}

/** Perceived lightness of the raw tone, before the QR ink pin is applied. */
function luma(hex: string): number {
  const [r, g, b] = hexRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

describe('seasonal tree colours', () => {
  it('keeps every tree palest in spring and deeper afterwards', () => {
    for (const tree of TREE_IDS) {
      const spring = colorsOf('spring', tree)
      const summer = colorsOf('summer', tree)
      const autumn = colorsOf('autumn', tree)
      expect(luma(spring.foliage)).toBeGreaterThan(luma(summer.foliage))
      expect(luma(spring.foliageVar)).toBeGreaterThan(luma(summer.foliageVar))
      expect(luma(spring.finder)).toBeGreaterThan(luma(summer.finder))
      expect(luma(spring.finder)).toBeGreaterThan(luma(autumn.finder))
      expect(spring.inkLift).toBeGreaterThan(summer.inkLift)
      expect(summer.inkLift).toBeGreaterThanOrEqual(autumn.inkLift)
    }
  })

  it('turns the maple red and yellow only in autumn', () => {
    expect(isGreenDominant(colorsOf('spring', 'maple').foliage)).toBe(true)
    expect(isGreenDominant(colorsOf('summer', 'maple').foliage)).toBe(true)
    const autumn = colorsOf('autumn', 'maple')
    const [r, g, b] = hexRgb(autumn.foliage)
    expect(r).toBeGreaterThan(g + 80)
    expect(r).toBeGreaterThan(b + 120)
    expect(isYellowDominant(autumn.foliageVar)).toBe(true)
    expect(isGreenDominant(autumn.foliage)).toBe(false)
    const tones = foliageTones(autumn)
    expect(tones.some((hex) => isYellowDominant(hex))).toBe(true)
    expect(tones.some((hex) => { const [tr, tg] = hexRgb(hex); return tr > tg + 80 })).toBe(true)
  })

  it('gives the cherry pink blossom in spring and green leaves in summer', () => {
    const spring = colorsOf('spring', 'cherry')
    const [r, g] = hexRgb(spring.foliage)
    expect(r).toBeGreaterThan(g + 40)
    expect(isGreenDominant(colorsOf('summer', 'cherry').foliage)).toBe(true)
  })

  it('keeps apple, pine, and willow in leaf every season', () => {
    for (const tree of ['apple', 'pine', 'willow'] as const) {
      for (const season of SEASONS) {
        const { foliage } = colorsOf(season, tree)
        const [r, g, b] = hexRgb(foliage)
        expect(g).toBeGreaterThanOrEqual(r - 30)
        expect(g).toBeGreaterThan(b)
      }
    }
  })

  it('keeps the ink lift small enough to leave the code readable', () => {
    for (const tree of TREE_IDS) {
      for (const season of SEASONS) {
        expect(Math.abs(colorsOf(season, tree).inkLift)).toBeLessThanOrEqual(0.06)
      }
    }
  })

  it('cross-fades the ink lift with the colours', () => {
    const mid = lerpColors(colorsOf('spring', 'maple'), colorsOf('summer', 'maple'), 0.5)
    expect(mid.inkLift).toBeCloseTo(0.015, 6)
  })
})

describe('seasonal ornaments and ground cover', () => {
  it('keeps apples red without bleeding red into the apple leaves', () => {
    const autumn = colorsOf('autumn', 'apple')
    const [fr, fg, fb] = hexRgb(autumn.fruit)
    expect(fr).toBeGreaterThan(fg + 100)
    expect(fr).toBeGreaterThan(fb + 100)
    for (const hex of foliageTones(autumn)) {
      const [r, g] = hexRgb(hex)
      expect(g).toBeGreaterThanOrEqual(r - 20)
    }
    expect(colorsOf('spring', 'cherry').fruit).toBe(colorsOf('spring', 'cherry').accent)
  })

  it('fruits the apple only in autumn and leaves it bare otherwise', () => {
    expect(ornamentOf('spring', 'apple')).toBe('none')
    expect(ornamentOf('summer', 'apple')).toBe('none')
    expect(ornamentOf('autumn', 'apple')).toBe('fruit')
  })

  it('blossoms the cherry only in spring', () => {
    expect(ornamentOf('spring', 'cherry')).toBe('blossom')
    expect(ornamentOf('summer', 'cherry')).toBe('none')
    expect(ornamentOf('autumn', 'cherry')).toBe('none')
  })

  it('leaves maple, pine, and willow with only leaves', () => {
    for (const tree of ['maple', 'pine', 'willow'] as const) {
      for (const season of SEASONS) expect(ornamentOf(season, tree)).toBe('none')
    }
  })

  it('flowers the ground in spring and settles to meadow by autumn', () => {
    for (const tree of TREE_IDS) {
      expect(groundCoverOf('spring', tree)).toBe('flower')
      expect(groundCoverOf('autumn', tree)).toBe('meadow')
    }
    expect(groundCoverOf('summer', 'apple')).toBe('dandelion')
  })

  it('keeps turf in a mixed meadow, not a cartoon gold plate', () => {
    for (const season of ['spring', 'summer'] as const) {
      const { grass, grassTip } = colorsOf(season, 'apple')
      expect(isGreenDominant(grass)).toBe(true)
      expect(isGreenDominant(grassTip)).toBe(true)
      const tones = grassTones(colorsOf(season, 'apple'))
      expect(new Set(tones).size).toBe(4)
    }
    const autumn = colorsOf('autumn', 'apple')
    const [r, g, b] = hexRgb(autumn.grass)
    expect(g).toBeGreaterThanOrEqual(r - 6)
    expect(g).toBeGreaterThan(b + 20)
    expect(isYellowDominant(autumn.grass)).toBe(false)
  })
})
