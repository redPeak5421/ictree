import { describe, expect, it } from 'vitest'
import { claimRenderedCameraState, selectProjectionAspect } from './camera'

describe('claimRenderedCameraState', () => {
  it('claims the last applied pose when desired scene values are ahead and clears motion', () => {
    const state = {
      yaw: 1.31,
      pitch: 0.68,
      zoom: 1.6,
      renderedYaw: 0.47,
      renderedPitch: 0.82,
      renderedZoom: 1.1,
      spinYaw: 0.19,
      spinPitch: -0.11,
      dragging: true,
      pitchTarget: 1.2,
      yawTarget: -0.4,
      zoomTarget: 1.15,
    }

    claimRenderedCameraState(state)

    expect(state).toEqual({
      yaw: 0.47,
      pitch: 0.82,
      zoom: 1.1,
      renderedYaw: 0.47,
      renderedPitch: 0.82,
      renderedZoom: 1.1,
      spinYaw: 0,
      spinPitch: 0,
      dragging: false,
      pitchTarget: null,
      yawTarget: null,
      zoomTarget: null,
    })
  })

  it('never installs non-finite pose values or a non-positive zoom', () => {
    const state = {
      yaw: Number.NaN,
      pitch: Number.POSITIVE_INFINITY,
      zoom: 0,
      renderedYaw: Number.NaN,
      renderedPitch: Number.NEGATIVE_INFINITY,
      renderedZoom: -1,
      spinYaw: Number.NaN,
      spinPitch: Number.POSITIVE_INFINITY,
      dragging: true,
      pitchTarget: Number.NaN,
      yawTarget: Number.POSITIVE_INFINITY,
      zoomTarget: -1,
    }

    claimRenderedCameraState(state)

    expect(state.yaw).toBe(0)
    expect(state.pitch).toBe(0)
    expect(state.zoom).toBe(1)
    expect(state.renderedYaw).toBe(0)
    expect(state.renderedPitch).toBe(0)
    expect(state.renderedZoom).toBe(1)
    expect([
      state.yaw,
      state.pitch,
      state.zoom,
      state.renderedYaw,
      state.renderedPitch,
      state.renderedZoom,
    ].every(Number.isFinite)).toBe(true)
    expect(state.zoom).toBeGreaterThan(0)
    expect(state.renderedZoom).toBeGreaterThan(0)
    expect(state).toMatchObject({
      spinYaw: 0,
      spinPitch: 0,
      dragging: false,
      pitchTarget: null,
      yawTarget: null,
      zoomTarget: null,
    })
  })
})

describe('selectProjectionAspect', () => {
  it('captures one aspect while frozen and ignores later live resize aspects', () => {
    const captured = selectProjectionAspect(16 / 9, true, null)
    const resized = selectProjectionAspect(3 / 4, true, captured.frozenAspect)

    expect(captured).toEqual({ aspect: 16 / 9, frozenAspect: 16 / 9 })
    expect(resized).toEqual({ aspect: 16 / 9, frozenAspect: 16 / 9 })
  })

  it('uses the live aspect and clears the snapshot when projection is unfrozen', () => {
    const live = selectProjectionAspect(3 / 4, false, 16 / 9)
    const recaptured = selectProjectionAspect(4 / 3, true, live.frozenAspect)

    expect(live).toEqual({ aspect: 3 / 4, frozenAspect: null })
    expect(recaptured).toEqual({ aspect: 4 / 3, frozenAspect: 4 / 3 })
  })
})
