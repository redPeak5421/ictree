import { describe, expect, it } from 'vitest'
import { encodeGrid } from '../qr/encode'
import { hashString, mulberry32 } from './hash'
import {
  FRUIT_ORNAMENT_COUNT,
  onePerModule,
  pickFruitOrnaments,
  scatterEven,
  scatterRandom,
} from './scatter'
import { buildTree } from './tree'

function nearest(points: readonly { x: number; z: number }[]): number {
  let best = Infinity
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = Math.hypot(points[i]!.x - points[j]!.x, points[i]!.z - points[j]!.z)
      if (d < best) best = d
    }
  }
  return best
}

describe('scatterEven', () => {
  it('spreads a handful of picks around a grid instead of letting them clump', () => {
    const items: { x: number; z: number }[] = []
    for (let x = 0; x < 12; x++) for (let z = 0; z < 12; z++) items.push({ x, z })
    const picked = scatterEven(items, (item) => item, mulberry32(7), {
      share: 0.08,
      max: 24,
      minDist: 2.7,
      minFloor: 2,
      sectors: 6,
    })
    expect(picked.length).toBeGreaterThanOrEqual(8)
    expect(picked.length).toBeLessThanOrEqual(24)
    expect(nearest(picked)).toBeGreaterThanOrEqual(2)
  })
})

describe('scatterRandom', () => {
  it('keeps a fixed count of shuffled items with a gap', () => {
    const items: { x: number; z: number }[] = []
    for (let x = 0; x < 12; x++) for (let z = 0; z < 12; z++) items.push({ x, z })
    const a = scatterRandom(items, (item) => item, mulberry32(3), { count: 36, minDist: 1.8, minFloor: 1.2 })
    const b = scatterRandom(items, (item) => item, mulberry32(11), { count: 36, minDist: 1.8, minFloor: 1.2 })
    expect(a).toHaveLength(36)
    expect(b).toHaveLength(36)
    expect(a).not.toEqual(b)
    expect(nearest(a)).toBeGreaterThanOrEqual(1.2)
  })
})

describe('apple fruit scatter', () => {
  const grid = encodeGrid('https://example.com/tree-1')
  const apple = buildTree(grid, hashString(grid.payload), { species: 'apple' })

  it('does not paint whole modules as fruit', () => {
    expect(apple.leaves.some((leaf) => leaf.shape === 'appleHeap')).toBe(false)
    expect(apple.filler.some((leaf) => leaf.shape === 'appleHeap')).toBe(false)
  })

  it('hangs thirty-six apples at random, far fewer than the leaves', () => {
    const hosts = pickFruitOrnaments(apple.filler)
    const keys = hosts.map((leaf) => `${Math.round(leaf.position[0])},${Math.round(leaf.position[2])}`)
    expect(new Set(keys).size).toBe(hosts.length)
    expect(hosts).toHaveLength(FRUIT_ORNAMENT_COUNT)
    expect(hosts.length).toBeLessThan(apple.leaves.length / 20)
    expect(hosts.length).toBeLessThan(apple.filler.length / 40)
    expect(onePerModule(apple.filler).length).toBeGreaterThan(FRUIT_ORNAMENT_COUNT)
    expect(nearest(hosts.map((leaf) => ({ x: leaf.position[0], z: leaf.position[2] })))).toBeGreaterThanOrEqual(1.2)
  })

  it('picks the same hanging apples for the same crown', () => {
    expect(pickFruitOrnaments(apple.filler)).toEqual(pickFruitOrnaments(apple.filler))
  })
})
