import { describe, expect, it } from 'vitest'
import { applyDrag, clampPitch, PITCH_MAX, PITCH_MIN, rightOf, stepSpin, type OrbitState } from './orbit'

function orbit(): OrbitState {
  return { yaw: 1, pitch: 0.5, spinYaw: 0, spinPitch: 0 }
}

describe('orbit', () => {
  it('turns the scene the way the pointer goes and tips it with vertical drag', () => {
    const o = orbit()
    applyDrag(o, 100, 0, 0.016)
    expect(o.yaw).toBeLessThan(1)
    applyDrag(o, 0, 50, 0.016)
    expect(o.pitch).toBeGreaterThan(0.5)
  })

  it('keeps the elevation between a low glance and nearly overhead', () => {
    const o = orbit()
    applyDrag(o, 0, 100000, 0.016)
    expect(o.pitch).toBe(PITCH_MAX)
    applyDrag(o, 0, -100000, 0.016)
    expect(o.pitch).toBe(PITCH_MIN)
    expect(clampPitch(-3)).toBe(PITCH_MIN)
  })

  it('carries a flick on, then settles', () => {
    const o = orbit()
    applyDrag(o, 40, 0, 0.016)
    expect(o.spinYaw).toBeLessThan(0)
    const before = o.yaw
    stepSpin(o, 0.016)
    expect(o.yaw).toBeLessThan(before)
    for (let i = 0; i < 600; i++) stepSpin(o, 0.016)
    expect(o.spinYaw).toBe(0)
    expect(o.spinPitch).toBe(0)
  })

  it('reports screen-right for the default heading as the +x/-z diagonal', () => {
    const [x, z] = rightOf(Math.PI / 4)
    expect(x).toBeCloseTo(Math.SQRT1_2, 6)
    expect(z).toBeCloseTo(-Math.SQRT1_2, 6)
  })
})
