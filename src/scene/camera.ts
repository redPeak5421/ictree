import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera } from 'three'
import { clampZoom, stepSpin } from './orbit'
import type { SceneRef } from './sceneState'
import { cameraPose, isOverhead, squareYaw, stepAngleGlide, OVERHEAD, type AngleGlide } from './view'

interface ProjectionAspectSelection {
  aspect: number
  frozenAspect: number | null
}

interface ClaimableCameraState {
  yaw: number
  pitch: number
  zoom: number
  renderedYaw: number
  renderedPitch: number
  renderedZoom: number
  spinYaw: number
  spinPitch: number
  dragging: boolean
  pitchTarget: number | null
  yawTarget: number | null
  zoomTarget: number | null
}

/** Gives Reveal the last pose actually applied to the camera and stops motion. */
export function claimRenderedCameraState(state: ClaimableCameraState): void {
  const yaw = Number.isFinite(state.renderedYaw)
    ? state.renderedYaw
    : Number.isFinite(state.yaw) ? state.yaw : 0
  const pitch = Number.isFinite(state.renderedPitch)
    ? state.renderedPitch
    : Number.isFinite(state.pitch) ? state.pitch : 0
  const zoom = Number.isFinite(state.renderedZoom) && state.renderedZoom > 0
    ? state.renderedZoom
    : Number.isFinite(state.zoom) && state.zoom > 0 ? state.zoom : 1
  state.yaw = state.renderedYaw = yaw
  state.pitch = state.renderedPitch = pitch
  state.zoom = state.renderedZoom = zoom
  state.spinYaw = 0
  state.spinPitch = 0
  state.dragging = false
  state.pitchTarget = null
  state.yawTarget = null
  state.zoomTarget = null
}

/** Selects the live CSS aspect or retains the snapshot captured on freeze. */
export function selectProjectionAspect(
  liveAspect: number,
  freezeProjection: boolean,
  frozenAspect: number | null,
): ProjectionAspectSelection {
  const safeLiveAspect = Number.isFinite(liveAspect) && liveAspect > 0 ? liveAspect : 1
  if (!freezeProjection) return { aspect: safeLiveAspect, frozenAspect: null }
  const snapshot = frozenAspect !== null && Number.isFinite(frozenAspect) && frozenAspect > 0
    ? frozenAspect
    : safeLiveAspect
  return { aspect: snapshot, frozenAspect: snapshot }
}

export function OrbitCamera({
  scene,
  island,
  qrSpan,
  crownTop,
  reduced,
  freezeProjection = false,
  onOverhead,
}: {
  scene: SceneRef
  island: number
  qrSpan: number
  crownTop: number
  reduced: boolean
  freezeProjection?: boolean
  /** Called when the view arrives at, or leaves, straight down. */
  onOverhead: (overhead: boolean) => void
}) {
  const { camera, size } = useThree()
  const wasOverhead = useRef<boolean | null>(null)
  const frozenAspect = useRef<number | null>(null)
  const pitchGlide = useRef<AngleGlide | null>(null)
  const yawGlide = useRef<AngleGlide | null>(null)
  const zoomGlide = useRef<AngleGlide | null>(null)

  useEffect(() => {
    wasOverhead.current = null
  }, [onOverhead])

  useFrame((_, dt) => {
    const state = scene.current
    const step = Math.min(dt, 0.05)
    if (!state.dragging) {
      if (state.pitchTarget !== null) {
        state.spinPitch = 0
        if (!pitchGlide.current || pitchGlide.current.to !== state.pitchTarget) {
          pitchGlide.current = { from: state.pitch, to: state.pitchTarget, elapsed: 0 }
        }
        const [pitch, done] = stepAngleGlide(pitchGlide.current, reduced ? 1e9 : step)
        state.pitch = pitch
        if (done) {
          state.pitchTarget = null
          pitchGlide.current = null
        }
      } else {
        pitchGlide.current = null
      }
      // However it got there — a flick that ran out at the top included — the
      // overhead view squares the code up on screen.
      if (
        state.yawTarget === null &&
        state.pitchTarget === null &&
        state.spinYaw === 0 &&
        isOverhead(state.pitch) &&
        state.yaw !== squareYaw(state.yaw)
      ) {
        state.yawTarget = squareYaw(state.yaw)
      }
      if (state.yawTarget !== null) {
        state.spinYaw = 0
        if (!yawGlide.current || yawGlide.current.to !== state.yawTarget) {
          yawGlide.current = { from: state.yaw, to: state.yawTarget, elapsed: 0 }
        }
        const [yaw, done] = stepAngleGlide(yawGlide.current, reduced ? 1e9 : step)
        state.yaw = yaw
        if (done) {
          state.yawTarget = null
          yawGlide.current = null
        }
      } else {
        yawGlide.current = null
      }
      // A flick keeps the island turning after the finger lifts.
      if (reduced) {
        state.spinYaw = 0
        state.spinPitch = 0
      } else {
        stepSpin(state, step)
      }
    } else {
      pitchGlide.current = null
      yawGlide.current = null
    }
    // The code is read at fit-to-frame: heading overhead lets the zoom go.
    if (state.pitchTarget === OVERHEAD && state.zoom !== 1) state.zoomTarget = 1
    if (state.zoomTarget !== null) {
      if (!zoomGlide.current || zoomGlide.current.to !== state.zoomTarget) {
        zoomGlide.current = { from: state.zoom, to: state.zoomTarget, elapsed: 0 }
      }
      const [zoom, done] = stepAngleGlide(zoomGlide.current, reduced ? 1e9 : step)
      state.zoom = clampZoom(zoom)
      if (done) {
        state.zoomTarget = null
        zoomGlide.current = null
      }
    } else {
      zoomGlide.current = null
    }
    const overhead = isOverhead(state.pitch)
    if (overhead !== wasOverhead.current) {
      wasOverhead.current = overhead
      onOverhead(overhead)
    }
    const pose = cameraPose(state.yaw, state.pitch, island, qrSpan, crownTop)
    camera.position.set(pose.position[0], pose.position[1], pose.position[2])
    camera.up.set(pose.up[0], pose.up[1], pose.up[2]).normalize()
    camera.lookAt(pose.target[0], pose.target[1], pose.target[2])
    if (!(camera instanceof OrthographicCamera)) return
    const projection = selectProjectionAspect(
      size.width / Math.max(1, size.height),
      freezeProjection,
      frozenAspect.current,
    )
    frozenAspect.current = projection.frozenAspect
    const aspect = projection.aspect
    // Whichever axis is tighter wins, so a portrait viewport fills its width
    // instead of shrinking the scene to fit a square.
    const halfY = Math.max(pose.spanY / 2, pose.spanX / 2 / aspect) / state.zoom
    camera.top = halfY
    camera.bottom = -halfY
    camera.left = -halfY * aspect
    camera.right = halfY * aspect
    camera.near = 0.1
    camera.far = island * 12
    camera.updateProjectionMatrix()
    state.renderedYaw = state.yaw
    state.renderedPitch = state.pitch
    state.renderedZoom = state.zoom
  })

  return null
}
