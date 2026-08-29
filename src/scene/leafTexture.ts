import { CanvasTexture, SRGBColorSpace } from 'three'
import type { VegetationForm } from './grassLayout'
import { carpetOutline } from './grassLayout'
import { silhouette, type LeafShape } from './leafShape'

const leaves: Partial<Record<LeafShape, CanvasTexture>> = {}

/**
 * Draw a leaf from the same normalized outline used by layout and projection
 * tests, so alpha pixels and module-boundary maths cannot drift apart.
 */
export function leafTexture(shape: LeafShape = 'ovate'): CanvasTexture {
  const found = leaves[shape]
  if (found) return found
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')
  const texture = new CanvasTexture(canvas)
  leaves[shape] = texture
  if (!g) {
    return texture
  }
  g.clearRect(0, 0, size, size)
  g.fillStyle = '#ffffff'
  g.beginPath()
  silhouette(shape).forEach(([x, y], index) => {
    const px = (x + 0.5) * size
    const py = (0.5 - y) * size
    if (index === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  })
  g.closePath()
  g.fill()
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

let petal: CanvasTexture | null = null

/** Soft ellipse for spring petals — the maple silhouette reads wrong at that size. */
export function petalTexture(): CanvasTexture {
  if (petal) return petal
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')
  if (!g) {
    petal = new CanvasTexture(canvas)
    return petal
  }
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.ellipse(size / 2, size / 2, size * 0.26, size * 0.44, 0, 0, Math.PI * 2)
  g.fill()
  petal = new CanvasTexture(canvas)
  petal.colorSpace = SRGBColorSpace
  return petal
}

const vegetation = new Map<string, CanvasTexture>()

/** Procedural blade, broad-leaf, and seed-head cutouts for living ground cover. */
export function vegetationTexture(
  form: VegetationForm,
  kind: 'shaded' | 'flat' = 'shaded',
): CanvasTexture {
  const key = `${form}:${kind}`
  const cached = vegetation.get(key)
  if (cached) return cached
  const w = 96
  const h = 160
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')
  const texture = new CanvasTexture(canvas)
  vegetation.set(key, texture)
  if (!g) return texture
  if (kind === 'shaded') {
    const grad = g.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(0.45, '#e6e6e6')
    grad.addColorStop(1, '#8f8f8f')
    g.fillStyle = grad
  } else {
    g.fillStyle = '#ffffff'
  }
  if (form === 'blade') {
    // A fan of blades so one instance reads as a small tuft, not a stalk.
    for (const [x0, tipX, tipY] of [[16, 10, 28], [30, 26, 12], [44, 48, 4], [58, 72, 14], [70, 88, 30]] as const) {
      g.beginPath()
      g.moveTo(x0, h)
      g.quadraticCurveTo(x0 + 5, 92, tipX, tipY)
      g.quadraticCurveTo(x0 + 16, 90, x0 + 14, h)
      g.closePath()
      g.fill()
    }
  } else if (form === 'broad') {
    if (kind === 'shaded') {
      // Scenery flower only — finder ink stays on the solid flat leaf.
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2
        g.beginPath()
        g.ellipse(48 + Math.cos(a) * 18, 58 + Math.sin(a) * 16, 16, 28, a, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = '#d0d0d0'
      g.beginPath()
      g.ellipse(48, 58, 12, 12, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = kind === 'shaded' ? '#c8c8c8' : '#ffffff'
      g.beginPath()
      g.moveTo(44, h)
      g.quadraticCurveTo(48, 110, 48, 78)
      g.quadraticCurveTo(50, 110, 54, h)
      g.closePath()
      g.fill()
    } else {
      g.beginPath()
      g.moveTo(34, h)
      g.bezierCurveTo(18, 112, 10, 64, 48, 8)
      g.bezierCurveTo(90, 52, 82, 108, 62, h)
      g.closePath()
      g.fill()
    }
  } else if (kind === 'shaded') {
    g.strokeStyle = '#d0d0d0'
    g.lineCap = 'round'
    g.lineWidth = 8
    g.beginPath()
    g.moveTo(48, h)
    g.lineTo(48, 78)
    g.stroke()
    g.fillStyle = '#ffffff'
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      g.beginPath()
      g.ellipse(48 + Math.cos(a) * 22, 52 + Math.sin(a) * 22, 7, 4, a, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = '#ececec'
    g.beginPath()
    g.ellipse(48, 52, 16, 16, 0, 0, Math.PI * 2)
    g.fill()
  } else {
    // A stem with a forked seed head breaks the repeated single-tip rhythm.
    g.strokeStyle = '#ffffff'
    g.lineCap = 'round'
    g.lineWidth = 9
    g.beginPath()
    g.moveTo(48, h)
    g.quadraticCurveTo(48, 92, 52, 32)
    g.stroke()
    g.lineWidth = 7
    for (const [tx, ty] of [[24, 16], [48, 7], [73, 20]] as const) {
      g.beginPath()
      g.moveTo(51, 48)
      g.lineTo(tx, ty + 8)
      g.stroke()
      g.beginPath()
      g.ellipse(tx, ty, 8, 14, (tx - 48) * 0.02, 0, Math.PI * 2)
      g.fill()
    }
  }
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

let mound: CanvasTexture | null = null

/**
 * Shading for the turf mounds under the corner grass: full colour on top,
 * a little darker down the flank. Kept mild on purpose — the flank's rim is
 * visible from overhead, and a decoder's block binarizer reads a luma step
 * inside a solid finder as a hole in it.
 */
export function moundTexture(): CanvasTexture {
  if (mound) return mound
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 64
  const g = canvas.getContext('2d')
  if (!g) {
    mound = new CanvasTexture(canvas)
    return mound
  }
  const grad = g.createLinearGradient(0, 0, 0, 64)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(0.4, '#f6f6f6')
  grad.addColorStop(0.6, '#d9d9d9')
  grad.addColorStop(1, '#bdbdbd')
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 64)
  mound = new CanvasTexture(canvas)
  mound.colorSpace = SRGBColorSpace
  return mound
}

let carpet: CanvasTexture | null = null

/** Grass tuft used as finder-module ink: solid occupancy, blade streaks inside. */
export function carpetTexture(): CanvasTexture {
  if (carpet) return carpet
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')
  const texture = new CanvasTexture(canvas)
  carpet = texture
  if (!g) return texture
  g.clearRect(0, 0, size, size)
  g.beginPath()
  carpetOutline().forEach(([x, y], index) => {
    const px = (x + 0.5) * size
    const py = (0.5 - y) * size
    if (index === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  })
  g.closePath()
  g.fillStyle = '#ffffff'
  g.fill()
  g.save()
  g.clip()
  g.strokeStyle = '#dedede'
  g.lineWidth = 3
  g.lineCap = 'round'
  for (let i = 0; i < 14; i++) {
    const x = 18 + (i * 7.4) % 92
    g.beginPath()
    g.moveTo(x + 6, size - 10)
    g.quadraticCurveTo(x + 4, 64, x + ((i % 3) - 1) * 10, 12 + (i % 5) * 4)
    g.stroke()
  }
  g.restore()
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}
