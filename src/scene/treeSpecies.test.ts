import { describe, expect, it } from 'vitest'
import { encodeGrid } from '../qr/encode'
import { hashString } from './hash'
import { halfExtents } from './leafShape'
import { buildTree } from './tree'
import {
  canopyShapeFor,
  crownLayout,
  edgeRingsFor,
  fillerShapeFor,
  isEdgeCell,
  isGrassCell,
  isTreeSpecies,
  leafShapeFor,
  profileFor,
  resolveTreeChoice,
  TREE_KINDS,
  type CrownPoint,
  type TreeSpecies,
} from './treeSpecies'

const FIXTURES = [
  ['https://example.com/tree-1', 'apple'],
  ['https://example.com/tree-2', 'maple'],
  ['https://example.com/tree-0', 'cherry'],
] as const satisfies readonly (readonly [string, TreeSpecies])[]

interface Metrics {
  extent: number
  highReach: number
  leftRight: number
  center: number
  middle: number
  outer: number
}

function metrics(points: CrownPoint[], size: number): Metrics {
  const island = size + 2
  const half = (size - 1) / 2
  const rows = points.map((point) => {
    const x = point.cell.x - half
    const z = point.cell.y - half
    return { ...point, x, z, radius: Math.min(1, Math.hypot(x, z) / half) }
  })
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
  const heights = rows.map((row) => row.height)
  const ranked = rows.slice().sort((a, b) => a.radius - b.radius)
  const band = (from: number, to: number) => {
    const slice = ranked.slice(Math.floor(from * ranked.length), Math.floor(to * ranked.length))
    return mean(slice.map((row) => row.height))
  }
  return {
    extent: (Math.max(...heights) - Math.min(...heights)) / island,
    highReach: Math.max(...rows.filter((row) => row.layer === 'high').map((row) => row.radius)),
    leftRight:
      Math.abs(
        mean(rows.filter((row) => row.x < 0).map((row) => row.height)) -
          mean(rows.filter((row) => row.x >= 0).map((row) => row.height)),
      ) / island,
    center: band(0, 1 / 3) / island,
    middle: band(1 / 3, 2 / 3) / island,
    outer: band(2 / 3, 1) / island,
  }
}

describe('tree species selection', () => {
  it('offers exactly the five plantable trees, in picker order', () => {
    expect(TREE_KINDS.map((kind) => kind.id)).toEqual(['cherry', 'apple', 'pine', 'willow', 'maple'])
    expect(TREE_KINDS.every((kind) => kind.label.length > 0)).toBe(true)
    expect(isTreeSpecies('maple')).toBe(true)
    expect(isTreeSpecies('banana')).toBe(false)
  })

  it('plants the tree the person picked, regardless of the payload', () => {
    for (const kind of TREE_KINDS) {
      expect(profileFor(kind.id).species).toBe(kind.id)
      expect(resolveTreeChoice('https://example.com/tree-1', kind.id)).toEqual({ species: kind.id, habit: 'lush' })
      expect(resolveTreeChoice('你好', kind.id).species).toBe(kind.id)
    }
    expect(resolveTreeChoice('https://example.com/tree-1').species).toBe('cherry')
  })

  it('builds every canopy leaf and filler from the species\' own shapes, never a generic leaf', () => {
    const grid = encodeGrid('https://example.com/tree-1')
    for (const kind of TREE_KINDS) {
      const rig = buildTree(grid, hashString(grid.payload), { species: kind.id })
      const canopy = canopyShapeFor(kind.id)
      const element = fillerShapeFor(kind.id)
      expect(rig.leaves.length).toBeGreaterThan(0)
      expect(rig.leaves.every((leaf) => leaf.shape === canopy)).toBe(true)
      expect(rig.filler.every((leaf) => leaf.shape === element)).toBe(true)
      expect(rig.filler.some((leaf) => leaf.shape.endsWith('Canopy'))).toBe(false)
    }
    expect(canopyShapeFor('pine')).toBe('pineCanopy')
    expect(canopyShapeFor('maple')).toBe('mapleCanopy')
    expect(leafShapeFor('pine')).toBe('pine')
    expect(fillerShapeFor('pine')).toBe('pineTwig')
    expect(fillerShapeFor('willow')).toBe('willowWithe')
    expect(fillerShapeFor('maple')).toBe('maple')
  })

  it('keeps apple coverage as leaves, never whole fruit-module heaps', () => {
    const grid = encodeGrid('https://example.com/tree-1')
    const apple = buildTree(grid, hashString(grid.payload), { species: 'apple' })
    expect(apple.leaves.every((leaf) => leaf.shape === canopyShapeFor('apple'))).toBe(true)
    expect(apple.filler.every((leaf) => leaf.shape === fillerShapeFor('apple'))).toBe(true)
    const maple = buildTree(grid, hashString(grid.payload), { species: 'maple' })
    expect(maple.leaves.some((leaf) => leaf.shape === 'appleHeap')).toBe(false)
  })

  it('hangs willow withes upright inside their module and angles pine twigs upward', () => {
    const grid = encodeGrid('https://example.com/tree-1')
    const half = (grid.size - 1) / 2
    const willow = buildTree(grid, hashString(grid.payload), { species: 'willow' })
    const withes = willow.filler.filter((leaf) => leaf.shape === 'willowWithe')
    expect(withes.length).toBeGreaterThan(willow.filler.length * 0.4)
    const isDark = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < grid.size && y < grid.size && grid.cells[y * grid.size + x]!.dark
    const [halfX, halfY] = halfExtents('willowWithe')
    let long = 0
    for (const withe of withes) {
      expect(Math.abs(withe.euler[0])).toBeLessThanOrEqual(0.06)
      const mx = Math.round(withe.position[0] + half)
      const my = Math.round(withe.position[2] + half)
      expect(isDark(mx, my)).toBe(true)
      expect(Math.abs(withe.position[0] + half - mx)).toBeLessThanOrEqual(0.3 + 1e-9)
      expect(Math.abs(withe.position[2] + half - my)).toBeLessThanOrEqual(0.3 + 1e-9)
      // Seen from above the upright withe is a line along its heading; both
      // ends (and the sliver its tilt projects) must stay on dark modules.
      const phi = withe.euler[1]
      const lean = halfY * Math.abs(Math.sin(withe.euler[0])) * withe.scale
      const dx = halfX * withe.scale * Math.cos(phi)
      const dz = halfX * withe.scale * Math.sin(phi)
      for (const [ex, ez] of [[dx, dz], [-dx, -dz], [lean * Math.sin(phi), lean * Math.cos(phi)], [-lean * Math.sin(phi), -lean * Math.cos(phi)]]) {
        const px = withe.position[0] + half + ex
        const pz = withe.position[2] + half + ez
        expect(isDark(Math.round(px), Math.round(pz)), `withe end at ${px.toFixed(2)},${pz.toFixed(2)}`).toBe(true)
      }
      if (withe.scale > 1.2) long++
    }
    expect(long).toBeGreaterThan(withes.length * 0.2)
    const pine = buildTree(grid, hashString(grid.payload), { species: 'pine' })
    const twigs = pine.filler.filter((leaf) => leaf.shape === 'pineTwig')
    expect(twigs.length).toBeGreaterThan(pine.filler.length * 0.4)
    for (const twig of twigs) {
      const tilt = twig.euler[0] + Math.PI / 2
      expect(tilt).toBeGreaterThanOrEqual(0.45)
      expect(tilt).toBeLessThanOrEqual(1.2)
    }
  })

  it('is deterministic and produces continuous, populated crown layers', () => {
    for (const [payload, species] of FIXTURES) {
      const grid = encodeGrid(payload)
      const first = crownLayout(grid, hashString(payload), species)
      const again = crownLayout(grid, hashString(payload), species)
      expect(again).toEqual(first)
      expect(new Set(first.map((point) => point.layer))).toEqual(new Set(['low', 'middle', 'high']))
      for (const layer of ['low', 'middle', 'high'] as const) {
        expect(first.filter((point) => point.layer === layer).length / first.length).toBeGreaterThanOrEqual(0.15)
      }
      expect(new Set(first.map((point) => point.height.toFixed(1))).size).toBeGreaterThanOrEqual(12)
      expect(first.every((point) => !isGrassCell(point.cell.x, point.cell.y, grid.size))).toBe(true)
    }
  })

  it('keeps the grassy QR rim at most two modules wide', () => {
    for (const size of [21, 25, 57]) {
      expect(edgeRingsFor(size)).toBeLessThanOrEqual(2)
    }
    const grid = encodeGrid('http://example.com/')
    expect(edgeRingsFor(grid.size)).toBe(2)
    for (const cell of grid.cells) {
      if (!isEdgeCell(cell.x, cell.y, grid.size)) continue
      const inward = Math.min(cell.x, cell.y, grid.size - 1 - cell.x, grid.size - 1 - cell.y)
      expect(inward).toBeLessThan(2)
    }
  })
})

describe('species crown profiles', () => {
  it('gives maple a tall rounded crown with a raised center', () => {
    const payload = FIXTURES[1][0]
    const grid = encodeGrid(payload)
    const value = metrics(crownLayout(grid, hashString(payload), 'maple'), grid.size)
    expect(value.extent).toBeGreaterThanOrEqual(0.48)
    expect(value.extent).toBeLessThanOrEqual(0.62)
    expect(value.center - value.outer).toBeGreaterThanOrEqual(0.12)
  })

  it('gives cherry a raised umbrella shoulder, center hollow, and lowered tips', () => {
    const payload = FIXTURES[2][0]
    const grid = encodeGrid(payload)
    const value = metrics(crownLayout(grid, hashString(payload), 'cherry'), grid.size)
    expect(value.extent).toBeGreaterThanOrEqual(0.4)
    expect(value.extent).toBeLessThanOrEqual(0.54)
    expect(value.middle - value.center).toBeGreaterThanOrEqual(0.04)
    expect(value.middle - value.outer).toBeGreaterThanOrEqual(0.05)
  })

  it('gives willow a hanging cascade with lowered tips', () => {
    const payload = FIXTURES[2][0]
    const grid = encodeGrid(payload)
    const value = metrics(crownLayout(grid, hashString(payload), 'willow'), grid.size)
    expect(value.extent).toBeGreaterThanOrEqual(0.38)
    expect(value.extent).toBeLessThanOrEqual(0.52)
    expect(value.middle - value.outer).toBeGreaterThanOrEqual(0.05)
  })

  it('gives pine a tall cone with a raised center', () => {
    const payload = FIXTURES[1][0]
    const grid = encodeGrid(payload)
    const value = metrics(crownLayout(grid, hashString(payload), 'pine'), grid.size)
    expect(value.extent).toBeGreaterThanOrEqual(0.52)
    expect(value.extent).toBeLessThanOrEqual(0.7)
    expect(value.center - value.outer).toBeGreaterThanOrEqual(0.1)
  })

  it('gives apple a rounded crown with a raised center', () => {
    const payload = FIXTURES[1][0]
    const grid = encodeGrid(payload)
    const apple = metrics(crownLayout(grid, hashString(payload), 'apple'), grid.size)
    expect(apple.center - apple.outer).toBeGreaterThanOrEqual(0.08)
    expect(apple.extent).toBeGreaterThanOrEqual(0.42)
    expect(apple.extent).toBeLessThanOrEqual(0.56)
  })
})
