import { describe, expect, it } from 'vitest'
import { encodeGrid } from '../qr/encode'
import { hashString } from './hash'
import { footprint } from './leafShape'
import {
  BLADE_H,
  BLADE_LEAN,
  BLADE_ROOT,
  BRANCH_OVERLAP,
  buildTree,
  isGrassModule,
  REACH,
  SEAM_OVERLAP,
  SLAB_H,
  type BranchInstance,
} from './tree'

const grid = encodeGrid('https://example.com/')
const choice = { species: 'maple' as const }
const tree = buildTree(grid, hashString(grid.payload), choice)
const half = (grid.size - 1) / 2
const isDark = (x: number, y: number) =>
  x >= 0 && y >= 0 && x < grid.size && y < grid.size && grid.cells[y * grid.size + x]!.dark

function rotateY(q: [number, number, number, number]): [number, number, number] {
  // Unit +Y rotated by quaternion q.
  const [x, y, z, w] = q
  return [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)]
}

function endpoints(b: BranchInstance): [number, number, number][] {
  const d = rotateY(b.quaternion)
  const h = b.scale[1] / BRANCH_OVERLAP / 2
  return [
    [b.position[0] - d[0] * h, b.position[1] - d[1] * h, b.position[2] - d[2] * h],
    [b.position[0] + d[0] * h, b.position[1] + d[1] * h, b.position[2] + d[2] * h],
  ]
}

describe('buildTree', () => {
  it('is deterministic for the same payload', () => {
    const again = buildTree(grid, hashString(grid.payload), choice)
    expect(tree.species).toBe('maple')
    expect(again.species).toBe(tree.species)
    expect(tree.branches.length).toBeGreaterThan(8)
    expect(tree.leaves.length).toBeGreaterThan(80)
    expect(again.leaves[0]).toEqual(tree.leaves[0])
    expect(again.finderGrass[0]).toEqual(tree.finderGrass[0])
    expect(again.branches[0]).toEqual(tree.branches[0])
  })

  it('grows the trunk from the island center', () => {
    const trunk = tree.branches[0]!
    expect(Math.abs(trunk.position[0])).toBeLessThan(0.6)
    expect(Math.abs(trunk.position[2])).toBeLessThan(0.6)
  })

  it('grows a trunk that tapers into finer limbs without becoming a chimney', () => {
    const trunks = tree.branches.filter((branch) => branch.shade === 0)
    const limbs = tree.branches.filter((branch) => branch.shade === 1)
    expect(trunks.length).toBeGreaterThan(0)
    const trunkR = Math.max(...trunks.map((branch) => branch.scale[0]))
    const twigR = Math.min(...limbs.map((branch) => branch.scale[0]))
    expect(trunkR).toBeGreaterThan(twigR * 3)
    expect(trunkR).toBeLessThan((grid.size + 2) * 0.042)
  })

  it('keeps every leaf over its own dark module, never over a light one', () => {
    for (const leaf of tree.leaves) {
      const [cx, cz] = leaf.cell
      const mx = Math.round(cx + half)
      const my = Math.round(cz + half)
      expect(isDark(mx, my)).toBe(true)
      // The flat footprint bounds the top-down outline at any lean, since
      // leaning only shrinks it; the heading is the second euler.
      const [ex, ez] = footprint(leaf.euler[1], leaf.shape).map((e) => e * leaf.scale) as [number, number]
      const left = leaf.position[0] - ex - cx
      const right = leaf.position[0] + ex - cx
      const back = leaf.position[2] - ez - cz
      const front = leaf.position[2] + ez - cz
      const eps = 1e-6
      // Into a dark neighbour freely; never into a light module.
      const reach = (x: number, y: number) => (isDark(x, y) ? SEAM_OVERLAP : 0)
      expect(left).toBeGreaterThanOrEqual(-0.5 - reach(mx - 1, my) - eps)
      expect(right).toBeLessThanOrEqual(0.5 + reach(mx + 1, my) + eps)
      expect(back).toBeGreaterThanOrEqual(-0.5 - reach(mx, my - 1) - eps)
      expect(front).toBeLessThanOrEqual(0.5 + reach(mx, my + 1) + eps)
      // And the centre itself always stays in its own module.
      expect(Math.abs(leaf.position[0] - cx)).toBeLessThan(0.5)
      expect(Math.abs(leaf.position[2] - cz)).toBeLessThan(0.5)
      // Never leaning past the horizontal, and never spun off its heading.
      expect(leaf.euler[0]).toBeGreaterThanOrEqual(-Math.PI / 2)
      expect(leaf.euler[0]).toBeLessThanOrEqual(-Math.PI / 2 + 0.75 + 1e-9)
      expect(leaf.euler[2]).toBe(0)
    }
  })

  it('covers every dark module: leaves inside the frame, turf on corners and rim', () => {
    const leafCells = new Set(
      tree.leaves.map((l) => `${l.cell[0]},${l.cell[1]}`),
    )
    const lawnCells = new Set(tree.lawns.map((l) => `${l.cell[0]},${l.cell[1]}`))
    for (const cell of grid.cells) {
      const key = `${cell.x - half},${cell.y - half}`
      const grass = isGrassModule(cell.x, cell.y, grid.size)
      expect(leafCells.has(key)).toBe(cell.dark && !grass)
      expect(lawnCells.has(key)).toBe(cell.dark && grass)
    }
  })

  it('assigns each dark module one crown layer and one unique thirteen-slot pack', () => {
    const byCell = new Map<string, typeof tree.leaves>()
    for (const leaf of tree.leaves) {
      const key = `${leaf.cell[0]},${leaf.cell[1]}`
      const entry = byCell.get(key) ?? []
      entry.push(leaf)
      byCell.set(key, entry)
    }
    const canopyModules = grid.cells.filter(
      (cell) => cell.dark && !isGrassModule(cell.x, cell.y, grid.size),
    ).length
    expect(tree.leaves).toHaveLength(canopyModules * 13)
    const layers = new Set<string>()
    const ownedHeights: number[] = []
    for (const leaves of byCell.values()) {
      expect(leaves).toHaveLength(13)
      expect(leaves.map((leaf) => leaf.slot).sort((a, b) => a - b)).toEqual([...Array(13).keys()])
      expect(new Set(leaves.map((leaf) => leaf.layer)).size).toBe(1)
      layers.add(leaves[0]!.layer)
      const ys = leaves.map((leaf) => leaf.position[1])
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(0.7)
      ownedHeights.push(ys.reduce((sum, y) => sum + y, 0) / ys.length)
    }
    expect(layers).toEqual(new Set(['low', 'middle', 'high']))
    expect(new Set(ownedHeights.map((height) => height.toFixed(1))).size).toBeGreaterThanOrEqual(20)
  })

  it('tilts coverage leaves enough to avoid horizontal plates without approaching vertical', () => {
    const coverage = tree.leaves
    const tilts = coverage.map((leaf) => leaf.euler[0] + Math.PI / 2)
    expect(Math.min(...tilts)).toBeGreaterThanOrEqual(0.05)
    expect(Math.max(...tilts)).toBeLessThanOrEqual(0.28)
    expect(tilts.reduce((sum, value) => sum + value, 0) / tilts.length).toBeGreaterThanOrEqual(0.14)
    expect(new Set(tilts.map((value) => value.toFixed(2))).size).toBeGreaterThanOrEqual(12)
  })

  it('caps branch clutter after removing duplicate vertical attractors', () => {
    const canopyModules = grid.cells.filter(
      (cell) => cell.dark && !isGrassModule(cell.x, cell.y, grid.size),
    ).length
    expect(tree.branches.length).toBeLessThanOrEqual(canopyModules * 6 + 80)
  })

  it('fills every grassy module with a grass carpet and a lush standing tuft', () => {
    expect(tree.finderCarpet).toHaveLength(tree.lawns.length * 13)
    expect(tree.finderGrass.length).toBeGreaterThan(tree.lawns.length * 20)
    const again = buildTree(grid, hashString(grid.payload), choice)
    expect(again.finderCarpet[0]).toEqual(tree.finderCarpet[0])
    expect(again.finderGrass[0]).toEqual(tree.finderGrass[0])
    for (const blade of tree.finderGrass) {
      expect(blade.height).toBeLessThanOrEqual(BLADE_H)
      expect(blade.lean).toBeGreaterThanOrEqual(0)
      expect(blade.lean).toBeLessThanOrEqual(BLADE_LEAN)
      expect(Math.hypot(blade.root[0] - blade.cell[0], blade.root[2] - blade.cell[1])).toBeLessThanOrEqual(BLADE_ROOT + 1e-9)
    }
    for (const leaf of tree.finderCarpet) {
      expect(Math.abs(leaf.position[0] - leaf.cell[0])).toBeLessThan(0.5)
      expect(Math.abs(leaf.position[2] - leaf.cell[1])).toBeLessThan(0.5)
      expect(leaf.scale).toBeGreaterThan(0)
    }
  })

  it('rounds the crown with deterministic ink-free filler', () => {
    const canopyModules = grid.cells.filter(
      (cell) => cell.dark && !isGrassModule(cell.x, cell.y, grid.size),
    ).length
    // Thick vertical stacks on each dark module, still bounded.
    expect(tree.filler.length).toBeGreaterThan(canopyModules * 12)
    expect(tree.filler.length).toBeLessThanOrEqual(canopyModules * 70 + tree.branches.length * 3 + 16)
    const again = buildTree(grid, hashString(grid.payload), choice)
    expect(again.filler.length).toBe(tree.filler.length)
    expect(again.filler[0]).toEqual(tree.filler[0])
    expect(tree.habit).toBe('lush')
    for (const leaf of tree.filler) {
      expect(leaf.position[1]).toBeGreaterThan(SLAB_H)
      expect(leaf.position[1] + leaf.scale * 0.5).toBeLessThanOrEqual(tree.crownTop + 1e-9)
      expect(leaf.scale).toBeGreaterThan(0)
      expect(leaf.shade).toBeGreaterThanOrEqual(0.74)
      expect(leaf.shade).toBeLessThanOrEqual(1.22)
      expect(leaf.ink).toBeGreaterThan(0)
      expect(leaf.ink).toBeLessThan(0.6)
      const mx = Math.round(leaf.position[0] + half)
      const my = Math.round(leaf.position[2] + half)
      expect(isDark(mx, my)).toBe(true)
    }
  })

  it('keeps the previous sparse habit thinner and still on dark modules', () => {
    const canopyModules = grid.cells.filter(
      (cell) => cell.dark && !isGrassModule(cell.x, cell.y, grid.size),
    ).length
    const sparse = buildTree(grid, hashString(grid.payload), { ...choice, habit: 'sparse' })
    expect(sparse.habit).toBe('sparse')
    expect(sparse.species).toBe(tree.species)
    expect(sparse.leaves).toHaveLength(tree.leaves.length)
    expect(sparse.filler.length).toBeGreaterThan(canopyModules)
    expect(sparse.filler.length).toBeLessThan(tree.filler.length)
    for (const leaf of sparse.filler) {
      const mx = Math.round(leaf.position[0] + half)
      const my = Math.round(leaf.position[2] + half)
      expect(isDark(mx, my)).toBe(true)
    }
  })

  it('attaches every leaf to the end of a twig', () => {
    const tips = new Set<string>()
    for (const b of tree.branches) for (const e of endpoints(b)) tips.add(e.map((v) => v.toFixed(3)).join(','))
    for (const leaf of tree.leaves) {
      const a = leaf.anchor
      expect(tips.has(a.map((v) => v.toFixed(3)).join(','))).toBe(true)
      const d = Math.hypot(leaf.position[0] - a[0], leaf.position[1] - a[1], leaf.position[2] - a[2])
      expect(d).toBeLessThanOrEqual(REACH)
    }
  })

  it.each([
    ['version 2', 'http://example.com/', 2, 500],
    ['version 10', `https://example.com/${'p'.repeat(180)}`, 10, 2500],
  ])('keeps %s generation and instance counts within budget', (_label, payload, version, budgetMs) => {
    const fixture = encodeGrid(payload)
    const start = performance.now()
    const result = buildTree(fixture, hashString(payload))
    const elapsed = performance.now() - start
    const canopyModules = fixture.cells.filter(
      (cell) => cell.dark && !isGrassModule(cell.x, cell.y, fixture.size),
    ).length

    expect(fixture.version).toBe(version)
    expect(elapsed).toBeLessThan(budgetMs)
    expect(result.leaves).toHaveLength(canopyModules * 13)
    expect(result.branches.length).toBeLessThanOrEqual(canopyModules * 6 + 80)
  })
})
