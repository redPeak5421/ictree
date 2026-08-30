import { describe, expect, it } from 'vitest'
import { encodeGrid } from '../qr/encode'
import { ISLAND_RIM } from '../qr/types'
import { hashString } from './hash'
import {
  buildFinderCarpet,
  buildFinderVegetation,
  buildGroundLitter,
  buildMeadowCarpet,
  buildMeadowVegetation,
  buildSceneryVegetation,
  FINDER_CARPET_SLOTS,
  textureKindForVegetation,
  widthRangeForVegetation,
  type VegetationInstance,
} from './grassLayout'
import { isCornerCell, isEdgeCell } from './treeSpecies'

const grid = encodeGrid('https://example.com/tree-2')
const seed = hashString(grid.payload)
const scenery = buildSceneryVegetation(grid, seed)

function ratio(items: VegetationInstance[], predicate: (item: VegetationInstance) => boolean) {
  return items.filter(predicate).length / items.length
}

describe('grass layout', () => {
  it('is deterministic and contains every ground-cover region', () => {
    expect(buildSceneryVegetation(grid, seed)).toEqual(scenery)
    expect(new Set(scenery.map((item) => item.region))).toEqual(new Set(['rim', 'turf', 'trunk']))
  })

  it('mixes all three forms and short, medium, and tall rim vegetation', () => {
    const rim = scenery.filter((item) => item.region === 'rim')
    for (const form of ['blade', 'broad', 'seed'] as const) {
      expect(ratio(rim, (item) => item.form === form)).toBeGreaterThanOrEqual(0.1)
    }
    expect(ratio(rim, (item) => item.height < 0.45)).toBeGreaterThanOrEqual(0.1)
    expect(ratio(rim, (item) => item.height >= 0.45 && item.height <= 0.85)).toBeGreaterThanOrEqual(0.1)
    expect(ratio(rim, (item) => item.height > 0.85)).toBeGreaterThanOrEqual(0.1)
  })

  it('gives broad leaves and seed heads visibly wider silhouettes than blades', () => {
    const rim = scenery.filter((item) => item.region === 'rim')
    const widths = (form: VegetationInstance['form']) => rim.filter((item) => item.form === form).map((item) => item.width)
    expect(Math.min(...widths('broad'))).toBeGreaterThanOrEqual(0.34)
    expect(Math.max(...widths('broad'))).toBeLessThanOrEqual(0.56)
    expect(Math.min(...widths('seed'))).toBeGreaterThanOrEqual(0.18)
    expect(Math.max(...widths('seed'))).toBeLessThanOrEqual(0.28)
  })

  it('forms uneven clumps with intentional rim gaps and clustered roots', () => {
    const rim = scenery.filter((item) => item.region === 'rim')
    const island = grid.size + ISLAND_RIM * 2
    const totalRimCells = island * 4 - 4
    const counts = new Map<string, number>()
    for (const item of rim) {
      const key = item.clump.join(',')
      counts.set(key, (counts.get(key) ?? 0) + 1)
      expect(Math.hypot(item.root[0] - item.clump[0], item.root[2] - item.clump[1])).toBeLessThanOrEqual(1.35)
    }
    expect(counts.size).toBeLessThanOrEqual(totalRimCells * 0.95)
    expect(counts.size).toBeGreaterThanOrEqual(totalRimCells * 0.55)
    const values = [...counts.values()]
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
    expect(Math.sqrt(variance) / mean).toBeGreaterThanOrEqual(0.28)
  })

  it('adds a few visible multi-leaf broad rosettes around, but not against, the trunk', () => {
    const trunk = scenery.filter((item) => item.region === 'trunk')
    const clumps = new Map<string, VegetationInstance[]>()
    for (const item of trunk) {
      const key = item.clump.join(',')
      clumps.set(key, [...(clumps.get(key) ?? []), item])
    }
    expect(clumps.size).toBeGreaterThanOrEqual(4)
    expect(clumps.size).toBeLessThanOrEqual(6)
    for (const items of clumps.values()) {
      expect(items.length).toBeGreaterThanOrEqual(5)
      expect(items.length).toBeLessThanOrEqual(7)
      const headingSectors = new Set<number>()
      for (const item of items) {
        expect(item.form).toBe('broad')
        expect(item.height).toBeGreaterThanOrEqual(0.52)
        expect(item.height).toBeLessThanOrEqual(0.88)
        expect(item.width).toBeGreaterThanOrEqual(0.32)
        expect(item.width).toBeLessThanOrEqual(0.62)
        expect(item.lean).toBeGreaterThanOrEqual(1.05)
        expect(item.lean).toBeLessThanOrEqual(1.42)
        expect(Math.hypot(item.root[0] - item.clump[0], item.root[2] - item.clump[1])).toBeLessThanOrEqual(0.1)
        expect(Math.hypot(item.root[0], item.root[2])).toBeGreaterThanOrEqual(1.1)
        expect(Math.hypot(item.root[0], item.root[2])).toBeLessThanOrEqual(3.5)
        const wrapped = ((item.heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
        headingSectors.add(Math.floor(wrapped / (Math.PI / 2)))
      }
      expect(headingSectors.size).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps complete finder vegetation footprints inside dark-module ink', () => {
    const finder = buildFinderVegetation(grid, seed)
    const expectedCells = grid.cells.filter((cell) => cell.dark && isCornerCell(cell.x, cell.y, grid.size)).length
    expect(finder.length).toBeGreaterThan(expectedCells * 20)
    expect(new Set(finder.map((item) => item.form))).toEqual(new Set(['blade', 'broad']))
    const half = (grid.size - 1) / 2
    const isDark = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < grid.size && y < grid.size && grid.cells[y * grid.size + x]!.dark
    for (const item of finder) {
      const mx = Math.round(item.cell[0] + half)
      const my = Math.round(item.cell[1] + half)
      const reach = (x: number, y: number) => (isDark(x, y) ? 0.4 : 0)
      const tipX = item.root[0] + Math.sin(item.lean) * Math.sin(item.heading) * item.height
      const tipZ = item.root[2] + Math.sin(item.lean) * Math.cos(item.heading) * item.height
      const halfW = item.width / 2
      expect(item.root[0] - halfW).toBeGreaterThanOrEqual(item.cell[0] - 0.5 - reach(mx - 1, my) - 1e-6)
      expect(item.root[0] + halfW).toBeLessThanOrEqual(item.cell[0] + 0.5 + reach(mx + 1, my) + 1e-6)
      expect(item.root[2] - halfW).toBeGreaterThanOrEqual(item.cell[1] - 0.5 - reach(mx, my - 1) - 1e-6)
      expect(item.root[2] + halfW).toBeLessThanOrEqual(item.cell[1] + 0.5 + reach(mx, my + 1) + 1e-6)
      expect(tipX - halfW).toBeGreaterThanOrEqual(item.cell[0] - 0.5 - reach(mx - 1, my) - 1e-6)
      expect(tipX + halfW).toBeLessThanOrEqual(item.cell[0] + 0.5 + reach(mx + 1, my) + 1e-6)
      expect(tipZ - halfW).toBeGreaterThanOrEqual(item.cell[1] - 0.5 - reach(mx, my - 1) - 1e-6)
      expect(tipZ + halfW).toBeLessThanOrEqual(item.cell[1] + 0.5 + reach(mx, my + 1) + 1e-6)
    }
  })

  it('composes every dark corner module from a thirteen-slot grass carpet', () => {
    const carpet = buildFinderCarpet(grid, seed)
    const expectedCells = grid.cells.filter((cell) => cell.dark && isCornerCell(cell.x, cell.y, grid.size)).length
    expect(carpet).toHaveLength(expectedCells * FINDER_CARPET_SLOTS)
    expect(buildFinderCarpet(grid, seed)).toEqual(carpet)
    expect(new Set(carpet.map((leaf) => leaf.cell.join(','))).size).toBe(expectedCells)
    const byCell = new Map<string, typeof carpet>()
    for (const leaf of carpet) {
      const key = leaf.cell.join(',')
      const entry = byCell.get(key) ?? []
      entry.push(leaf)
      byCell.set(key, entry)
      expect(leaf.scale).toBeGreaterThan(0)
      expect(Math.abs(leaf.position[0] - leaf.cell[0])).toBeLessThan(0.5)
      expect(Math.abs(leaf.position[2] - leaf.cell[1])).toBeLessThan(0.5)
    }
    for (const leaves of byCell.values()) {
      expect(leaves.map((leaf) => leaf.slot).sort((a, b) => a - b)).toEqual([...Array(FINDER_CARPET_SLOTS).keys()])
    }
  })

  it('maps every vegetation form to a renderer texture and width rule', () => {
    const all = [...scenery, ...buildFinderVegetation(grid, seed), ...buildMeadowVegetation(grid, seed)]
    for (const item of all) {
      expect(['blade', 'broad', 'seed']).toContain(textureKindForVegetation(item.form))
      const [minimum, maximum] = widthRangeForVegetation(item.form)
      expect(item.width).toBeGreaterThanOrEqual(minimum)
      expect(item.width).toBeLessThanOrEqual(maximum)
    }
  })


  it('keeps meadow form mix and adds windier rim plants, flowers, and dandelions', () => {
    const rim = scenery.filter((item) => item.region === 'rim')
    expect(rim.every((item) => item.gust >= 1.4)).toBe(true)
    expect(scenery.filter((item) => item.region === 'turf' && item.gust >= 1.15).length).toBeGreaterThan(0)
    const flower = buildSceneryVegetation(grid, seed, 'flower').filter((item) => item.region === 'rim')
    const puff = buildSceneryVegetation(grid, seed, 'dandelion').filter((item) => item.region === 'rim')
    expect(ratio(flower, (item) => item.form === 'broad')).toBeGreaterThan(ratio(rim, (item) => item.form === 'broad'))
    expect(ratio(puff, (item) => item.form === 'seed')).toBeGreaterThan(ratio(rim, (item) => item.form === 'seed'))
    expect(ratio(flower, (item) => item.form === 'blade')).toBeGreaterThan(0)
    expect(ratio(puff, (item) => item.form === 'blade')).toBeGreaterThan(0)
  })

  it('packs the QR rim with a meadow carpet and shorter standing plants', () => {
    const carpet = buildMeadowCarpet(grid, seed)
    const plants = buildMeadowVegetation(grid, seed)
    const expectedCells = grid.cells.filter((cell) => cell.dark && isEdgeCell(cell.x, cell.y, grid.size)).length
    expect(expectedCells).toBeGreaterThan(0)
    expect(carpet).toHaveLength(expectedCells * FINDER_CARPET_SLOTS)
    expect(buildMeadowCarpet(grid, seed)).toEqual(carpet)
    expect(plants.length).toBeGreaterThan(expectedCells * 20)
    expect(Math.max(...plants.map((item) => item.height))).toBeLessThanOrEqual(1.1)
    expect(plants.every((item) => item.gust === 0)).toBe(true)
  })

  it('stands finder blades taller and more vertical than the lawn band', () => {
    const finder = buildFinderVegetation(grid, seed)
    const tall = finder.filter((item) => item.form === 'blade' && item.height > 0.7)
    expect(tall.length).toBeGreaterThan(0)
    expect(Math.max(...finder.map((item) => item.height))).toBeLessThanOrEqual(1.75)
    expect(Math.max(...finder.map((item) => item.lean))).toBeLessThanOrEqual(0.42)
    expect(tall.every((item) => item.lean <= 0.42)).toBe(true)
  })

  it('clusters species-matching fallen leaves around the tree without crossing the paving', () => {
    const litter = buildGroundLitter(grid, seed, 'maple')
    expect(buildGroundLitter(grid, seed, 'maple')).toEqual(litter)
    expect(litter.length).toBeGreaterThanOrEqual(40)
    expect(litter.length).toBeLessThanOrEqual(52)
    expect(new Set(litter.filter((item) => item.cluster !== null).map((item) => item.cluster)).size).toBeGreaterThanOrEqual(4)
    expect(litter.filter((item) => item.cluster !== null).length / litter.length).toBeGreaterThanOrEqual(0.75)
    const edge = grid.size / 2 - 0.5
    for (const item of litter) {
      expect(item.shape).toBe('maple')
      expect(Math.abs(item.position[0])).toBeLessThanOrEqual(edge)
      expect(Math.abs(item.position[1])).toBeLessThanOrEqual(edge)
      expect(Math.hypot(item.position[0], item.position[1])).toBeGreaterThanOrEqual(0.9)
      expect(item.scale).toBeGreaterThanOrEqual(0.28)
      expect(item.scale).toBeLessThanOrEqual(0.62)
    }
  })
})
