import { SLAB_H, VIEW_PITCH } from './tree'

/** Straight down: the one elevation at which the canopy reads as the code. */
export const OVERHEAD = Math.PI / 2
/** The camera eases to a tapped view over roughly this long. */
export const VIEW_MS = 900
export const SEASON_MS = 280

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * Weather (rain, petals, falling leaves) is not part of the code. It thins
 * out on the way to overhead so the scan is not a snow of particles. Grass,
 * leaves and the lawn stay put — the QR is formed by the camera angle.
 */
export function sceneryOpacity(pitch: number): number {
  return 1 - smoothstep(1.2, 1.48, pitch)
}

export function isOverhead(pitch: number): boolean {
  return pitch >= OVERHEAD - 1e-3
}

export interface CameraPose {
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
  // Half-extent of the island square along either screen axis at this heading.
  const hx = (island / 2) * (Math.abs(cosY) + Math.abs(sinY))
  const crownR = island * 0.55
  // Overhead, a decoder wants two clear modules around the code.
  const halfW = Math.max(hx, crownR, (qrSpan + 4) / 2)
  // On screen a point's height is y*cos(elev) + depth*sin(elev): the slab's
  // near edge and underside set the bottom. The top is the crown's highest
  // projected point, taken as an ellipsoid from the trunk top to crownTop and
  // as wide as the island — from a shallow angle its apex, but up high the far
  // rim rises past the apex and framing the apex alone would cut the crown.
  const bottom = -hx * sinE - SLAB_H * cosE
  const crownMid = (crownTop + island * 0.22) / 2
  const crownH = crownTop - crownMid
  const top = Math.max(crownMid * cosE + Math.hypot(crownH * cosE, crownR * sinE) + 1, hx * sinE)
  // Screen-up in world space is exactly perpendicular to the view direction,
  // so lookAt keeps it and the view stays continuous through straight down.
  const up: [number, number, number] = [-sinE * sinY, cosE, -sinE * cosY]
  const mid = (top + bottom) / 2
  const target: [number, number, number] = [up[0] * mid, up[1] * mid, up[2] * mid]
  const dist = island * 2.3
  return {
    position: [target[0] + dist * cosE * sinY, target[1] + dist * sinE, target[2] + dist * cosE * cosY],
    target,
    up,
    spanX: 2 * halfW * MARGIN,
    spanY: (top - bottom) * MARGIN,
  }
}

/**
 * Glide an angle toward a target after a tap or a near-overhead release.
 * Returns true once it has arrived (and been pinned exactly).
 */
export function glideAngle(current: number, target: number, dt: number): [number, boolean] {
  const next = current + (target - current) * (1 - Math.exp(-dt * 7))
  if (Math.abs(target - next) < 2e-3) return [target, true]
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

export { VIEW_PITCH }
