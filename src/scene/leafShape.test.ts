import { describe, expect, it } from 'vitest'
import { mulberry32 } from './hash'
import {
  areaOfOutline,
  boundsOfOutline,
  fitScale,
  halfExtents,
  LEAF_SHAPES,
  qrSlots,
  silhouette,
  textureKindForLeafShape,
  type Bounds,
} from './leafShape'

describe('leaf silhouettes', () => {
  it('keeps every shared outline normalized and its declared bounds exact', () => {
    for (const shape of LEAF_SHAPES) {
      const outline = silhouette(shape)
      expect(outline.length).toBeGreaterThanOrEqual(16)
      expect(outline.every(([x, y]) => Math.abs(x) <= 0.5 && Math.abs(y) <= 0.5)).toBe(true)
      expect(boundsOfOutline(outline)).toEqual(halfExtents(shape))
    }
  })

  it('keeps every canopy cluster nearly as solid as the ovate it replaces', () => {
    const ovate = areaOfOutline(silhouette('ovate'))
    for (const shape of ['cherryCanopy', 'appleCanopy', 'mapleCanopy', 'pineCanopy', 'willowCanopy'] as const) {
      const ratio = areaOfOutline(silhouette(shape)) / ovate
      expect(ratio).toBeGreaterThanOrEqual(0.84)
      expect(ratio).toBeLessThan(1)
    }
    expect(areaOfOutline(silhouette('pine')) / ovate).toBeLessThan(0.2)
    expect(areaOfOutline(silhouette('willow')) / ovate).toBeLessThan(0.35)
  })

  it('keeps the blossom inside the cherry leaf box so spring swaps textures without moving bounds', () => {
    const [cx, cy] = halfExtents('cherry')
    const [bx, by] = halfExtents('blossom')
    expect(bx).toBeLessThanOrEqual(cx + 1e-9)
    expect(by).toBeLessThanOrEqual(cy + 1e-9)
  })

  it('gives the maple five pointed lobes with deep sinuses', () => {
    const outline = silhouette('maple')
    const radii = outline.map(([x, y]) => Math.hypot(x, y))
    const peaks = radii.filter((r, i) => r > radii[(i + outline.length - 1) % outline.length]! && r >= radii[(i + 1) % outline.length]!)
    expect(peaks.length).toBe(5)
    expect(Math.min(...radii) / Math.max(...radii)).toBeLessThan(0.35)
  })


  it('keeps species leaves far from a circular disc', () => {
    for (const shape of ['maple', 'blossom'] as const) {
      const radii = silhouette(shape).map(([x, y]) => Math.hypot(x, y))
      expect(Math.min(...radii) / Math.max(...radii)).toBeLessThan(0.55)
    }
    const [cherryX, cherryY] = halfExtents('cherry')
    const [pineX, pineY] = halfExtents('pine')
    expect(cherryX / cherryY).toBeLessThan(0.9)
    expect(pineX / pineY).toBeLessThan(0.25)
  })

  it('maps every supported shape to its renderer texture kind', () => {
    expect(LEAF_SHAPES.map(textureKindForLeafShape)).toEqual([...LEAF_SHAPES])
  })

  it('fits every rotated outline point inside asymmetric module bounds', () => {
    const bounds: Bounds = { left: -0.5, right: 0.9, back: -0.72, front: 0.5 }
    for (const shape of LEAF_SHAPES) {
      for (const phi of [0, 0.37, Math.PI / 4, Math.PI / 2, 2.1]) {
        const ox = 0.08
        const oz = -0.06
        const scale = fitScale(ox, oz, phi, bounds, 1.5, shape)
        const c = Math.cos(phi)
        const s = Math.sin(phi)
        for (const [x, z] of silhouette(shape)) {
          const rx = ox + (x * c - z * s) * scale
          const rz = oz + (x * s + z * c) * scale
          expect(rx).toBeGreaterThanOrEqual(bounds.left - 1e-9)
          expect(rx).toBeLessThanOrEqual(bounds.right + 1e-9)
          expect(rz).toBeGreaterThanOrEqual(bounds.back - 1e-9)
          expect(rz).toBeLessThanOrEqual(bounds.front + 1e-9)
        }
      }
    }
  })
})

describe('QR leaf slots', () => {
  it('gives all thirteen coverage slots stable unique IDs', () => {
    const slots = qrSlots(13, mulberry32(1))
    expect(slots).toHaveLength(13)
    expect(slots.map((slot) => slot.id)).toEqual([...Array(13).keys()])
    expect(new Set(slots.map((slot) => `${slot.ox.toFixed(4)},${slot.oz.toFixed(4)}`)).size).toBe(13)
  })
})
