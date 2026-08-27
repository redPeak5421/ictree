import { mulberry32 } from '../hash'

export interface Petal {
  x: number
  y: number
  z: number
  spin: number
  phase: number
  speed: number
}

export function createPetals(count: number, island: number, seed: number): Petal[] {
  const rng = mulberry32(seed)
  const list: Petal[] = []
  for (let i = 0; i < count; i++) {
    list.push({
      x: (rng() - 0.5) * island,
      y: rng() * island * 1.4,
      z: (rng() - 0.5) * island,
      spin: rng() * Math.PI * 2,
      phase: rng() * Math.PI * 2,
      speed: 0.35 + rng() * 0.45,
    })
  }
  return list
}

export function stepPetals(petals: Petal[], dt: number, island: number, time: number) {
  for (const petal of petals) {
    petal.y -= petal.speed * dt
    petal.x += Math.sin(time * 0.7 + petal.phase) * dt * 0.6
    petal.spin += dt * 1.4
    if (petal.y < 0.05) {
      petal.y = island * 1.3
      petal.x = (Math.sin(petal.phase) * 0.5) * island
    }
  }
}
