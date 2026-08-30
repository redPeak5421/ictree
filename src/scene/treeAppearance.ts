import { lumaOfHex } from '../qr/contrast'
import { mixHex, type SceneColors } from './palettes'
import { sceneryOpacity } from './view'

/**
 * Wood is natural and recessive in the oblique showcase view. Near overhead it
 * fades back to the pale QR-safe trunk colour so branches crossing light cells
 * cannot turn those cells into dark contamination.
 */
export function branchTones(colors: SceneColors, pitch: number): [string, string] {
  const showcase = sceneryOpacity(pitch)
  return [
    mixHex(colors.trunk, '#b38a64', 0.36 * showcase),
    mixHex(colors.trunk, '#a8825c', 0.28 * showcase),
  ]
}

/**
 * A leaf keeps its own brightness. Overhead used to crush every tone into the
 * QR ink band; pale spring and yellow maple then read as mud. The cream
 * island is the light module, so a light leaf may sit well above that band.
 */
export function leafLuma(hex: string, _ink: number, _pitch: number): number {
  return lumaOfHex(hex)
}
