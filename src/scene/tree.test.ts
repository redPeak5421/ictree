import { describe, expect, it } from 'vitest'
import { encodeGrid } from '../qr/encode'
import { hashString } from './hash'
import { footprint } from './leafShape'
import {
  BLOCK_H,
  BRANCH_OVERLAP,
  buildTree,
  isCornerModule,
  LIGHT_OVERLAP,
  REACH,
  SEAM_OVERLAP,
  type BranchInstance,
} from './tree'

const grid = encodeGrid('https://example.com/')
const tree = buildTree(grid, hashString(grid.payload))
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
    const again = buildTree(grid, hashString(grid.payload))
    expect(tree.branches.length).toBeGreaterThan(8)
    expect(tree.leaves.length).toBeGreaterThan(80)
    expect(again.leaves[0]).toEqual(tree.leaves[0])
    expect(again.branches[0]).toEqual(tree.branches[0])
  })

  it('grows the trunk from the island center', () => {
    const trunk = tree.branches[0]!
    expect(Math.abs(trunk.position[0])).toBeLessThan(0.6)
    expect(Math.abs(trunk.position[2])).toBeLessThan(0.6)
  })

  it('keeps every leaf over its own dark module, never over a light one', () => {
    for (const leaf of tree.leaves) {
      const [cx, cz] = leaf.cell
      const mx = Math.round(cx + half)
      const my = Math.round(cz + half)
      expect(isDark(mx, my)).toBe(true)
      if (leaf.kind !== 'leaf') continue
      // The flat footprint bounds the top-down outline at any lean, since
      // leaning only shrinks it; the heading is the second euler.
      const [ex, ez] = footprint(leaf.euler[1], leaf.kind).map((e) => e * leaf.scale) as [number, number]
      const left = leaf.position[0] - ex - cx
      const right = leaf.position[0] + ex - cx
      const back = leaf.position[2] - ez - cz
      const front = leaf.position[2] + ez - cz
      const eps = 1e-6
      // Into a dark neighbour freely; into a light one only a surface maple's
      // tip, and only as far as leaves its centre clean for a decoder's sample.
      const light = leaf.shape === 'maple' ? LIGHT_OVERLAP : 0
      const reach = (x: number, y: number) => (isDark(x, y) ? SEAM_OVERLAP : light)
      expect(LIGHT_OVERLAP).toBeLessThanOrEqual(0.15)
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

  it('covers every dark module: leaves outside the corners, turf inside them', () => {
    const leafCells = new Set(
      tree.leaves.filter((l) => l.kind === 'leaf').map((l) => `${l.cell[0]},${l.cell[1]}`),
    )
    const lawnCells = new Set(tree.lawns.map((l) => `${l.cell[0]},${l.cell[1]}`))
    for (const cell of grid.cells) {
      const key = `${cell.x - half},${cell.y - half}`
      const corner = isCornerModule(cell.x, cell.y, grid.size)
      expect(leafCells.has(key)).toBe(cell.dark && !corner)
      expect(lawnCells.has(key)).toBe(cell.dark && corner)
    }
  })

  it('lays a broad flat base under every column and maples above it', () => {
    const byCell = new Map<string, { ovate: number; maple: number }>()
    for (const leaf of tree.leaves) {
      if (leaf.kind !== 'leaf') continue
      const key = `${leaf.cell[0]},${leaf.cell[1]}`
      const entry = byCell.get(key) ?? { ovate: 0, maple: 0 }
      entry[leaf.shape]++
      byCell.set(key, entry)
    }
    for (const entry of byCell.values()) {
      expect(entry.ovate).toBeGreaterThanOrEqual(10)
      expect(entry.maple).toBeGreaterThanOrEqual(5)
    }
    for (const leaf of tree.leaves) {
      if (leaf.kind === 'leaf' && leaf.shape === 'ovate') {
        expect(leaf.euler[0]).toBeLessThanOrEqual(-Math.PI / 2 + 0.3 + 1e-9)
      }
    }
  })

  it('stands small tufts on the turf, inside their module from above', () => {
    const tufts = tree.leaves.filter((l) => l.kind === 'tuft')
    expect(tufts.length).toBeGreaterThan(0)
    for (const tuft of tufts) {
      expect(tuft.euler[0]).toBe(0)
      expect(tuft.position[1]).toBeCloseTo(BLOCK_H + tuft.scale / 2, 6)
      // A standing plane's top-down outline is a line as long as its width;
      // it must fit its module at any heading.
      expect(tuft.scale * 0.9).toBeLessThanOrEqual(1)
      expect(Math.abs(tuft.position[0] - tuft.cell[0])).toBeLessThanOrEqual(0.05 + 1e-9)
      expect(Math.abs(tuft.position[2] - tuft.cell[1])).toBeLessThanOrEqual(0.05 + 1e-9)
    }
  })

  it('attaches every leaf to the end of a twig', () => {
    const tips = new Set<string>()
    for (const b of tree.branches) for (const e of endpoints(b)) tips.add(e.map((v) => v.toFixed(3)).join(','))
    for (const leaf of tree.leaves) {
      if (leaf.kind !== 'leaf') continue
      const a = leaf.anchor
      expect(tips.has(a.map((v) => v.toFixed(3)).join(','))).toBe(true)
      const d = Math.hypot(leaf.position[0] - a[0], leaf.position[1] - a[1], leaf.position[2] - a[2])
      expect(d).toBeLessThanOrEqual(REACH)
    }
  })
})
