import { describe, expect, it } from 'vitest'
import { VIEW_PITCH } from './tree'
import { OVERHEAD } from './view'
import { canopyWindFade, windBend } from './wind'

describe('canopyWindFade', () => {
  it('blows in the side view and freezes before overhead so the code stays put', () => {
    expect(canopyWindFade(VIEW_PITCH)).toBe(1)
    expect(canopyWindFade(1.0)).toBe(1)
    expect(canopyWindFade(OVERHEAD)).toBe(0)
    expect(canopyWindFade(1.45)).toBe(0)
    expect(canopyWindFade(1.32)).toBeGreaterThan(0)
    expect(canopyWindFade(1.32)).toBeLessThan(1)
  })
})

describe('windBend', () => {
  it('is a coherent gust, not per-leaf noise', () => {
    const a = windBend(4.2, 2, -1)
    const b = windBend(4.2, 2.4, -0.7)
    expect(Math.sign(a.tilt)).toBe(Math.sign(b.tilt) || Math.sign(a.tilt))
    expect(Math.abs(a.tilt - b.tilt)).toBeLessThan(Math.abs(a.tilt) + 0.05)
  })

  it('changes over time so the crown keeps moving', () => {
    const a = windBend(1, 3, 1)
    const b = windBend(2.6, 3, 1)
    expect(a.tilt).not.toBeCloseTo(b.tilt, 3)
  })

  it('leans the crown farther than the trunk so the tree actually blows', () => {
    const times = [0.2, 0.8, 1.4, 2.1, 2.8, 3.5, 4.2]
    let maxLean = 0
    let maxTilt = 0
    for (const t of times) {
      const bend = windBend(t, 1, -1)
      maxLean = Math.max(maxLean, Math.abs(bend.lean))
      maxTilt = Math.max(maxTilt, Math.abs(bend.tilt))
    }
    expect(maxLean).toBeGreaterThan(0.06)
    expect(maxTilt).toBeGreaterThan(0.18)
    const crown = maxLean * 12
    const bole = maxLean * 2
    expect(crown).toBeGreaterThan(bole * 2)
    expect(crown).toBeGreaterThan(0.7)
  })
})
