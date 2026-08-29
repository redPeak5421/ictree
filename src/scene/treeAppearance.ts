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
    mixHex(colors.trunk, '#69472f', 0.72 * showcase),
    mixHex(colors.trunk, '#5d452f', 0.64 * showcase),
  ]
}

/** Brightest a leaf may get in the showcase; keeps pale spring tones from washing out. */
export const SHOWCASE_LEAF_LUMA = 0.66

/**
 * Canopy luma for a leaf whose colour is `hex`. Overhead it is exactly the
 * pinned QR ink; in the oblique showcase it relaxes toward the tone's natural
 * brightness, so an autumn maple reads yellow and spring reads pale from the
 * side while the scan from above is unchanged. Dark tones (pine) never lift.
 */
export function leafLuma(hex: string, ink: number, pitch: number): number {
  const showcase = sceneryOpacity(pitch)
  if (showcase <= 0) return ink
  const natural = Math.min(SHOWCASE_LEAF_LUMA, Math.max(ink, lumaOfHex(hex)))
  return ink + (natural - ink) * showcase * 0.85
}
