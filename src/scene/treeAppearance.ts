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
