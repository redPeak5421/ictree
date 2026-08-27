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
 * Luma a dark module sits at, per jitter bucket. The paving under the tree is
 * ~0.88 and the page cream 0.95, so this band keeps close to 2:1 contrast with
 * room for a decoder's local threshold to land between, while staying bright
 * enough for the seasons to read as colour rather than shadow.
 */
function inkLuma(bucket: number): number {
  return 0.4 + (bucket & 3) * 0.024
}

/** Recolour `hex` to sit at exactly `luma`, keeping its hue. */
export function toLumaHex(hex: string, luma: number): string {
  const [r, g, b] = setLuma(hexRgb(hex), luma)
  return rgbHex(r, g, b)
}

function bucketOf(cell: ModuleCell): number {
  return ((cell.x * 73856093 + cell.y * 19349663) >>> 5) % 4
}

/**
 * The exact luma this module's stone settles at.
 *
 * The canopy reads its module's value from here so a leaf and the stone beneath
 * it differ in hue but not in brightness. Decoders threshold on luma, and
 * jsQR's 8x8 adaptive binarizer will happily split a single module in two if the
 * leaf inside it is a different brightness from its background — which is what
 * broke scanning at high resolution while still decoding fine downscaled. Equal
 * luma keeps every module one flat block to a decoder and a visible leaf
 * silhouette to a person.
 */
/**
 * Which foliage tone the canopy uses over this module. Offset from the stone's
 * own bucket so the leaves stay legible against it.
 */
export function moduleToneIndex(cell: ModuleCell): number {
  return (bucketOf(cell) + 2) % 4
}

/** Tone for the patch behind the leaves — offset so the leaves stay legible. */
export function moduleStoneToneIndex(cell: ModuleCell): number {
  return bucketOf(cell)
}

export function moduleInkLuma(cell: ModuleCell): number {
  const bucket = bucketOf(cell)
  const structural = cell.kind === 'finder' || cell.kind === 'timing' || cell.kind === 'alignment'
  return structural ? 0.32 + bucket * 0.02 : inkLuma(bucket)
}

/**
 * Reference mosaic: dark modules spread across the whole seasonal ramp (the
 * gold tone pushed down to a dark luma is what reads as olive in autumn), and
 * the finders vary too instead of sitting flat. Luma is clamped on both sides
 * so the code stays inside a scannable contrast band.
 */
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
    ? [
        colors.finder,
        mixHex(colors.finder, colors.foliageVar, 0.45),
        colors.finder,
        mixHex(colors.finder, colors.accent, 0.3),
      ][bucket]!
    : tones[bucket]!

  // Jitter is chroma-only: the luma is pinned so the canopy can match it.
  const art = setLuma(jitter(hexRgb(baseHex), salt, structural ? 12 : 20), moduleInkLuma(cell))
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
