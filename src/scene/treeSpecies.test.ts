import { describe, expect, it } from 'vitest'
import { encodeGrid } from '../qr/encode'
import { hashString } from './hash'
import {
  crownLayout,
  profileFor,
  resolveTreeChoice,
  type CrownPoint,
  type TreeSpecies,
} from './treeSpecies'

const FIXTURES = [
  ['https://example.com/tree-1', 'oak'],
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
  const band = (from: number, to: number) =>
    mean(rows.filter((row) => row.radius >= from && row.radius < to).map((row) => row.height))
  return {
    extent: (Math.max(...heights) - Math.min(...heights)) / island,
    highReach: Math.max(...rows.filter((row) => row.layer === 'high').map((row) => row.radius)),
    leftRight:
      Math.abs(
        mean(rows.filter((row) => row.x < 0).map((row) => row.height)) -
          mean(rows.filter((row) => row.x >= 0).map((row) => row.height)),
      ) / island,
    center: band(0, 0.33) / island,
    middle: band(0.33, 0.72) / island,
    outer: band(0.72, 1.01) / island,
  }
}

describe('tree species selection', () => {
  it('picks species from the palette instead of a tree picker', () => {
    expect(profileFor('oak').species).toBe('oak')
    expect(resolveTreeChoice('https://example.com/tree-1', 'default')).toEqual({ species: 'cherry', habit: 'lush' })
    expect(resolveTreeChoice('https://example.com/tree-1', 'coral')).toEqual({ species: 'maple', habit: 'lush' })
    expect(resolveTreeChoice('https://example.com/tree-1', 'snow')).toEqual({ species: 'oak', habit: 'sparse' })
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
      expect(new Set(first.map((point) => point.height.toFixed(1))).size).toBeGreaterThanOrEqual(20)
    }
  })
})

describe('species crown profiles', () => {
  it('gives oak a low, wide, asymmetric crown with high outer shoulders', () => {
    const payload = FIXTURES[0][0]
    const grid = encodeGrid(payload)
    const value = metrics(crownLayout(grid, hashString(payload), 'oak'), grid.size)
    expect(value.extent).toBeGreaterThanOrEqual(0.36)
    expect(value.extent).toBeLessThanOrEqual(0.48)
    expect(value.highReach).toBeGreaterThanOrEqual(0.62)
    expect(value.leftRight).toBeGreaterThanOrEqual(0.02)
    expect(value.leftRight).toBeLessThanOrEqual(0.12)
  })

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
    expect(value.middle - value.outer).toBeGreaterThanOrEqual(0.08)
  })
})
