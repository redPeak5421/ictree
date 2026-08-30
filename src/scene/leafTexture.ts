import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three'
import type { VegetationForm } from './grassLayout'
import { carpetOutline } from './grassLayout'
import { hashString, mulberry32 } from './hash'
import { silhouette, type LeafShape } from './leafShape'

const leaves: Partial<Record<LeafShape, CanvasTexture>> = {}

const LEAF_PX = 256
type Ctx = CanvasRenderingContext2D
type Pt = readonly [number, number]

function finishMap(texture: CanvasTexture): CanvasTexture {
  texture.colorSpace = SRGBColorSpace
  texture.generateMipmaps = true
  texture.minFilter = LinearMipmapLinearFilter
  texture.magFilter = LinearFilter
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}


const px = (x: number) => (x + 0.5) * LEAF_PX
const py = (y: number) => (0.5 - y) * LEAF_PX

function trace(g: Ctx, outline: readonly Pt[], at: Pt = [0, 0], scale = 1, rotation = 0) {
  const c = Math.cos(rotation)
  const s = Math.sin(rotation)
  g.beginPath()
  outline.forEach(([x, y], index) => {
    const rx = at[0] + (x * c - y * s) * scale
    const ry = at[1] + (x * s + y * c) * scale
    if (index === 0) g.moveTo(px(rx), py(ry))
    else g.lineTo(px(rx), py(ry))
  })
  g.closePath()
}

function fillShape(g: Ctx, shape: LeafShape) {
  g.fillStyle = '#ffffff'
  trace(g, silhouette(shape))
  g.fill()
}

function stroke(g: Ctx, from: Pt, to: Pt, width: number, tone = '#d2d2d2') {
  g.strokeStyle = tone
  g.lineWidth = width
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(px(from[0]), py(from[1]))
  g.lineTo(px(to[0]), py(to[1]))
  g.stroke()
}

function mapped(at: Pt, scale: number, rotation: number, point: Pt): Pt {
  const c = Math.cos(rotation)
  const s = Math.sin(rotation)
  return [at[0] + (point[0] * c - point[1] * s) * scale, at[1] + (point[0] * s + point[1] * c) * scale]
}

/** Midrib and paired side veins on a broadleaf. */
function veinBroadleaf(g: Ctx) {
  stroke(g, [0, -0.47], [0, 0.44], 4.2, '#5a5a5a')
  for (let i = 0; i < 6; i++) {
    const y = -0.32 + i * 0.12
    const reach = 0.34 - Math.abs(y) * 0.24
    stroke(g, [0, y], [reach, y + 0.14], 2.4, '#6e6e6e')
    stroke(g, [0, y], [-reach, y + 0.14], 2.4, '#6e6e6e')
  }
}

/** One vein from the petiole to every lobe tip of the palmate maple. */
function veinMaple(g: Ctx) {
  const base: Pt = [0, -0.4]
  for (let k = 0; k < 5; k++) {
    const angle = (k * Math.PI * 2) / 5
    const radius = 0.47 * (0.84 + 0.16 * Math.cos(angle))
    const tip: Pt = [Math.sin(angle) * radius, Math.cos(angle) * radius]
    stroke(g, base, tip, 3.4, '#5a5a5a')
    stroke(g, [tip[0] * 0.55, tip[1] * 0.55 - 0.1], [tip[0] * 0.55 + Math.cos(angle) * 0.12, tip[1] * 0.55 - Math.sin(angle) * 0.12 - 0.05], 2.2, '#6e6e6e')
    const side: Pt = [tip[0] * 0.72, tip[1] * 0.72]
    stroke(g, side, [side[0] + Math.cos(angle + 0.9) * 0.1, side[1] + Math.sin(angle + 0.9) * 0.1], 2, '#7a7a7a')
    stroke(g, side, [side[0] + Math.cos(angle - 0.9) * 0.1, side[1] + Math.sin(angle - 0.9) * 0.1], 2, '#7a7a7a')
  }
}

function veinOnLeaf(g: Ctx, leaf: LeafShape, at: Pt, scale: number, rotation: number) {
  if (leaf === 'maple') {
    const base = mapped(at, scale, rotation, [0, -0.4])
    for (let k = 0; k < 5; k++) {
      const angle = (k * Math.PI * 2) / 5
      const radius = 0.47 * (0.84 + 0.16 * Math.cos(angle))
      stroke(g, base, mapped(at, scale, rotation, [Math.sin(angle) * radius, Math.cos(angle) * radius]), 2.0, '#c4c4c4')
    }
    return
  }
  stroke(g, mapped(at, scale, rotation, [0, -0.42]), mapped(at, scale, rotation, [0, 0.38]), 2.2, '#c4c4c4')
  for (const side of [-1, 1]) {
    stroke(g, mapped(at, scale, rotation, [0, -0.08]), mapped(at, scale, rotation, [side * 0.24, 0.1]), 1.8, '#c8c8c8')
    stroke(g, mapped(at, scale, rotation, [0, 0.12]), mapped(at, scale, rotation, [side * 0.2, 0.28]), 1.8, '#c8c8c8')
  }
}

function paintLeaf(g: Ctx, leaf: LeafShape, at: Pt, scale: number, rotation: number, fill = '#ffffff') {
  const outline = silhouette(leaf)
  trace(g, outline, at, scale, rotation)
  g.fillStyle = fill
  g.fill()
  g.save()
  trace(g, outline, at, scale, rotation)
  g.clip()
  if (leaf === 'maple' || leaf === 'cherry' || leaf === 'apple') {
    veinOnLeaf(g, leaf, at, scale, rotation)
  }
  g.restore()
}

function drawBlossom(g: Ctx) {
  fillShape(g, 'blossom')
  for (let k = 0; k < 5; k++) {
    const angle = (k * Math.PI * 2) / 5
    stroke(g, [0, 0], [Math.sin(angle) * 0.3, Math.cos(angle) * 0.3], 1.4, '#e3e3e3')
  }
  g.fillStyle = '#cfcfcf'
  g.beginPath()
  g.arc(px(0), py(0), 0.06 * LEAF_PX, 0, Math.PI * 2)
  g.fill()
  // Stamens: a ring of dots around the centre.
  g.fillStyle = '#bdbdbd'
  for (let k = 0; k < 10; k++) {
    const angle = (k / 10) * Math.PI * 2
    g.beginPath()
    g.arc(px(Math.sin(angle) * 0.11), py(Math.cos(angle) * 0.11), 0.014 * LEAF_PX, 0, Math.PI * 2)
    g.fill()
  }
}

/** A pine twig: one stem with paired needles sweeping upward along it. */
function drawPineTwig(g: Ctx) {
  stroke(g, [0, -0.49], [0.02, 0.4], 3, '#cbcbcb')
  for (let t = 0.04; t <= 0.96; t += 0.055) {
    const y = -0.49 + t * 0.89
    const x = 0.02 * t
    const length = 0.2 * (1 - t * 0.35)
    stroke(g, [x, y], [x + length, y + length * 0.9], 2.2, '#ffffff')
    stroke(g, [x, y], [x - length, y + length * 0.9], 2.2, '#ffffff')
  }
  stroke(g, [0.02, 0.4], [0.02, 0.49], 2.2, '#ffffff')
  stroke(g, [0.02, 0.4], [0.1, 0.48], 2.2, '#ffffff')
  stroke(g, [0.02, 0.4], [-0.06, 0.48], 2.2, '#ffffff')
}

/** A willow withe: a thin stem hanging from the top with narrow leaflets down its length. */
function drawWillowWithe(g: Ctx) {
  g.strokeStyle = '#cdcdcd'
  g.lineWidth = 2.4
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(px(-0.01), py(0.49))
  g.quadraticCurveTo(px(0.05), py(0), px(0.02), py(-0.49))
  g.stroke()
  g.fillStyle = '#ffffff'
  for (let t = 0.06; t <= 0.94; t += 0.065) {
    const y = 0.49 - t * 0.98
    const sx = 0.05 * 4 * t * (1 - t) + 0.02 * t - 0.01 * (1 - t)
    const side = Math.round(t / 0.065) % 2 === 0 ? 1 : -1
    const angle = side * 0.95
    g.save()
    g.translate(px(sx + side * 0.045), py(y - 0.03))
    g.rotate(angle)
    g.beginPath()
    g.ellipse(0, 0, 0.018 * LEAF_PX, 0.062 * LEAF_PX, 0, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }
}

/**
 * Coverage cards used to be a filled superellipse with leaves painted on
 * top — from any angle that read as a coin. The QR silhouette still owns
 * the module; the texture is only the species' own leaves, needles, or
 * blossoms, so the 3D crown is foliage, not plates.
 */
function drawCluster(g: Ctx, shape: LeafShape) {
  const rng = mulberry32(hashString(`cluster:${shape}`))
  const fills = ['#ffffff', '#f0f0f0', '#e4e4e4']
  if (shape === 'pineCanopy') {
    for (let i = 0; i < 5; i++) {
      const at: Pt = [(rng() - 0.5) * 0.2, (rng() - 0.5) * 0.16]
      const rotation = -0.4 + rng() * 0.8 + (i - 2) * 0.16
      const scale = 0.52 + rng() * 0.22
      stroke(g, mapped(at, scale, rotation, [0, -0.48]), mapped(at, scale, rotation, [0.02, 0.46]), 2.8, '#c8c8c8')
      for (let t = 0.05; t <= 0.95; t += 0.075) {
        const y = -0.46 + t * 0.88
        const len = 0.26 * (1 - t * 0.22)
        const needle = scale * (0.42 + rng() * 0.08)
        paintLeaf(g, 'pine', mapped(at, scale, rotation, [len * 0.18, y]), needle, rotation + 0.82, '#ffffff')
        paintLeaf(g, 'pine', mapped(at, scale, rotation, [-len * 0.18, y]), needle, rotation - 0.82, '#ffffff')
      }
    }
    return
  }
  if (shape === 'willowCanopy') {
    for (let i = 0; i < 8; i++) {
      paintLeaf(
        g,
        'willow',
        [(rng() - 0.5) * 0.34, (rng() - 0.5) * 0.18],
        0.58 + rng() * 0.28,
        (rng() - 0.5) * 0.4,
        fills[i % fills.length]!,
      )
    }
    return
  }
  const leaf: LeafShape = shape === 'mapleCanopy' ? 'maple' : shape === 'appleCanopy' ? 'apple' : 'cherry'
  if (leaf === 'cherry') {
    for (let i = 0; i < 9; i++) {
      paintLeaf(
        g,
        'cherry',
        [(rng() - 0.5) * 0.38, (rng() - 0.5) * 0.38],
        0.28 + rng() * 0.18,
        rng() * Math.PI * 2,
        fills[i % fills.length]!,
      )
    }
    return
  }
  for (let i = 0; i < 3; i++) {
    paintLeaf(
      g,
      leaf,
      [(rng() - 0.5) * 0.16, (rng() - 0.5) * 0.16],
      0.66 + rng() * 0.24,
      rng() * Math.PI * 2,
      fills[i % fills.length]!,
    )
  }
}

/** One apple, unit-free: body, dimple, stem. */
function drawApple(g: Ctx, cx: number, cy: number, r: number, tone: string) {
  g.fillStyle = tone
  g.beginPath()
  g.arc(px(cx) - r * 0.45, py(cy) - r * 0.1, r * 0.85, 0, Math.PI * 2)
  g.arc(px(cx) + r * 0.45, py(cy) - r * 0.1, r * 0.85, 0, Math.PI * 2)
  g.arc(px(cx), py(cy) + r * 0.15, r, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#d0d0d0'
  g.lineWidth = Math.max(1.2, r * 0.12)
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(px(cx), py(cy) - r * 0.75)
  g.lineTo(px(cx) + r * 0.25, py(cy) - r * 1.3)
  g.stroke()
}

/**
 * A module's worth of apples: the coverage cluster a fruit-heavy module wears
 * in autumn, opaque inside the outline like every cluster, red by tint.
 */
function drawAppleHeap(g: Ctx) {
  g.fillStyle = '#d4d4d4'
  trace(g, silhouette('appleHeap'))
  g.fill()
  g.save()
  trace(g, silhouette('appleHeap'))
  g.clip()
  const rng = mulberry32(hashString('cluster:appleHeap'))
  for (let i = 0; i < 11; i++) {
    const at: Pt = [(rng() - 0.5) * 0.76, (rng() - 0.5) * 0.76]
    drawApple(g, at[0], at[1], (0.09 + rng() * 0.05) * LEAF_PX, i % 4 === 0 ? '#e6e6e6' : '#ffffff')
  }
  g.restore()
}

/**
 * Draw a leaf from the same normalized outline used by layout and projection
 * tests, so alpha pixels and module-boundary maths cannot drift apart.
 * Coverage cards draw the species' leaves or needles, not a filled plate.
 */
export function leafTexture(shape: LeafShape = 'ovate'): CanvasTexture {
  const found = leaves[shape]
  if (found) return found
  const canvas = document.createElement('canvas')
  canvas.width = LEAF_PX
  canvas.height = LEAF_PX
  const g = canvas.getContext('2d')
  const texture = new CanvasTexture(canvas)
  leaves[shape] = texture
  if (!g) {
    return texture
  }
  g.clearRect(0, 0, LEAF_PX, LEAF_PX)
  if (shape.endsWith('Canopy')) drawCluster(g, shape)
  else if (shape === 'appleHeap') drawAppleHeap(g)
  else if (shape === 'blossom') drawBlossom(g)
  else if (shape === 'pineTwig') drawPineTwig(g)
  else if (shape === 'willowWithe') drawWillowWithe(g)
  else {
    fillShape(g, shape)
    // Veins never leave the leaf: a stroke past the outline would hang in
    // the air as a hairline.
    g.save()
    trace(g, silhouette(shape))
    g.clip()
    if (shape === 'maple') veinMaple(g)
    else if (shape === 'cherry' || shape === 'apple') veinBroadleaf(g)
    g.restore()
  }
  return finishMap(texture)
}

/** Five-petal blossom, the same outline the cherry crown already uses. */
export function petalTexture(): CanvasTexture {
  return leafTexture('blossom')
}

const fruits: Partial<Record<'round' | 'long', CanvasTexture>> = {}

/**
 * An apple: two shoulders, a dimple at the top with a short stem, a soft
 * highlight. Drawn white so the instance colour paints it red. `long` is a
 * lozenge kept for other fruit.
 */
export function fruitTexture(kind: 'round' | 'long' = 'round'): CanvasTexture {
  const found = fruits[kind]
  if (found) return found
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')
  const texture = new CanvasTexture(canvas)
  fruits[kind] = texture
  if (!g) return texture
  g.fillStyle = '#ffffff'
  if (kind === 'long') {
    g.beginPath()
    g.ellipse(size / 2, size / 2, size * 0.16, size * 0.42, 0.45, 0, Math.PI * 2)
    g.fill()
  } else {
    const c = size / 2
    g.beginPath()
    g.arc(c - size * 0.13, c + size * 0.03, size * 0.26, 0, Math.PI * 2)
    g.arc(c + size * 0.13, c + size * 0.03, size * 0.26, 0, Math.PI * 2)
    g.arc(c, c + size * 0.06, size * 0.3, 0, Math.PI * 2)
    g.fill()
    // Dimple: cut a little of the background back in at the top centre.
    g.save()
    g.globalCompositeOperation = 'destination-out'
    g.beginPath()
    g.ellipse(c, c - size * 0.24, size * 0.08, size * 0.05, 0, 0, Math.PI * 2)
    g.fill()
    g.restore()
    g.strokeStyle = '#d0d0d0'
    g.lineWidth = size * 0.035
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(c, c - size * 0.22)
    g.quadraticCurveTo(c + size * 0.04, c - size * 0.34, c + size * 0.08, c - size * 0.42)
    g.stroke()
    g.fillStyle = 'rgba(255,255,255,0.0)'
    g.fillStyle = '#f4f4f4'
    g.beginPath()
    g.ellipse(c - size * 0.13, c - size * 0.06, size * 0.06, size * 0.1, -0.5, 0, Math.PI * 2)
    g.fill()
  }
  return finishMap(texture)
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
    for (const [x0, tipX, tipY] of [
      [10, 6, 36],
      [18, 12, 22],
      [28, 24, 10],
      [38, 36, 6],
      [48, 48, 3],
      [58, 62, 8],
      [68, 76, 16],
      [78, 88, 30],
    ] as const) {
      g.beginPath()
      g.moveTo(x0, h)
      g.quadraticCurveTo(x0 + 5, 92, tipX, tipY)
      g.quadraticCurveTo(x0 + 14, 90, x0 + 12, h)
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
  return finishMap(texture)
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
  g.lineCap = 'round'
  // A few wide blades, not hairlines. Hairlines vanish at module size and
  // after luma pinning; these stay grass-shaped without punching a hole.
  g.strokeStyle = '#e0e0e0'
  g.lineWidth = 3.6
  for (let i = 0; i < 14; i++) {
    const x = 10 + ((i * 19) % 108)
    g.beginPath()
    g.moveTo(x + 4, size - 6)
    g.quadraticCurveTo(x + 1, 70, x + ((i % 5) - 2) * 11, 16 + (i % 6) * 6)
    g.stroke()
  }
  g.strokeStyle = '#cfcfcf'
  g.lineWidth = 4.2
  for (let i = 0; i < 7; i++) {
    const x = 18 + ((i * 29) % 92)
    g.beginPath()
    g.moveTo(x + 6, size - 8)
    g.quadraticCurveTo(x + 2, 56, x + ((i % 3) - 1) * 14, 8 + (i % 4) * 7)
    g.stroke()
  }
  g.restore()
  return finishMap(texture)
}

let bark: CanvasTexture | null = null

/**
 * Pale wood wash for the trunk and limbs. A few wide, faint bands only —
 * dense cracks read as noise at grove scale. Contrast stays modest so
 * overhead pale wood cannot darken a light QR module.
 */
export function barkTexture(): CanvasTexture {
  if (bark) return bark
  const width = 256
  const height = 512
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const g = canvas.getContext('2d')
  const texture = new CanvasTexture(canvas)
  bark = texture
  if (!g) return finishMap(texture)
  g.fillStyle = '#f0ebe3'
  g.fillRect(0, 0, width, height)
  const rng = mulberry32(hashString('bark-wash'))
  for (let i = 0; i < 6; i++) {
    const x0 = (i + 0.35 + rng() * 0.3) * (width / 6)
    g.strokeStyle = `rgba(132, 108, 82, ${0.035 + rng() * 0.04})`
    g.lineWidth = 18 + rng() * 22
    g.beginPath()
    g.moveTo(x0, 0)
    let x = x0
    for (let y = 0; y <= height; y += 48) {
      x += (rng() - 0.5) * 6
      g.lineTo(x, y)
    }
    g.stroke()
  }
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  return finishMap(texture)
}
