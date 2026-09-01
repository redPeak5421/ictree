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
  /** Last yaw actually applied to the rendered camera. */
  renderedYaw: number
  /** Last pitch actually applied to the rendered camera. */
  renderedPitch: number
  /** Last zoom actually applied to the rendered camera projection. */
  renderedZoom: number
  /** Angular velocity left over from a drag, radians per second. */
  spinYaw: number
  spinPitch: number
  /** A pointer is currently turning the scene: no inertia until it lets go. */
  dragging: boolean
  /** Elevation the camera is gliding to after a tap or a near-overhead release. */
  pitchTarget: number | null
  /** Heading it squares up to on the way overhead. */
  yawTarget: number | null
  /** Magnification about the island centre; 1 fits the whole island. */
  zoom: number
  /** Magnification the camera is gliding to (overhead always returns to 1). */
  zoomTarget: number | null
  /** 0 = plants, 1 = colour-block mosaic. Eased independently of pitch. */
  inkMix: number
}

export type SceneRef = { current: SceneState }
