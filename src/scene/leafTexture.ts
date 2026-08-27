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

let blade: CanvasTexture | null = null

/**
 * A single curved, tapered grass blade. Drawn rather than extruded because a
 * cone cannot bend, and straight cones read as a row of spikes instead of grass.
 */
export function bladeTexture(): CanvasTexture {
  if (blade) return blade
  const w = 64
  const h = 160
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')
  if (!g) {
    blade = new CanvasTexture(canvas)
    return blade
  }
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.moveTo(23, h)
  g.quadraticCurveTo(25, 82, 45, 5)
  g.quadraticCurveTo(53, 78, 41, h)
  g.closePath()
  g.fill()
  blade = new CanvasTexture(canvas)
  blade.colorSpace = SRGBColorSpace
  blade.anisotropy = 4
  return blade
}

let tuft: CanvasTexture | null = null

/**
 * A bushy grass clump: a solid mound with a spiky crown. Standing up it reads as
 * a tuft; lying flat it is nearly a filled disc, which is what lets clumps tile
 * a finder module as solidly as leaves tile the rest of the code. Bounds match
 * `TUFT_HALF_X/Y` in leafShape.ts.
 */
export function tuftTexture(): CanvasTexture {
  if (tuft) return tuft
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')
  if (!g) {
    tuft = new CanvasTexture(canvas)
    return tuft
  }
  g.clearRect(0, 0, size, size)
  g.fillStyle = '#ffffff'
  // A full rounded body — lying flat it must cover its module as well as a
  // leaf does, because the finder patterns are built from these — with a
  // spiky crown that reads as grass when it stands up.
  g.beginPath()
  g.ellipse(64, 70, 58, 51, 0, 0, Math.PI * 2)
  g.fill()
  const spikes = [
    [14, 44, 6, 18],
    [28, 30, 22, 8],
    [44, 22, 40, 4],
    [60, 19, 58, 3],
    [76, 20, 78, 4],
    [92, 26, 96, 8],
    [108, 38, 118, 16],
  ]
  for (const [bx, by, tx, ty] of spikes) {
    g.beginPath()
    g.moveTo(bx - 9, by + 6)
    g.lineTo(tx, ty)
    g.lineTo(bx + 9, by + 6)
    g.closePath()
    g.fill()
  }
  tuft = new CanvasTexture(canvas)
  tuft.colorSpace = SRGBColorSpace
  tuft.anisotropy = 4
  return tuft
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
