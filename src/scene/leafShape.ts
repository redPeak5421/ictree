/**
 * DOM-free leaf geometry shared by layout, textures, and top-down QR tests.
 * Coordinates live in the unit plane used by Three.js PlaneGeometry.
 */

export type LeafShape =
  | 'ovate'
  | 'oak'
  | 'maple'
  | 'cherry'
  | 'willow'
  | 'pine'
  | 'apple'
  | 'banana'
  | 'blossom'
  | 'pineTwig'
  | 'willowWithe'
  | 'cherryCanopy'
  | 'appleCanopy'
  | 'mapleCanopy'
  | 'pineCanopy'
  | 'willowCanopy'
  | 'appleHeap'

export const LEAF_SHAPES: readonly LeafShape[] = [
  'ovate',
  'oak',
  'maple',
  'cherry',
  'willow',
  'pine',
  'apple',
  'banana',
  'blossom',
  'pineTwig',
  'willowWithe',
  'cherryCanopy',
  'appleCanopy',
  'mapleCanopy',
  'pineCanopy',
  'willowCanopy',
  'appleHeap',
]
/** Compatibility for the pre-species tree builder; remove once it passes shapes directly. */
export type Silhouette = LeafShape | 'leaf'
export type Point2 = readonly [number, number]

function ellipse(count: number, halfX: number, halfY: number, ripple = 0, teeth = 0): readonly Point2[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2
    const edge = 1 - ripple + ripple * ((Math.cos(teeth * angle) + 1) / 2)
    return [Math.sin(angle) * halfX * edge, Math.cos(angle) * halfY * edge] as const
  })
}

function superellipse(count: number, halfX: number, halfY: number, exponent: number): readonly Point2[] {
  const power = 2 / exponent
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2
    const sin = Math.sin(angle)
    const cos = Math.cos(angle)
    return [
      Math.sign(sin) * Math.abs(sin) ** power * halfX,
      Math.sign(cos) * Math.abs(cos) ** power * halfY,
    ] as const
  })
}

/**
 * A broadleaf with pointed ends: an ellipse whose width pinches toward both
 * tips, optionally serrated. Wide enough in the middle to carry QR coverage.
 */
function pointedLeaf(
  count: number,
  halfX: number,
  halfY: number,
  pinch: number,
  ripple = 0,
  teeth = 0,
): readonly Point2[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2
    const sin = Math.sin(angle)
    const cos = Math.cos(angle)
    const edge = 1 - ripple + ripple * ((Math.cos(teeth * angle) + 1) / 2)
    const width = halfX * (1 - pinch * Math.abs(cos) ** 2.2)
    return [sin * width * edge, cos * halfY * edge] as const
  })
}

/**
 * A palmate maple leaf: five pointed lobes cut by deep sinuses, the two
 * lower lobes smaller than the three upper ones, the top lobe on +y.
 */
function mapleOutline(): readonly Point2[] {
  const count = 160
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2
    const phase = ((angle / (Math.PI * 2)) * 5 + 0.5) % 1
    const tip = 1 - Math.abs(phase - 0.5) * 2
    // Sharp tips, deep sinuses: the lobe profile is peaked, not rounded.
    const radius = 0.49 * (0.22 + 0.78 * tip ** 1.7) * (0.82 + 0.18 * Math.cos(angle))
    return [Math.sin(angle) * radius, Math.cos(angle) * radius] as const
  })
}

/** A five-petal cherry blossom, each petal notched at its tip. Fits inside the cherry leaf box. */
function blossomOutline(): readonly Point2[] {
  const count = 150
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2
    const petal = (Math.cos(5 * angle) + 1) / 2
    // Broad petals that separate clearly, each with a heart-shaped notch.
    const notch = 1 - 0.2 * petal ** 12
    const radius = 0.4 * (0.3 + 0.7 * petal ** 0.4) * notch
    return [Math.sin(angle) * radius, Math.cos(angle) * radius] as const
  })
}

function oakOutline(): readonly Point2[] {
  const count = 64
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2
    const lobes = ((Math.cos(6 * angle) + 1) / 2) ** 1.35
    const radius = 0.35 + lobes * 0.13
    return [Math.sin(angle) * radius * 0.9, Math.cos(angle) * radius] as const
  })
}

function pineOutline(): readonly Point2[] {
  const count = 36
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2
    const radius = 0.49 * (0.22 + 0.78 * Math.abs(Math.cos(angle)))
    return [Math.sin(angle) * 0.09, Math.cos(angle) * radius] as const
  })
}

/**
 * A cluster of a species' leaves seen as one mass: the near-square ovate
 * footprint that carries QR coverage, with the species' edge character —
 * serrations, lobes, bristles, hanging tips — as a shallow fringe. The
 * fringe stays shallow on purpose: it is what the eye reads from the side,
 * while the module underneath must still be filled from above.
 */
function clusterOutline(count: number, teeth: number, amp: number, power: number): readonly Point2[] {
  const base = superellipse(count, 0.49, 0.49, 2.8)
  return base.map(([x, y], index) => {
    const angle = (index / count) * Math.PI * 2
    const fringe = 1 - amp + amp * ((Math.cos(teeth * angle) + 1) / 2) ** power
    return [x * fringe, y * fringe] as const
  })
}

const OUTLINES: Record<LeafShape, readonly Point2[]> = {
  ovate: superellipse(64, 0.48, 0.49, 2.8),
  oak: oakOutline(),
  maple: mapleOutline(),
  cherry: pointedLeaf(64, 0.4, 0.49, 0.45, 0.04, 14),
  willow: ellipse(48, 0.14, 0.49, 0.03, 8),
  pine: pineOutline(),
  apple: pointedLeaf(64, 0.45, 0.49, 0.35, 0.025, 10),
  banana: superellipse(48, 0.2, 0.49, 2.2),
  blossom: blossomOutline(),
  // Twig and withe are drawn inside these boxes by leafTexture; the box only
  // bounds their footprint for fitScale.
  pineTwig: ellipse(32, 0.3, 0.49),
  willowWithe: ellipse(32, 0.12, 0.49),
  cherryCanopy: clusterOutline(80, 16, 0.05, 1),
  appleCanopy: clusterOutline(80, 10, 0.04, 1),
  mapleCanopy: clusterOutline(80, 5, 0.075, 1.5),
  pineCanopy: clusterOutline(90, 18, 0.075, 0.7),
  willowCanopy: clusterOutline(81, 9, 0.05, 1.2),
  // Same footprint as the apple cluster: a fruit module swaps texture, not bounds.
  appleHeap: clusterOutline(80, 10, 0.04, 1),
}

function normalizedShape(shape: Silhouette): LeafShape {
  return shape === 'leaf' ? 'ovate' : shape
}

export function silhouette(shape: Silhouette = 'ovate'): readonly Point2[] {
  return OUTLINES[normalizedShape(shape)]
}

/** DOM-free renderer routing, kept beside the complete supported shape union. */
export function textureKindForLeafShape(shape: LeafShape): LeafShape {
  return shape
}

export function boundsOfOutline(outline: readonly Point2[]): [number, number] {
  let halfX = 0
  let halfY = 0
  for (const [x, y] of outline) {
    halfX = Math.max(halfX, Math.abs(x))
    halfY = Math.max(halfY, Math.abs(y))
  }
  return [halfX, halfY]
}

/** Area of a simple outline (shoelace), for coverage comparisons in tests. */
export function areaOfOutline(outline: readonly Point2[]): number {
  let sum = 0
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i]!
    const [x1, y1] = outline[(i + 1) % outline.length]!
    sum += x0 * y1 - x1 * y0
  }
  return Math.abs(sum) / 2
}

const EXTENTS = Object.fromEntries(
  LEAF_SHAPES.map((shape) => [shape, boundsOfOutline(OUTLINES[shape])]),
) as Record<LeafShape, [number, number]>

export function halfExtents(shape: Silhouette = 'ovate'): [number, number] {
  return EXTENTS[normalizedShape(shape)]
}

/** World x/z half-extents of a flat silhouette at scale 1. */
export function footprint(phi: number, shape: Silhouette = 'ovate'): [number, number] {
  const [halfX, halfY] = halfExtents(shape)
  const c = Math.abs(Math.cos(phi))
  const s = Math.abs(Math.sin(phi))
  return [halfX * c + halfY * s, halfX * s + halfY * c]
}

export interface Bounds {
  left: number
  right: number
  back: number
  front: number
}

/** Largest scale at which the rotated outline stays inside asymmetric bounds. */
export function fitScale(
  ox: number,
  oz: number,
  phi: number,
  bounds: Bounds,
  cap: number,
  shape: Silhouette = 'ovate',
): number {
  const [extentX, extentZ] = footprint(phi, shape)
  const scale = Math.min(
    (bounds.right - ox) / extentX,
    (ox - bounds.left) / extentX,
    (bounds.front - oz) / extentZ,
    (oz - bounds.back) / extentZ,
  )
  return Math.max(0, Math.min(cap, scale * 0.985))
}

export interface Slot {
  id: number
  ox: number
  oz: number
  phi: number
  cap: number
}

/**
 * Coverage-first module slots. IDs are stable ownership keys: a module may use
 * each ID once, and must never repeat the same pack at another crown height.
 */
export function qrSlots(count: number, rng: () => number): Slot[] {
  const jitter = () => (rng() - 0.5) * 0.02
  const near = (phi: number) => phi + (rng() - 0.5) * 0.18
  const values: Omit<Slot, 'id'>[] = [
    { ox: jitter(), oz: jitter(), phi: near(0), cap: 1 },
    { ox: 0.28 + jitter(), oz: jitter(), phi: near(0), cap: 0.9 },
    { ox: -0.28 + jitter(), oz: jitter(), phi: near(0), cap: 0.9 },
    { ox: jitter(), oz: 0.28 + jitter(), phi: near(Math.PI / 2), cap: 0.9 },
    { ox: jitter(), oz: -0.28 + jitter(), phi: near(Math.PI / 2), cap: 0.9 },
    { ox: 0.16 + jitter(), oz: 0.16 + jitter(), phi: near(0), cap: 0.8 },
    { ox: -0.16 + jitter(), oz: 0.16 + jitter(), phi: near(Math.PI / 2), cap: 0.8 },
    { ox: 0.16 + jitter(), oz: -0.16 + jitter(), phi: near(Math.PI / 2), cap: 0.8 },
    { ox: -0.16 + jitter(), oz: -0.16 + jitter(), phi: near(0), cap: 0.8 },
    { ox: 0.3 + jitter(), oz: 0.3 + jitter(), phi: near(Math.PI / 4), cap: 0.75 },
    { ox: -0.3 + jitter(), oz: 0.3 + jitter(), phi: near(-Math.PI / 4), cap: 0.75 },
    { ox: 0.3 + jitter(), oz: -0.3 + jitter(), phi: near(-Math.PI / 4), cap: 0.75 },
    { ox: -0.3 + jitter(), oz: -0.3 + jitter(), phi: near(Math.PI / 4), cap: 0.75 },
  ]
  return values
    .map((slot, id) => ({ id, ...slot }))
    .slice(0, Math.max(1, Math.min(values.length, count)))
}
