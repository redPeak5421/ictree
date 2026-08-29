import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera } from 'three'
import { clampZoom, stepSpin } from './orbit'
import type { SceneRef } from './sceneState'
import { cameraPose, glideAngle, isOverhead, squareYaw, OVERHEAD } from './view'

export function OrbitCamera({
  scene,
  island,
  qrSpan,
  crownTop,
  reduced,
  onOverhead,
}: {
  scene: SceneRef
  island: number
  qrSpan: number
  crownTop: number
  reduced: boolean
  /** Called when the view arrives at, or leaves, straight down. */
  onOverhead: (overhead: boolean) => void
}) {
  const { camera, size } = useThree()
  const wasOverhead = useRef<boolean | null>(null)

  useEffect(() => {
    wasOverhead.current = null
  }, [onOverhead])

  useFrame((_, dt) => {
    const state = scene.current
    const step = Math.min(dt, 0.05)
    if (!state.dragging) {
      if (state.pitchTarget !== null) {
        state.spinPitch = 0
        const [pitch, done] = glideAngle(state.pitch, state.pitchTarget, reduced ? 1e9 : step)
        state.pitch = pitch
        if (done) state.pitchTarget = null
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
        const [yaw, done] = glideAngle(state.yaw, state.yawTarget, reduced ? 1e9 : step)
        state.yaw = yaw
        if (done) state.yawTarget = null
      }
      // A flick keeps the island turning after the finger lifts.
      if (reduced) {
        state.spinYaw = 0
        state.spinPitch = 0
      } else {
        stepSpin(state, step)
      }
    }
    // The code is read at fit-to-frame: heading overhead lets the zoom go.
    if (state.pitchTarget === OVERHEAD && state.zoom !== 1) state.zoomTarget = 1
    if (state.zoomTarget !== null) {
      const [zoom, done] = glideAngle(state.zoom, state.zoomTarget, reduced ? 1e9 : step)
      state.zoom = clampZoom(zoom)
      if (done) state.zoomTarget = null
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
    const aspect = size.width / Math.max(1, size.height)
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
  })

  return null
}
