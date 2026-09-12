import { mulberry32 } from '../hash'

export interface SummerMote {
  x: number
  y: number
  z: number
  spin: number
  phase: number
  speed: number
  pulse: number
  drift: number
}

export function createSummerMotes(count: number, island: number, seed: number): SummerMote[] {
  const rng = mulberry32(seed)
  const list: SummerMote[] = []
  for (let i = 0; i < count; i++) {
    list.push({
      x: (rng() - 0.5) * island * 0.95,
      y: 0.4 + rng() * island * 1.15,
      z: (rng() - 0.5) * island * 0.95,
      spin: rng() * Math.PI * 2,
      phase: rng() * Math.PI * 2,
      speed: 0.12 + rng() * 0.22,
      pulse: 1.1 + rng() * 1.6,
      drift: 0.18 + rng() * 0.28,
    })
  }
  return list
}

export function stepSummerMotes(motes: SummerMote[], dt: number, island: number, time: number) {
  const half = island * 0.52
  const top = island * 1.2
  for (const mote of motes) {
    mote.y += Math.sin(time * mote.pulse + mote.phase) * dt * 0.22
    mote.x += Math.cos(time * 0.45 + mote.phase) * dt * mote.drift
    mote.z += Math.sin(time * 0.38 + mote.phase * 1.3) * dt * mote.drift * 0.7
    mote.spin += dt * mote.speed
    if (mote.y < 0.15) mote.y = top
    if (mote.y > top) mote.y = 0.2
    if (mote.x > half) mote.x = -half
    if (mote.x < -half) mote.x = half
    if (mote.z > half) mote.z = -half
    if (mote.z < -half) mote.z = half
  }
}

export function summerMotePulse(mote: SummerMote, time: number): number {
  return 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(time * mote.pulse + mote.phase))
}
