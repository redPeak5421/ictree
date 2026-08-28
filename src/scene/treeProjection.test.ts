import { describe, expect, it } from 'vitest'
import jsQR from 'jsqr'
import { Object3D, Vector3 } from 'three'
import { encodeGrid } from '../qr/encode'
import { hashString } from './hash'
import { vegetationOutline } from './grassLayout'
import { silhouette } from './leafShape'
import { colorsOf, type Season } from './palettes'
import { buildTree, type LeafInstance } from './tree'
import {
  projectLeafOutline,
  projectVegetationOutline,
  projectionStats,
  rasterTreeProjection,
  resampleProjection,
} from './treeProjection'

const SPECIES_FIXTURES = [
  ['https://example.com/tree-1', 'summer'],
  ['https://example.com/tree-2', 'autumn'],
  ['https://example.com/tree-0', 'spring'],
] as const satisfies readonly (readonly [string, Season])[]

const VERSION_FIXTURES = [
  ['http://example.com/', 2],
  [`https://example.com/${'p'.repeat(60)}`, 5],
  [`https://example.com/${'p'.repeat(180)}`, 10],
] as const

function rigFor(payload: string) {
  const grid = encodeGrid(payload)
  return { grid, rig: buildTree(grid, hashString(payload)) }
}

describe('generated tree projection', () => {
  it('matches the renderer Object3D transform exactly', () => {
    const { rig } = rigFor(SPECIES_FIXTURES[0][0])
    const leaf: LeafInstance = rig.leaves[0]!
    const projected = projectLeafOutline(leaf)
    const object = new Object3D()
    object.position.set(...leaf.position)
    object.rotation.set(...leaf.euler, 'YXZ')
    object.scale.setScalar(leaf.scale)
    object.updateMatrix()
    const expected = silhouette(leaf.shape).map(([x, y]) => {
      const world = new Vector3(x, y, 0).applyMatrix4(object.matrix)
      return [world.x, world.z] as const
    })
    expect(projected).toHaveLength(expected.length)
    projected.forEach(([x, z], index) => {
      expect(x).toBeCloseTo(expected[index]![0], 12)
      expect(z).toBeCloseTo(expected[index]![1], 12)
    })
  })

  it('matches the finder-tuft renderer transform exactly', () => {
    const { rig } = rigFor(SPECIES_FIXTURES[0][0])
    const item = rig.finderGrass[0]!
    const projected = projectVegetationOutline(item)
    const ux = Math.sin(item.lean) * Math.sin(item.heading)
    const uy = Math.cos(item.lean)
    const uz = Math.sin(item.lean) * Math.cos(item.heading)
    const object = new Object3D()
    object.position.set(
      item.root[0] + (ux * item.height) / 2,
      item.root[1] + (uy * item.height) / 2,
      item.root[2] + (uz * item.height) / 2,
    )
    object.rotation.set(item.lean, item.heading, 0, 'YXZ')
    object.scale.set(item.width, item.height, 1)
    object.updateMatrix()
    const expected = vegetationOutline(item.form).map(([x, y]) => {
      const world = new Vector3(x, y, 0).applyMatrix4(object.matrix)
      return [world.x, world.z] as const
    })
    expect(projected).toHaveLength(expected.length)
    projected.forEach(([x, z], index) => {
      expect(x).toBeCloseTo(expected[index]![0], 12)
      expect(z).toBeCloseTo(expected[index]![1], 12)
    })
  })

  it('uses explicit QR version 2, 5, and 10 fixtures', () => {
    for (const [payload, version] of VERSION_FIXTURES) {
      expect(encodeGrid(payload).version).toBe(version)
    }
  })

  it('meets dark coverage and light contamination bounds from actual leaves', () => {
    const payloads = [...SPECIES_FIXTURES.map(([payload]) => payload), ...VERSION_FIXTURES.map(([payload]) => payload)]
    const allStats: ReturnType<typeof projectionStats>[] = []
    for (const payload of new Set(payloads)) {
      const { grid, rig } = rigFor(payload)
      const projection = rasterTreeProjection(grid, rig, {
        modulePx: 16,
        quiet: 4,
        colors: colorsOf('autumn', 'default'),
      })
      const stats = projectionStats(grid, projection)
      allStats.push(stats)
    }
    expect(Math.min(...allStats.map((stats) => stats.darkMean))).toBeGreaterThanOrEqual(0.91)
    expect(Math.min(...allStats.map((stats) => stats.darkMin))).toBeGreaterThanOrEqual(0.8)
    expect(Math.min(...allStats.map((stats) => stats.finderMean))).toBeGreaterThanOrEqual(0.93)
    expect(Math.max(...allStats.map((stats) => stats.lightMean))).toBeLessThanOrEqual(0.1)
    expect(Math.max(...allStats.map((stats) => stats.lightMax))).toBeLessThanOrEqual(0.25)
    expect(allStats.every((stats) => stats.lightCentersClean)).toBe(true)
  }, 30_000)

  it('decodes every required species, season, and output size', () => {
    const failures: string[] = []
    const cases: [string, Season[]][] = [
      ...SPECIES_FIXTURES.map(([payload, season]) => [payload, [season]] as [string, Season[]]),
      [VERSION_FIXTURES[1][0], ['spring', 'summer', 'autumn']],
      [VERSION_FIXTURES[2][0], ['spring', 'summer', 'autumn']],
    ]
    for (const [payload, seasons] of cases) {
      const { grid, rig } = rigFor(payload)
      for (const season of seasons) {
        const projection = rasterTreeProjection(grid, rig, {
          modulePx: 16,
          quiet: 4,
          colors: colorsOf(season, 'default'),
        })
        for (const size of [220, 320, 480, 600, 700, 900, 1100]) {
          const image = resampleProjection(projection, size)
          const decoded = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })?.data
          if (decoded !== payload) failures.push(`v${grid.version}:${season}:${size}`)
        }
      }
    }
    expect(failures).toEqual([])
  }, 60_000)
})
