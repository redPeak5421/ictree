import { describe, expect, it } from 'vitest'
import { colorsOf } from '../scene/palettes'
import { encodeGrid } from './encode'
import { moduleRgb } from './contrast'

function luma(rgb: [number, number, number]): number {
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255
}

describe('module mosaic cohesion', () => {
  it('keeps neighbouring dark modules in a tight ink band', () => {
    const grid = encodeGrid('https://example.com/')
    const colors = colorsOf('summer', 'default')
    const dark = grid.cells.filter((cell) => cell.dark && cell.kind === 'dark')
    const lumas = dark.map((cell) => luma(moduleRgb(cell, colors, 1)))
    const min = Math.min(...lumas)
    const max = Math.max(...lumas)
    expect(max - min).toBeLessThanOrEqual(0.08)
    expect(min).toBeGreaterThanOrEqual(0.38)
    expect(max).toBeLessThanOrEqual(0.5)
  })

  it('does not paint the pink summer canopy green', () => {
    const grid = encodeGrid('https://example.com/')
    const colors = colorsOf('summer', 'default')
    const cell = grid.cells.find((item) => item.dark && item.kind === 'dark')!
    const [r, g] = moduleRgb(cell, colors, 1)
    expect(g).toBeLessThan(r + 12)
  })
})
