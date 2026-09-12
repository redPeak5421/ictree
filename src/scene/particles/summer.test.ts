import { describe, expect, it } from 'vitest'
import { createSummerMotes, stepSummerMotes, summerMotePulse } from './summer'

describe('summer motes', () => {
  it('is deterministic and stays over the island', () => {
    const first = createSummerMotes(24, 12, 44)
    expect(createSummerMotes(24, 12, 44)).toEqual(first)
    expect(first).toHaveLength(24)
    for (const mote of first) {
      expect(Math.abs(mote.x)).toBeLessThanOrEqual(12)
      expect(mote.y).toBeGreaterThan(0)
    }
  })

  it('drifts and wraps instead of falling off the island', () => {
    const motes = createSummerMotes(8, 10, 7)
    const before = motes.map((mote) => ({ ...mote }))
    for (let i = 0; i < 80; i++) stepSummerMotes(motes, 0.05, 10, i * 0.05)
    expect(motes).not.toEqual(before)
    for (const mote of motes) {
      expect(Math.abs(mote.x)).toBeLessThanOrEqual(5.3)
      expect(Math.abs(mote.z)).toBeLessThanOrEqual(5.3)
      expect(mote.y).toBeGreaterThan(0)
      expect(mote.y).toBeLessThanOrEqual(12.1)
    }
  })

  it('pulses between dim and bright', () => {
    const mote = { ...createSummerMotes(1, 8, 3)[0]!, phase: 0, pulse: 1 }
    const dim = summerMotePulse(mote, (3 * Math.PI) / 2)
    const bright = summerMotePulse(mote, Math.PI / 2)
    expect(dim).toBeCloseTo(0.28, 5)
    expect(bright).toBeCloseTo(1, 5)
  })
})
