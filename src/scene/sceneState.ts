import type { SceneColors, Season } from './palettes'

/**
 * Mutable scene channel. The season cross-fade and the orbit run at 60fps; if
 * they lived in React state every frame would re-render the whole tree, so the
 * animated values are written here and read inside `useFrame` instead.
 */
export interface SceneState {
  colors: SceneColors
  season: Season
  /** Camera heading about the vertical, radians. Grass billboards face it. */
  yaw: number
  /** Camera elevation above the ground, radians; OVERHEAD is straight down. */
  pitch: number
  /** Angular velocity left over from a drag, radians per second. */
  spinYaw: number
  spinPitch: number
  /** A pointer is currently turning the scene: no inertia until it lets go. */
  dragging: boolean
  /** Elevation the camera is gliding to after a tap or a near-overhead release. */
  pitchTarget: number | null
  /** Heading it squares up to on the way overhead. */
  yawTarget: number | null
}

export type SceneRef = { current: SceneState }
