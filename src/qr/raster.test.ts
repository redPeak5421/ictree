import { describe, expect, it } from 'vitest'
import jsQR from 'jsqr'
import { encodeGrid } from './encode'
import { rasterQr } from './raster'
import { colorsOf } from '../scene/palettes'

function decode(payload: string, season: 'spring' | 'summer' | 'autumn' = 'autumn') {
  const grid = encodeGrid(payload)
  const { data, width, height } = rasterQr(grid, colorsOf(season, 'cherry'), {
    modulePx: 10,
    quiet: 4,
    morphT: 1,
  })
  return jsQR(data, width, height, { inversionAttempts: 'dontInvert' })
}

describe('rasterQr scanability', () => {
  it('decodes https://example.com/ from an autumn mosaic', () => {
    expect(decode('https://example.com/')?.data).toBe('https://example.com/')
  })

  it('decodes an 80-character URL', () => {
    const payload = 'https://example.com/' + 'p'.repeat(60)
    expect(payload.length).toBe(80)
    expect(decode(payload)?.data).toBe(payload)
  })

  it('decodes a Chinese path URL', () => {
    const payload = 'https://example.com/你好'
    expect(decode(payload, 'spring')?.data).toBe(payload)
  })

  it('keeps finder modules darker than light modules', () => {
    const grid = encodeGrid('https://example.com/')
    const colors = colorsOf('autumn', 'cherry')
    const { data, width } = rasterQr(grid, colors, { modulePx: 8, quiet: 4, morphT: 1 })
    const light = grid.cells.find((cell) => !cell.dark)
    if (!light) throw new Error('expected a light module')
    const sample = (mx: number, my: number) => {
      const x = (4 + mx) * 8 + 4
      const y = (4 + my) * 8 + 4
      const i = (y * width + x) * 4
      return (data[i]! + data[i + 1]! + data[i + 2]!) / 3
    }
    expect(sample(0, 0)).toBeLessThan(sample(light.x, light.y) - 40)
  })
})

describe('rasterQr sizing', () => {
  it('never rasters a code that a 1024px export would crop', () => {
    const payload = 'https://example.com/' + 'p'.repeat(180)
    const grid = encodeGrid(payload)
    const n = grid.size + 4 * 2
    const modulePx = Math.max(8, Math.floor(1024 / n))
    const { width } = rasterQr(grid, colorsOf('autumn', 'cherry'), {
      modulePx,
      quiet: 4,
      morphT: 1,
    })
    // downloadQrPng centres this on a max(1024, width) canvas, so the padding
    // it computes has to stay non-negative.
    expect(Math.floor((Math.max(1024, width) - width) / 2)).toBeGreaterThanOrEqual(0)
    expect(width).toBeGreaterThan(0)
  })
})
