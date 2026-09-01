import { SLAB_H, VIEW_PITCH } from './tree'

/** Straight down: the one elevation at which the canopy reads as the code. */
export const OVERHEAD = Math.PI / 2
/** The camera eases to a tapped view over roughly this long. */
export const VIEW_MS = 900
export const SEASON_MS = 280

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/** Quadratic ease-in-out: constant +a then −a. Slow, fast, slow. */
function easeInOutQuad(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2
}

export interface AngleGlide {
  from: number
  to: number
  elapsed: number
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * Weather (rain, petals, falling leaves) thins out on the way to overhead
 * so the scan is not a snow of particles.
 */
export function sceneryOpacity(pitch: number): number {
  return 1 - smoothstep(1.2, 1.48, pitch)
}

/**
 * Colour-block ink follows the same camera move as the plant scene. Mix is
 * the elevation, not a tap timer: the side view stays the tree, and the
 * mosaic grows as the camera goes overhead. The band covers most of the
 * 900ms glide so leaves have time to settle into tiles.
 */
const INK_FADE_RATE = 8

export function inkMixTarget(blocks: boolean, pitch: number): number {
  if (!blocks) return 0
  return smoothstep(0.52, 1.48, pitch)
}

export function stepInkMix(current: number, target: number, dt: number, instant = false): number {
  if (instant) return target
  const next = current + (target - current) * (1 - Math.exp(-dt * INK_FADE_RATE))
  if (next < 0.002 && target <= next) return 0
  if (next > 0.998 && target >= next) return 1
  return next
}

/** Loose crown blocks start this wide before settling into the mosaic. */
export const TILE_LOOSE = 0.36
/** Settled gapped tiles leave a grout line on the 1-unit module grid. */
export const TILE_GAPPED = 0.96
/** Settled solid tiles meet edge to edge — no whitespace between modules. */
export const TILE_SOLID = 1

/**
 * Tile footprint during the camera-led conversion. The settled edge blends
 * the gapped and solid styles by `solidity`, and the whole width rides the
 * same eased mix as the rest of the conversion, so the trip back to the tree
 * is continuous in scale for both styles and a style switch never pops.
 */
export function tileEdge(mix: number, solidity: number): number {
  const settled = TILE_GAPPED + (TILE_SOLID - TILE_GAPPED) * solidity
  return TILE_LOOSE + (settled - TILE_LOOSE) * mix
}

export function plantInkOpacity(mix: number): number {
  return 1 - smoothstep(0.05, 0.88, mix)
}

export function blockInkOpacity(mix: number): number {
  return smoothstep(0.12, 0.95, mix)
}

export function isOverhead(pitch: number): boolean {
  return pitch >= OVERHEAD - 1e-3
}

interface CameraPose {
  position: [number, number, number]
  target: [number, number, number]
  up: [number, number, number]
  /** World width and height that must stay inside the frame. */
  spanX: number
  spanY: number
}

const MARGIN = 1.05

/**
 * The camera is derived from a heading and an elevation about the island's
 * centre — never the other way round — so the framing maths below always
 * describes the view that is actually rendered. There is one view, not two:
 * overhead is simply elevation OVERHEAD, and from there the leaves are the
 * code because of where they grow, not because anything moved.
 */
export function cameraPose(
  yaw: number,
  pitch: number,
  island: number,
  qrSpan = island,
  crownTop = island * 0.9,
): CameraPose {
  const sinE = Math.sin(pitch)
  const cosE = Math.cos(pitch)
  const sinY = Math.sin(yaw)
  const cosY = Math.cos(yaw)
  const hx = (island / 2) * Math.SQRT2
  const halfW = Math.max(hx, (qrSpan + 4) / 2)
  // Frame and look-at are pitch-invariant: fitting the changing silhouette
  // used to zoom out then in, which read as backing away then approaching.
  const sinSide = Math.sin(VIEW_PITCH)
  const cosSide = Math.cos(VIEW_PITCH)
  const bottom = -halfW * sinSide - SLAB_H * cosSide
  const apex = crownTop * cosSide
  const mid = (Math.max(apex, halfW * sinSide) + bottom) / 2
  const lookY = mid / cosSide
  const up: [number, number, number] = [-sinE * sinY, cosE, -sinE * cosY]
  const target: [number, number, number] = [0, lookY, 0]
  const dist = island * 2.3
  const span = 2 * halfW * MARGIN
  return {
    position: [target[0] + dist * cosE * sinY, target[1] + dist * sinE, target[2] + dist * cosE * cosY],
    target,
    up,
    spanX: span,
    spanY: span,
  }
}

/**
 * Glide an angle toward a target after a tap or a near-overhead release.
 * Duration is VIEW_MS; the curve is ease-in-out with uniform accel/decel.
 * Returns the next value and whether it has arrived (pinned exactly).
 */
export function stepAngleGlide(glide: AngleGlide, dt: number, duration = VIEW_MS / 1000): [number, boolean] {
  const span = glide.to - glide.from
  if (!Number.isFinite(span) || Math.abs(span) < 2e-3) {
    glide.elapsed = duration
    return [glide.to, true]
  }
  const step = Number.isFinite(dt) && dt > 0 ? dt : 0
  glide.elapsed += step
  const u = duration <= 0 ? 1 : Math.min(1, glide.elapsed / duration)
  const next = glide.from + span * easeInOutQuad(u)
  if (u >= 1) return [glide.to, true]
  return [next, false]
}

/**
 * The heading at which the code sits square on screen nearest to this one.
 * Going overhead turns to it as well, so the code is not read on the diagonal
 * — a camera move only; the island itself never turns.
 */
export function squareYaw(yaw: number): number {
  const quarter = Math.PI / 2
  return Math.round(yaw / quarter) * quarter
}

