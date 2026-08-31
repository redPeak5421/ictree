/** Side-view wind fades out before overhead so the mosaic footprint is still. */
const WIND_FULL = 1.2
const WIND_DEAD = 1.45
const WIND_HEADING = 0.92

export function canopyWindFade(pitch: number): number {
  if (pitch >= WIND_DEAD) return 0
  if (pitch <= WIND_FULL) return 1
  return 1 - (pitch - WIND_FULL) / (WIND_DEAD - WIND_FULL)
}

export interface WindBend {
  tilt: number
  twist: number
  /** XZ displacement per unit height. Crown moves more than the bole. */
  lean: number
}

/** Low-frequency gust plus a faster flutter, shared by canopy and scenery. */
export function windBend(time: number, x: number, z: number): WindBend {
  const gust = 0.58 + 0.42 * Math.sin(time * 0.48 + x * 0.05 + z * 0.04)
  const wave = Math.sin(time * 1.25 + x * 0.18 + z * 0.14)
  const flutter = Math.sin(time * 2.6 + x * 0.7 + z * 0.55)
  const strength = gust * (0.72 + 0.28 * wave)
  return {
    tilt: strength * 0.32 + flutter * 0.05,
    twist: strength * 0.14 + flutter * 0.04,
    lean: strength * 0.085,
  }
}

export function windShift(lean: number, height: number): [number, number] {
  const mag = lean * Math.max(0, height)
  return [Math.sin(WIND_HEADING) * mag, Math.cos(WIND_HEADING) * mag]
}
