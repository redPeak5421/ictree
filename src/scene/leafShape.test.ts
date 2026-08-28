import { describe, expect, it } from 'vitest'
import { mulberry32 } from './hash'
import {
  boundsOfOutline,
  fitScale,
  halfExtents,
  qrSlots,
  silhouette,
  textureKindForLeafShape,
  type Bounds,
  type LeafShape,
} from './leafShape'

const SHAPES: LeafShape[] = ['ovate', 'oak', 'maple', 'cherry']

describe('leaf silhouettes', () => {
  it('keeps every shared outline normalized and its declared bounds exact', () => {
    for (const shape of SHAPES) {
      const outline = silhouette(shape)
      expect(outline.length).toBeGreaterThanOrEqual(16)
      expect(outline.every(([x, y]) => Math.abs(x) <= 0.5 && Math.abs(y) <= 0.5)).toBe(true)
      expect(boundsOfOutline(outline)).toEqual(halfExtents(shape))
    }
  })

  it('maps every supported shape to its renderer texture kind', () => {
    expect(SHAPES.map(textureKindForLeafShape)).toEqual(SHAPES)
  })

  it('fits every rotated outline point inside asymmetric module bounds', () => {
    const bounds: Bounds = { left: -0.5, right: 0.9, back: -0.72, front: 0.5 }
    for (const shape of SHAPES) {
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
