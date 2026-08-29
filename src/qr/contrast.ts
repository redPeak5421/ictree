import { foliageTones, hexRgb, mixHex, rgbHex, type SceneColors } from '../scene/palettes'
import type { ModuleCell } from './types'

function luma(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

function setLuma(rgb: [number, number, number], target: number): [number, number, number] {
  const current = luma(rgb[0], rgb[1], rgb[2])
  if (current < 1e-4) {
    const v = target * 255
    return [v, v, v]
  }
  const s = target / current
  return [Math.min(255, rgb[0] * s), Math.min(255, rgb[1] * s), Math.min(255, rgb[2] * s)]
}

function jitter(
  rgb: [number, number, number],
  salt: number,
  amount: number,
): [number, number, number] {
  const j = (n: number) => {
    const t = (((Math.sin(salt * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1
    return (t - 0.5) * 2 * amount
  }
  return [rgb[0] + j(1), rgb[1] + j(2), rgb[2] + j(3)]
}

const CREAM = '#f2efe6'

/**
 * Tight ink band: neighbouring dark modules stay one colour family so the
 * mosaic reads as a lawn, not a bag of tiles.
 */
function inkLuma(bucket: number): number {
  return 0.418 + (bucket & 1) * 0.01
}

/** Recolour `hex` to sit at exactly `luma`, keeping its hue. */
export function toLumaHex(hex: string, luma: number): string {
  const [r, g, b] = setLuma(hexRgb(hex), luma)
  return rgbHex(r, g, b)
}

function bucketOf(cell: ModuleCell): number {
  return ((cell.x * 73856093 + cell.y * 19349663) >>> 5) % 4
}

export function moduleToneIndex(cell: ModuleCell): number {
  return (bucketOf(cell) + 2) % 4
}

export function moduleStoneToneIndex(cell: ModuleCell): number {
  return bucketOf(cell)
}

export function moduleInkLuma(cell: ModuleCell): number {
  const bucket = bucketOf(cell)
  const structural = cell.kind === 'finder' || cell.kind === 'timing' || cell.kind === 'alignment'
  return structural ? 0.33 + (bucket & 1) * 0.012 : inkLuma(bucket)
}

export function moduleRgb(
  cell: ModuleCell,
  colors: SceneColors,
  morphT: number,
): [number, number, number] {
  const salt = cell.x * 73856093 + cell.y * 19349663
  const bucket = bucketOf(cell)
  const stone = hexRgb(cell.dark ? colors.pathDark : colors.pathLight)

  if (!cell.dark) {
    const cream = hexRgb(CREAM)
    const mixed: [number, number, number] = [
      stone[0] + (cream[0] - stone[0]) * morphT,
      stone[1] + (cream[1] - stone[1]) * morphT,
      stone[2] + (cream[2] - stone[2]) * morphT,
    ]
    return setLuma(mixed, 0.78 + morphT * 0.15)
  }

  const structural = cell.kind === 'finder' || cell.kind === 'timing' || cell.kind === 'alignment'
  const tones = foliageTones(colors)
  const baseHex = structural
    ? mixHex(colors.finder, colors.foliage, bucket < 2 ? 0.06 : 0.14)
    : mixHex(tones[0]!, tones[2]!, bucket < 2 ? 0.18 : 0.42)

  const art = setLuma(jitter(hexRgb(baseHex), salt, structural ? 3 : 6), moduleInkLuma(cell))
  return [
    stone[0] + (art[0] - stone[0]) * morphT,
    stone[1] + (art[1] - stone[1]) * morphT,
    stone[2] + (art[2] - stone[2]) * morphT,
  ]
}

export function moduleHex(cell: ModuleCell, colors: SceneColors, morphT: number): string {
  const [r, g, b] = moduleRgb(cell, colors, morphT)
  return rgbHex(r, g, b)
}
