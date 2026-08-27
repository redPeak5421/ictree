import { CanvasTexture, SRGBColorSpace } from 'three'

let cached: CanvasTexture | null = null

/**
 * One broad ovate leaf, shared by the canopy, the ground litter and the autumn
 * particles. Drawn into a canvas so there is no image asset to ship. Its
 * bounding box is what `leafShape.ts` declares — keep the two in step: the tree
 * builder uses those extents to guarantee a leaf never crosses a module edge.
 */
export function leafTexture(): CanvasTexture {
  if (cached) return cached
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')
  if (!g) {
    cached = new CanvasTexture(canvas)
    return cached
  }
  g.clearRect(0, 0, size, size)
  g.fillStyle = '#ffffff'
  g.beginPath()
  // A broad, nearly round leaf with a short tip and a petiole notch. Fuller than
  // a maple so a cluster of them can tile a module solidly.
  g.moveTo(64, 4)
  g.bezierCurveTo(96, 6, 119, 32, 119, 66)
  g.bezierCurveTo(119, 98, 92, 122, 66, 123)
  g.lineTo(64, 116)
  g.lineTo(62, 123)
  g.bezierCurveTo(36, 122, 9, 98, 9, 66)
  g.bezierCurveTo(9, 32, 32, 6, 64, 4)
  g.closePath()
  g.fill()
  cached = new CanvasTexture(canvas)
  cached.colorSpace = SRGBColorSpace
  cached.anisotropy = 4
  return cached
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

const blades: Partial<Record<'shaded' | 'flat', CanvasTexture>> = {}

/**
 * A single curved, tapered grass blade. Drawn rather than extruded because a
 * cone cannot bend, and straight cones read as a row of spikes instead of grass.
 *
 * `shaded` darkens toward the base so a clump reads as a shadowed tuft; that
 * is for the rim grass only. The blades standing in the code's corners are
 * `flat`: they are ink, and a decoder's block binarizer treats any luma that
 * strays inside a solid finder as a hole in it.
 */
export function bladeTexture(kind: 'shaded' | 'flat' = 'shaded'): CanvasTexture {
  const cached = blades[kind]
  if (cached) return cached
  const w = 64
  const h = 160
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')
  const texture = new CanvasTexture(canvas)
  blades[kind] = texture
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
  g.beginPath()
  g.moveTo(23, h)
  g.quadraticCurveTo(25, 82, 45, 5)
  g.quadraticCurveTo(53, 78, 41, h)
  g.closePath()
  g.fill()
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

let maple: CanvasTexture | null = null

/**
 * The leaf as it hangs on the tree: a five-lobed maple, shaded from its tip
 * down so a wall of them reads as a crown with depth rather than as confetti.
 * It is never what lands in the code — each leaf swaps to the broad
 * `leafTexture` silhouette mid-flight, because a lobed outline cannot tile a
 * module solidly and the shading would pull the module off its luma.
 */
export function mapleTexture(): CanvasTexture {
  if (maple) return maple
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')
  if (!g) {
    maple = new CanvasTexture(canvas)
    return maple
  }
  g.clearRect(0, 0, size, size)
  const cx = 64
  const cy = 66
  const R = 60
  // Polar outline: five lobes with the tips at 12 o'clock and every 72deg
  // from there, the two lowest lobes a little shorter, and the sinus between
  // them at 6 o'clock reading as the petiole notch.
  g.beginPath()
  const N = 240
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2
    const lobe = ((Math.cos(5 * th) + 1) / 2) ** 1.7
    const r = R * (0.5 + 0.5 * lobe) * (0.88 + 0.12 * Math.cos(th))
    const x = cx + r * Math.sin(th)
    const y = cy - r * Math.cos(th)
    if (i === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.closePath()
  const grad = g.createLinearGradient(0, cy - R, 0, cy + R)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(0.55, '#ececec')
  grad.addColorStop(1, '#b9b9b9')
  g.fillStyle = grad
  g.fill()
  maple = new CanvasTexture(canvas)
  maple.colorSpace = SRGBColorSpace
  maple.anisotropy = 4
  return maple
}
