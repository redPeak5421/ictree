import { describe, expect, it } from 'vitest'
import { cameraPose, glideAngle, isOverhead, OVERHEAD, sceneryOpacity, squareYaw } from './view'
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
})

describe('view helpers', () => {
  it('thins weather only near overhead', () => {
    expect(sceneryOpacity(VIEW_PITCH)).toBe(1)
    expect(sceneryOpacity(1.0)).toBe(1)
    expect(sceneryOpacity(OVERHEAD)).toBe(0)
  })

  it('glides to a target and pins it exactly', () => {
    let pitch = VIEW_PITCH
    let done = false
    for (let i = 0; i < 400 && !done; i++) [pitch, done] = glideAngle(pitch, OVERHEAD, 1 / 60)
    expect(done).toBe(true)
    expect(pitch).toBe(OVERHEAD)
    expect(isOverhead(pitch)).toBe(true)
    expect(isOverhead(1.4)).toBe(false)
  })

  it('squares the heading to the nearest quarter turn', () => {
    expect(squareYaw(0.1)).toBe(0)
    expect(squareYaw(Math.PI / 4 + 0.1)).toBeCloseTo(Math.PI / 2, 9)
    expect(squareYaw(-1.5)).toBeCloseTo(-Math.PI / 2, 9)
    expect(squareYaw(3.2)).toBeCloseTo(Math.PI, 9)
  })
})
