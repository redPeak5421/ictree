import { describe, expect, it } from 'vitest'
import { blockInkOpacity, cameraPose, inkMixTarget, isOverhead, OVERHEAD, plantInkOpacity, sceneryOpacity, squareYaw, stepAngleGlide, stepInkMix, VIEW_MS } from './view'
import { VIEW_PITCH, VIEW_YAW } from './tree'

const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!

describe('cameraPose', () => {
  it('orbits by heading and elevation about the island', () => {
    const east = cameraPose(0, VIEW_PITCH, 32, 30, 20)
    expect(Math.abs(east.position[0])).toBeLessThan(1e-9)
    expect(east.position[2]).toBeGreaterThan(1)
    const iso = cameraPose(VIEW_YAW, VIEW_PITCH, 32, 30, 20)
    expect(iso.position[0]).toBeCloseTo(iso.position[2], 9)
    const high = cameraPose(VIEW_YAW, 1.2, 32, 30, 20)
    expect(high.position[1]).toBeGreaterThan(iso.position[1])
  })

  it('looks straight down from OVERHEAD, whatever the heading', () => {
    for (const yaw of [0, 1, VIEW_YAW, 4]) {
      const pose = cameraPose(yaw, OVERHEAD, 34, 32, 20)
      expect(Math.abs(pose.position[0] - pose.target[0])).toBeLessThan(1e-9)
      expect(Math.abs(pose.position[2] - pose.target[2])).toBeLessThan(1e-9)
      expect(pose.position[1]).toBeGreaterThan(pose.target[1])
      // Ortho top-down: the island's XZ centre is the frame centre. Look-at
      // height is shared with the side view so pitching does not dolly.
      expect(pose.target[0]).toBeCloseTo(0, 6)
      expect(pose.target[2]).toBeCloseTo(0, 6)
      // Quiet zone: at least two modules of margin around the code.
      expect(pose.spanX).toBeGreaterThanOrEqual(36)
      expect(pose.spanY).toBeGreaterThanOrEqual(36)
    }
  })

  it('keeps screen-up perpendicular to the view, so lookAt never flips', () => {
    for (const yaw of [0, 0.7, 2.5]) {
      for (const pitch of [0.12, VIEW_PITCH, 1.4, OVERHEAD]) {
        const pose = cameraPose(yaw, pitch, 32, 30, 20)
        const view = [
          pose.target[0] - pose.position[0],
          pose.target[1] - pose.position[1],
          pose.target[2] - pose.position[2],
        ]
        expect(Math.abs(dot(view, pose.up))).toBeLessThan(1e-6)
        expect(dot(pose.up, pose.up)).toBeCloseTo(1, 9)
      }
    }
  })

  it('frames the crown from a high angle, where the far rim rises past the apex', () => {
    const low = cameraPose(VIEW_YAW, VIEW_PITCH, 32, 30, 24)
    const high = cameraPose(VIEW_YAW, 1.3, 32, 30, 24)
    // Up high the vertical span is dominated by depth, so it stays comparable
    // rather than collapsing with cos(pitch).
    expect(high.spanY).toBeGreaterThan(low.spanY * 0.8)
  })

  it('keeps the look-at on the island axis at every heading so the grove does not orbit the screen', () => {
    for (const yaw of [0, 0.4, VIEW_YAW, 1.1, Math.PI / 2]) {
      const pose = cameraPose(yaw, VIEW_PITCH, 32, 30, 20)
      expect(pose.target[0]).toBeCloseTo(0, 6)
      expect(pose.target[2]).toBeCloseTo(0, 6)
    }
  })

  it('does not resize the frame as the island turns', () => {
    const east = cameraPose(0, VIEW_PITCH, 32, 30, 20)
    const iso = cameraPose(VIEW_YAW, VIEW_PITCH, 32, 30, 20)
    const north = cameraPose(Math.PI / 2, VIEW_PITCH, 32, 30, 20)
    expect(east.spanX).toBeCloseTo(iso.spanX, 6)
    expect(iso.spanX).toBeCloseTo(north.spanX, 6)
    expect(east.spanY).toBeCloseTo(iso.spanY, 6)
  })

  it('does not dolly when pitching from the side view to overhead', () => {
    const low = cameraPose(VIEW_YAW, VIEW_PITCH, 32, 30, 20)
    const mid = cameraPose(VIEW_YAW, 1.0, 32, 30, 20)
    const high = cameraPose(VIEW_YAW, OVERHEAD, 32, 30, 20)
    expect(mid.spanX).toBeCloseTo(low.spanX, 6)
    expect(high.spanX).toBeCloseTo(low.spanX, 6)
    expect(mid.spanY).toBeCloseTo(low.spanY, 6)
    expect(high.spanY).toBeCloseTo(low.spanY, 6)
    expect(mid.target[1]).toBeCloseTo(low.target[1], 6)
    expect(high.target[1]).toBeCloseTo(low.target[1], 6)
  })
})

describe('view helpers', () => {
  it('thins weather only near overhead', () => {
    expect(sceneryOpacity(VIEW_PITCH)).toBe(1)
    expect(sceneryOpacity(1.0)).toBe(1)
    expect(sceneryOpacity(OVERHEAD)).toBe(0)
  })

  it('grows colour blocks with the camera, the way the plant grove becomes the code', () => {
    expect(inkMixTarget(false, OVERHEAD)).toBe(0)
    expect(inkMixTarget(true, VIEW_PITCH)).toBe(0)
    expect(inkMixTarget(true, OVERHEAD)).toBe(1)
    expect(inkMixTarget(true, 1.0)).toBeGreaterThan(0.15)
    expect(inkMixTarget(true, 1.0)).toBeLessThan(0.85)
    expect(plantInkOpacity(0)).toBe(1)
    expect(blockInkOpacity(0)).toBe(0)
    expect(plantInkOpacity(1)).toBe(0)
    expect(blockInkOpacity(1)).toBe(1)
    expect(plantInkOpacity(0.45)).toBeGreaterThan(0.2)
    expect(plantInkOpacity(0.45)).toBeLessThan(0.85)
    expect(blockInkOpacity(0.45)).toBeGreaterThan(0.2)
    expect(blockInkOpacity(0.45)).toBeLessThan(0.85)
    let mix = 0
    const mid = inkMixTarget(true, 1.0)
    for (let i = 0; i < 20; i++) mix = stepInkMix(mix, mid, 1 / 60)
    expect(mix).toBeGreaterThan(mid * 0.7)
    expect(mix).toBeLessThanOrEqual(mid)
    mix = stepInkMix(0, 1, 1 / 60, true)
    expect(mix).toBe(1)
  })

  it('glides to a target and pins it exactly', () => {
    const glide = { from: VIEW_PITCH, to: OVERHEAD, elapsed: 0 }
    let pitch = VIEW_PITCH
    let done = false
    for (let i = 0; i < 400 && !done; i++) [pitch, done] = stepAngleGlide(glide, 1 / 60)
    expect(done).toBe(true)
    expect(pitch).toBe(OVERHEAD)
    expect(isOverhead(pitch)).toBe(true)
    expect(isOverhead(1.4)).toBe(false)
  })

  it('eases a tap with uniform accel then decel, slow-fast-slow', () => {
    const duration = VIEW_MS / 1000
    const at = (frac: number) => {
      const glide = { from: 0, to: 1, elapsed: 0 }
      const [value] = stepAngleGlide(glide, duration * frac)
      return value
    }
    const early = at(0.1)
    const quarter = at(0.25)
    const mid = at(0.5)
    const late = at(0.9)
    expect(early).toBeGreaterThan(0)
    expect(early).toBeLessThan(0.1)
    expect(quarter - early).toBeGreaterThan(early)
    expect(mid).toBeCloseTo(0.5, 5)
    expect(late).toBeGreaterThan(0.9)
    expect(1 - late).toBeLessThan(0.1)
  })

  it('squares the heading to the nearest quarter turn', () => {
    expect(squareYaw(0.1)).toBe(0)
    expect(squareYaw(Math.PI / 4 + 0.1)).toBeCloseTo(Math.PI / 2, 9)
    expect(squareYaw(-1.5)).toBeCloseTo(-Math.PI / 2, 9)
    expect(squareYaw(3.2)).toBeCloseTo(Math.PI, 9)
  })
})
