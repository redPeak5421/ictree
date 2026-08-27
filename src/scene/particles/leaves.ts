import { mulberry32 } from '../hash'

export interface FallingLeaf {
  x: number
  y: number
  z: number
  spin: number
  phase: number
  speed: number
}

export function createFallingLeaves(count: number, island: number, seed: number): FallingLeaf[] {
  const rng = mulberry32(seed)
  const list: FallingLeaf[] = []
  for (let i = 0; i < count; i++) {
    list.push({
      x: (rng() - 0.5) * island * 0.9,
      y: rng() * island * 1.2,
      z: (rng() - 0.5) * island * 0.9,
      spin: rng() * Math.PI * 2,
      phase: rng() * Math.PI * 2,
      speed: 0.4 + rng() * 0.5,
    })
  }
  return list
}

export function stepFallingLeaves(leaves: FallingLeaf[], dt: number, island: number, time: number) {
  for (const leaf of leaves) {
    leaf.y -= leaf.speed * dt
    leaf.x += Math.sin(time + leaf.phase) * dt * 0.4
    leaf.spin += dt
    if (leaf.y < 0.08) leaf.y = island * 1.1
  }
}
