import { describe, expect, it } from 'vitest'
import { colorsOf, hexRgb } from '../scene/palettes'
import { isCornerCell, isEdgeCell, isGrassCell } from '../scene/treeSpecies'
import { encodeGrid } from './encode'
import { lumaOfHex, moduleFillHex, moduleRgb, moduleViewHex } from './contrast'

/** The grey a decoder sees: the brighter of the BT.601 and BT.709 conversions. */
function luma([r, g, b]: [number, number, number]): number {
  return Math.max(
    (0.299 * r + 0.587 * g + 0.114 * b) / 255,
    (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255,
  )
}

function dist(hex: string, rgb: [number, number, number]): number {
  const [r, g, b] = hexRgb(hex)
  return Math.hypot(r - rgb[0], g - rgb[1], b - rgb[2])
}

describe('module mosaic colour', () => {
  it('keeps the tree hue instead of crushing every dark module into one ink grey', () => {
    const grid = encodeGrid('https://example.com/')
    const cell = grid.cells.find((item) => item.dark && item.kind === 'dark' && item.x > 8 && item.y > 8)!
    const spring = moduleRgb(cell, colorsOf('spring', 'cherry'), 1, grid.size)
    const summer = moduleRgb(cell, colorsOf('summer', 'cherry'), 1, grid.size)
    expect(spring[0]).toBeGreaterThan(spring[1] + 8)
    expect(summer[1]).toBeGreaterThan(summer[0] + 8)
    expect(luma(spring)).toBeGreaterThan(0.4)
    expect(luma(spring)).toBeLessThan(0.5)
  })

  it('keeps a pale spring canopy well above the old ink band', () => {
    const hex = colorsOf('spring', 'cherry').foliage
    expect(lumaOfHex(hex)).toBeGreaterThan(0.7)
  })

  it('keeps light modules cream-bright and darker modules below the field', () => {
    const grid = encodeGrid('https://example.com/')
    const colors = colorsOf('autumn', 'maple')
    const dark = grid.cells.find((cell) => cell.dark)!
    const light = grid.cells.find((cell) => !cell.dark)!
    const darkL = luma(moduleRgb(dark, colors, 1, grid.size))
    const lightL = luma(moduleRgb(light, colors, 1, grid.size))
    expect(lightL).toBeGreaterThan(0.85)
    expect(darkL).toBeLessThan(lightL - 0.08)
  })

  it('paints meadow tiles as solid grass and canopy tiles as the tree', () => {
    const grid = encodeGrid('https://example.com/')
    const colors = colorsOf('autumn', 'maple')
    const grass = grid.cells.find((cell) => cell.dark && isEdgeCell(cell.x, cell.y, grid.size))!
    const canopy = grid.cells.find((cell) => cell.dark && !isGrassCell(cell.x, cell.y, grid.size))!
    const grassRgb = moduleRgb(grass, colors, 1, grid.size)
    const canopyRgb = moduleRgb(canopy, colors, 1, grid.size)
    expect(Math.min(dist(colors.grass, grassRgb), dist(colors.grassTip, grassRgb))).toBeLessThan(
      dist(colors.foliage, grassRgb),
    )
    expect(dist(colors.foliage, canopyRgb)).toBeLessThan(dist(colors.grass, canopyRgb))
    expect(moduleFillHex(grass, colors, grid.size)).not.toBe(moduleFillHex(canopy, colors, grid.size))
  })

  it('paints finder corners in the tree family, not a second green QR', () => {
    const grid = encodeGrid('https://example.com/')
    const colors = colorsOf('spring', 'cherry')
    const finder = grid.cells.find((cell) => cell.dark && isCornerCell(cell.x, cell.y, grid.size))!
    const rgb = moduleRgb(finder, colors, 1, grid.size)
    expect(dist(colors.finder, rgb)).toBeLessThan(dist(colors.grass, rgb))
    expect(rgb[0]).toBeGreaterThan(rgb[1] + 8)
  })

  it('keeps autumn maple yellow a leaf colour on screen, not a crushed brown', () => {
    const grid = encodeGrid('https://example.com/')
    const colors = colorsOf('autumn', 'maple')
    const probes = Array.from({ length: grid.size * grid.size }, (_, i) => ({
      x: i % grid.size,
      y: Math.floor(i / grid.size),
      dark: true,
      kind: 'dark' as const,
    })).filter((cell) => !isGrassCell(cell.x, cell.y, grid.size))
    const scan = probes.map((cell) => lumaOfHex(moduleFillHex(cell, colors, grid.size)))
    const view = probes.map((cell) => lumaOfHex(moduleViewHex(cell, colors, grid.size)))
    expect(Math.max(...scan)).toBeLessThan(0.46)
    expect(Math.max(...view)).toBeGreaterThan(0.52)
    expect(Math.max(...view)).toBeLessThan(0.59)
    expect(Math.min(...view)).toBeLessThan(0.45)
    expect(Math.max(...view)).toBeGreaterThan(Math.max(...scan))
  })

  it('does not wash grass and canopy into one shared fill', () => {
    const grid = encodeGrid('https://example.com/')
    const colors = colorsOf('autumn', 'maple')
    const fills = new Set(
      grid.cells.filter((cell) => cell.dark).map((cell) => moduleFillHex(cell, colors, grid.size)),
    )
    expect(fills.size).toBeGreaterThan(2)
  })
})
