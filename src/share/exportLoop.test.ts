import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SceneRef } from '../scene/sceneState'
import {
  downloadLoopGif,
  LOOP_DELAY_MS,
  LOOP_FRAMES,
  preserveCurrentCameraAbortReason,
} from './exportLoop'
import type { ShareState } from './params'

const SHARE_STATE: ShareState = {
  url: 'https://example.com/grove',
  season: 'summer',
  tree: 'cherry',
  locked: false,
  mode: 'create',
  ink: 'plants',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('exported loop timing', () => {
  it('holds each frame long enough to read as a slow orbit', () => {
    expect(LOOP_DELAY_MS).toBeGreaterThanOrEqual(160)
    expect(LOOP_FRAMES).toBeGreaterThanOrEqual(16)
  })

  it('restores synchronously before a replacement capture starts', async () => {
    const controller = new AbortController()
    const createElement = vi.fn(() => {
      throw new Error('capture continued after abort')
    })
    vi.stubGlobal('document', {
      querySelector: () => ({ width: 8, height: 8 }),
      createElement,
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('requestAnimationFrame', () => 17)

    const scene: SceneRef = {
      current: {
        colors: {} as never,
        season: 'summer',
        yaw: 0.47,
        pitch: 0.82,
        renderedYaw: 0.47,
        renderedPitch: 0.82,
        renderedZoom: 1,
        spinYaw: 0.19,
        spinPitch: -0.11,
        dragging: false,
        pitchTarget: 1.2,
        yawTarget: -0.4,
        zoom: 1,
        zoomTarget: null,
        inkMix: 0,
      },
    }
    const startingCamera = { ...scene.current }

    const pending = downloadLoopGif(SHARE_STATE, scene, controller.signal)
    const stopped = pending.catch((error: unknown) => error)
    scene.current.yaw = 1.31
    scene.current.pitch = 0.68

    controller.abort()

    expect(scene.current).toEqual(startingCamera)

    const replacementController = new AbortController()
    const replacement = downloadLoopGif(SHARE_STATE, scene, replacementController.signal)
    const replacementStopped = replacement.catch((error: unknown) => error)
    expect(scene.current.yaw).toBe(startingCamera.yaw)
    expect(scene.current.pitch).toBe(startingCamera.pitch)
    replacementController.abort()

    const [stopReason, replacementStopReason] = await Promise.all([stopped, replacementStopped])

    expect(stopReason).toMatchObject({ name: 'AbortError' })
    expect(replacementStopReason).toMatchObject({ name: 'AbortError' })
    expect(createElement).not.toHaveBeenCalled()
    expect(scene.current).toEqual(startingCamera)
  })

  it('does not overwrite a camera claimed by Reveal when its capture is aborted', async () => {
    const controller = new AbortController()
    const createElement = vi.fn(() => {
      throw new Error('capture continued after Reveal abort')
    })
    vi.stubGlobal('document', {
      querySelector: () => ({ width: 8, height: 8 }),
      createElement,
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('requestAnimationFrame', () => 23)

    const scene: SceneRef = {
      current: {
        colors: {} as never,
        season: 'summer',
        yaw: 0.47,
        pitch: 0.82,
        renderedYaw: 0.47,
        renderedPitch: 0.82,
        renderedZoom: 1,
        spinYaw: 0.19,
        spinPitch: -0.11,
        dragging: false,
        pitchTarget: 1.2,
        yawTarget: -0.4,
        zoom: 1,
        zoomTarget: 1.15,
        inkMix: 0,
      },
    }

    const pending = downloadLoopGif(SHARE_STATE, scene, controller.signal)
    scene.current.pitchTarget = null
    scene.current.yawTarget = null
    scene.current.zoomTarget = null
    scene.current.spinYaw = 0
    scene.current.spinPitch = 0
    scene.current.dragging = false
    const frozenCamera = { ...scene.current }
    const stopped = pending.catch((error: unknown) => error)
    controller.abort(preserveCurrentCameraAbortReason())

    expect(scene.current).toEqual(frozenCamera)
    expect(await stopped).toMatchObject({ name: 'AbortError' })
    expect(createElement).not.toHaveBeenCalled()
    expect(scene.current).toEqual(frozenCamera)
  })
})
