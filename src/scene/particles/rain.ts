import { mulberry32 } from '../hash'

export interface RainDrop {
  x: number
  y: number
  z: number
  speed: number
  len: number
}

const TOP = 2.4
const SPAN = 2.2

export function createRain(count: number, island: number, seed: number): RainDrop[] {
  const rng = mulberry32(seed)
  const span = island * SPAN
  const list: RainDrop[] = []
  for (let i = 0; i < count; i++) {
    list.push({
      x: (rng() - 0.5) * span,
      y: rng() * island * TOP,
      z: (rng() - 0.5) * span,
      speed: 16 + rng() * 16,
      len: 1.5 + rng() * 1.8,
    })
  }
  return list
}

export function stepRain(drops: RainDrop[], dt: number, island: number) {
  const top = island * TOP
  for (const drop of drops) {
    drop.y -= drop.speed * dt
    if (drop.y < -0.2) drop.y = top
  }
}
