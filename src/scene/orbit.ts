/**
 * Turning the island by hand. A drag orbits the camera about the island's
 * centre — heading freely, elevation from a low glance across the paving to
 * straight down — and a flick keeps it turning for a moment. Straight down is
 * where the canopy is the code, so a release near the top glides the rest of
 * the way there.
 */
export interface OrbitState {
  yaw: number
  pitch: number
  spinYaw: number
  spinPitch: number
}

export const PITCH_MIN = 0.12
export const PITCH_MAX = Math.PI / 2
/** Let go above this elevation and the camera settles the rest of the way overhead. */
export const SNAP_PITCH = 1.3

/** Radians per pixel of drag. */
export const DRAG_YAW = 0.008
export const DRAG_PITCH = 0.006

/** A pointer that moves less than this before lifting is a tap, not a drag. */
export const TAP_SLOP = 6

/** Spin decays by e^-SPIN_DAMPING per second after the pointer lets go. */
export const SPIN_DAMPING = 4

export const ZOOM_MIN = 1
export const ZOOM_MAX = 4.5

export function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
}

/** Wheel notches or a pinch ratio, applied multiplicatively. */
export function applyZoom(zoom: number, factor: number): number {
  return clampZoom(zoom * factor)
}

/** A wheel delta in pixels becomes a magnification factor. */
export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * 0.0016)
}

export function clampPitch(pitch: number): number {
  return Math.min(PITCH_MAX, Math.max(PITCH_MIN, pitch))
}

/**
 * Apply one pointer movement. Dragging right turns the scene right — i.e. the
 * camera moves left around it, which is a decreasing heading — and dragging
 * down tips the camera up over the island.
 */
export function applyDrag(orbit: OrbitState, dx: number, dy: number, dt: number): void {
  const dYaw = -dx * DRAG_YAW
  const dPitch = dy * DRAG_PITCH
  orbit.yaw += dYaw
  orbit.pitch = clampPitch(orbit.pitch + dPitch)
  if (dt > 1e-4) {
    // Smoothed so a single jittery event does not become the flick velocity.
    const k = 0.5
    orbit.spinYaw += (dYaw / dt - orbit.spinYaw) * k
    orbit.spinPitch += (dPitch / dt - orbit.spinPitch) * k
  }
}

/** Carry the flick on after release, decaying toward rest. */
export function stepSpin(orbit: OrbitState, dt: number): void {
  if (orbit.spinYaw === 0 && orbit.spinPitch === 0) return
  orbit.yaw += orbit.spinYaw * dt
  const next = orbit.pitch + orbit.spinPitch * dt
  orbit.pitch = clampPitch(next)
  if (orbit.pitch !== next) orbit.spinPitch = 0
  const damp = Math.exp(-SPIN_DAMPING * dt)
  orbit.spinYaw *= damp
  orbit.spinPitch *= damp
  if (Math.abs(orbit.spinYaw) < 0.002) orbit.spinYaw = 0
  if (Math.abs(orbit.spinPitch) < 0.002) orbit.spinPitch = 0
}

/** Screen-right in world x/z for a camera at this heading. */
export function rightOf(yaw: number): [number, number] {
  return [Math.cos(yaw), -Math.sin(yaw)]
}
