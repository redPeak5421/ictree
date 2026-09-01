import { finderInkTones, foliageTones, hexRgb, rgbHex, type SceneColors } from '../scene/palettes'
import { isCornerCell, isGrassCell } from '../scene/treeSpecies'
import type { ModuleCell } from './types'

/**
 * Decoders do not agree on grey. ZXing weights green at 0.587 (Rec. 601);
 * jsQR and most camera pipelines weight it at 0.715 (Rec. 709), which makes a
 * green leaf read a full shade paler to them than to us. Pin to the brighter
 * of the two so every scanner sees the ink at or below the target.
 */
function luma(r: number, g: number, b: number): number {
  const bt601 = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const bt709 = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return Math.max(bt601, bt709)
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

const CREAM = '#f2efe6'

/**
 * Reserved for the tree's own ink samples. The 3D mosaic no longer crushes
 * every dark module into this band — pale spring stays pale.
 */
function inkLuma(bucket: number): number {
  return 0.418 + (bucket & 1) * 0.01
}

/** The grey a decoder would read `hex` as. */
export function lumaOfHex(hex: string): number {
  const [r, g, b] = hexRgb(hex)
  return luma(r, g, b)
}

/** Recolour `hex` to sit at exactly `luma`, keeping its hue. */
export function toLumaHex(hex: string, target: number): string {
  return rgbHex(...setLuma(hexRgb(hex), target))
}

function bucketOf(cell: ModuleCell): number {
  return ((cell.x * 73856093 + cell.y * 19349663) >>> 5) % 4
}

export function moduleInkLuma(cell: ModuleCell): number {
  const bucket = bucketOf(cell)
  const structural = cell.kind === 'finder' || cell.kind === 'timing' || cell.kind === 'alignment'
  return structural ? 0.33 + (bucket & 1) * 0.012 : inkLuma(bucket)
}

/**
 * Colour-block ink: meadow tiles are solid grass, canopy tiles are the
 * tree's own leaf colours. Families stay apart — no global wash.
 * 8px jsQR needs dark modules at or below 0.45. The on-screen tree is
 * much larger, so view tiles keep a paler cap and already-dark hues
 * stay as painted instead of being crushed to one muddy ink.
 */
const SCAN_LUMA = 0.45
const VIEW_LUMA = 0.58

function fillAt(hex: string, cap: number): string {
  return lumaOfHex(hex) <= cap ? hex : toLumaHex(hex, cap)
}

export function moduleFillHex(cell: ModuleCell, colors: SceneColors, size: number, cap = SCAN_LUMA): string {
  if (!cell.dark) return CREAM
  const bucket = bucketOf(cell)
  if (isCornerCell(cell.x, cell.y, size)) {
    const tone = finderInkTones(colors)[bucket]!
    return fillAt(toLumaHex(tone, lumaOfHex(colors.finder)), cap)
  }
  if (isGrassCell(cell.x, cell.y, size)) {
    return fillAt(bucket < 2 ? colors.grass : colors.grassTip, cap)
  }
  const tones = foliageTones(colors)
  return fillAt(tones[bucket]!, cap)
}

export function moduleViewHex(cell: ModuleCell, colors: SceneColors, size: number): string {
  return moduleFillHex(cell, colors, size, VIEW_LUMA)
}

export function moduleRgb(
  cell: ModuleCell,
  colors: SceneColors,
  morphT: number,
  size: number,
): [number, number, number] {
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

  const art = hexRgb(moduleFillHex(cell, colors, size))
  return [
    stone[0] + (art[0] - stone[0]) * morphT,
    stone[1] + (art[1] - stone[1]) * morphT,
    stone[2] + (art[2] - stone[2]) * morphT,
  ]
}

