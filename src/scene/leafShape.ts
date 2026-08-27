/**
 * Geometry of the leaf silhouette that `leafTexture` draws, kept free of DOM so
 * the tree builder and its tests can reason about footprints in node.
 *
 * The ovate leaf is inset inside its unit plane: these are the half-extents of
 * its bounding box, in plane units (slightly conservative vs. the drawn path).
 */
export const LEAF_HALF_X = 0.43
export const LEAF_HALF_Y = 0.47

export type Silhouette = 'leaf'

export function halfExtents(_kind: Silhouette): [number, number] {
  return [LEAF_HALF_X, LEAF_HALF_Y]
}

/**
 * World x/z half-extents of a flat silhouette at scale 1 whose heading about
 * the vertical is `phi`. Symmetric in phi, so the sign convention of the
 * renderer's euler order does not matter.
 */
export function footprint(phi: number, kind: Silhouette = 'leaf'): [number, number] {
  const [hx, hy] = halfExtents(kind)
  const c = Math.abs(Math.cos(phi))
  const s = Math.abs(Math.sin(phi))
  return [hx * c + hy * s, hx * s + hy * c]
}

/** Allowed extents from a module's centre, per side, in module units. */
export interface Bounds {
  left: number
  right: number
  back: number
  front: number
}

/**
 * Largest scale at which a leaf centred at (ox, oz) with heading `phi` stays
 * inside `bounds`. This is the guarantee that a leaf never crosses into a light
 * module: the footprint is computed from the silhouette's true extents, not from
 * a bounding circle, so edge leaves can reach their module's edge.
 */
export function fitScale(
  ox: number,
  oz: number,
  phi: number,
  b: Bounds,
  cap: number,
  kind: Silhouette = 'leaf',
): number {
  const [ex, ez] = footprint(phi, kind)
  const s = Math.min((b.right - ox) / ex, (ox - b.left) / ex, (b.front - oz) / ez, (oz - b.back) / ez)
  return Math.max(0, Math.min(cap, s * 0.985))
}

export interface Slot {
  ox: number
  oz: number
  phi: number
  cap: number
}

/**
 * Where the leaves of one dark module land, in module units. Ordered by how
 * much coverage each slot buys, so a shorter prefix is still the best layout at
 * that count. Edge and corner slots face their long axis along the edge they
 * sit on, which is what lets them reach it.
 */
export function qrSlots(count: number, rng: () => number): Slot[] {
  const j = () => (rng() - 0.5) * 0.06
  const any = () => rng() * Math.PI * 2
  const near = (phi: number) => phi + (rng() - 0.5) * 0.5
  const slots: Slot[] = [
    { ox: j(), oz: j(), phi: any(), cap: 1.0 },
    { ox: 0.28 + j(), oz: j(), phi: near(0), cap: 0.9 },
    { ox: -0.28 + j(), oz: j(), phi: near(0), cap: 0.9 },
    { ox: j(), oz: 0.28 + j(), phi: near(Math.PI / 2), cap: 0.9 },
    { ox: j(), oz: -0.28 + j(), phi: near(Math.PI / 2), cap: 0.9 },
    { ox: 0.16 + j(), oz: 0.16 + j(), phi: any(), cap: 0.8 },
    { ox: -0.16 + j(), oz: 0.16 + j(), phi: any(), cap: 0.8 },
    { ox: 0.16 + j(), oz: -0.16 + j(), phi: any(), cap: 0.8 },
    { ox: -0.16 + j(), oz: -0.16 + j(), phi: any(), cap: 0.8 },
    { ox: 0.3 + j(), oz: 0.3 + j(), phi: near(Math.PI / 4), cap: 0.75 },
    { ox: -0.3 + j(), oz: 0.3 + j(), phi: near(-Math.PI / 4), cap: 0.75 },
    { ox: 0.3 + j(), oz: -0.3 + j(), phi: near(-Math.PI / 4), cap: 0.75 },
    { ox: -0.3 + j(), oz: -0.3 + j(), phi: near(Math.PI / 4), cap: 0.75 },
  ]
  return slots.slice(0, Math.max(1, Math.min(slots.length, count)))
}
