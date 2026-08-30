import { hexRgb, mixHex, type SceneColors } from '../scene/palettes'
import { moduleRgb } from './contrast'
import type { ModuleGrid } from './types'

export interface RasterOptions {
  modulePx: number
  quiet: number
  morphT: number
}

export function rasterQr(grid: ModuleGrid, colors: SceneColors, opts: RasterOptions) {
  const n = grid.size + opts.quiet * 2
  const width = n * opts.modulePx
  const height = width
  const data = new Uint8ClampedArray(width * height * 4)
  const cream = hexRgb(mixHex('#f4f1ea', colors.grass, 0.08 * (1 - opts.morphT)))
  const lookup = new Map(grid.cells.map((cell) => [`${cell.x},${cell.y}`, cell]))

  for (let gy = 0; gy < n; gy++) {
    for (let gx = 0; gx < n; gx++) {
      const qx = gx - opts.quiet
      const qy = gy - opts.quiet
      const inside = qx >= 0 && qy >= 0 && qx < grid.size && qy < grid.size
      const rgb = inside ? moduleRgb(lookup.get(`${qx},${qy}`)!, colors, opts.morphT, grid.size) : cream
      const x0 = gx * opts.modulePx
      const y0 = gy * opts.modulePx
      for (let py = 0; py < opts.modulePx; py++) {
        for (let px = 0; px < opts.modulePx; px++) {
          const i = ((y0 + py) * width + (x0 + px)) * 4
          data[i] = rgb[0]
          data[i + 1] = rgb[1]
          data[i + 2] = rgb[2]
          data[i + 3] = 255
        }
      }
    }
  }

  return { data, width, height }
}
