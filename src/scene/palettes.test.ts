import { describe, expect, it } from 'vitest'
import { colorsOf, finderInkTones, groundCoverOf, hexRgb, ornamentOf } from './palettes'
import { speciesForPalette } from './treeSpecies'

function isGreenDominant(hex: string): boolean {
  const [, g, b] = hexRgb(hex)
  const [r] = hexRgb(hex)
  return g > r + 20 && g > b
}

describe('palette themes', () => {
  it('keeps the pink swatch on the tree, not summer green', () => {
    const summer = colorsOf('summer', 'default')
    expect(isGreenDominant(summer.foliage)).toBe(false)
    expect(isGreenDominant(summer.finder)).toBe(false)
    expect(speciesForPalette('default')).toBe('cherry')
    expect(ornamentOf('spring', 'default')).toBe('blossom')
    expect(groundCoverOf('spring', 'default')).toBe('flower')
    expect(finderInkTones(summer).every((hex) => !isGreenDominant(hex))).toBe(true)
  })

  it('maps each swatch to a matching species', () => {
    expect(speciesForPalette('lavender')).toBe('cherry')
    expect(speciesForPalette('coral')).toBe('maple')
    expect(speciesForPalette('gold')).toBe('maple')
    expect(speciesForPalette('sky')).toBe('oak')
    expect(speciesForPalette('snow')).toBe('oak')
  })
})
