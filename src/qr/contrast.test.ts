import { describe, expect, it } from 'vitest'
import { colorsOf } from '../scene/palettes'
import { encodeGrid } from './encode'
import { moduleRgb } from './contrast'

/** The grey a decoder sees: the brighter of the BT.601 and BT.709 conversions, as `contrast.ts` pins it. */
function luma([r, g, b]: [number, number, number]): number {
  return Math.max(
    (0.299 * r + 0.587 * g + 0.114 * b) / 255,
    (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255,
  )
}

describe('module mosaic cohesion', () => {
  it('keeps neighbouring dark modules in a tight ink band', () => {
    const grid = encodeGrid('https://example.com/')
    const colors = colorsOf('summer', 'cherry')
    const dark = grid.cells.filter((cell) => cell.dark && cell.kind === 'dark')
    const lumas = dark.map((cell) => luma(moduleRgb(cell, colors, 1)))
    const min = Math.min(...lumas)
    const max = Math.max(...lumas)
    expect(max - min).toBeLessThanOrEqual(0.08)
    expect(min).toBeGreaterThanOrEqual(0.38)
    expect(max).toBeLessThanOrEqual(0.5)
  })

  it('keeps the spring cherry pink and the summer cherry green in the mosaic', () => {
    const grid = encodeGrid('https://example.com/')
    const cell = grid.cells.find((item) => item.dark && item.kind === 'dark')!
    const [sr, sg] = moduleRgb(cell, colorsOf('spring', 'cherry'), 1)
    expect(sr).toBeGreaterThan(sg + 12)
    const [ur, ug] = moduleRgb(cell, colorsOf('summer', 'cherry'), 1)
    expect(ug).toBeGreaterThan(ur + 12)
  })

  it('lifts the spring mosaic a shade paler than summer without leaving the ink band', () => {
    const grid = encodeGrid('https://example.com/')
    const cell = grid.cells.find((item) => item.dark && item.kind === 'dark')!
    const spring = luma(moduleRgb(cell, colorsOf('spring', 'maple'), 1))
    const summer = luma(moduleRgb(cell, colorsOf('summer', 'maple'), 1))
    const autumn = luma(moduleRgb(cell, colorsOf('autumn', 'maple'), 1))
    expect(spring).toBeGreaterThan(summer + 0.02)
    expect(autumn).toBeLessThan(summer)
    expect(spring).toBeLessThanOrEqual(0.5)
  })
})
