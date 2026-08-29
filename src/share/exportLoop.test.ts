import { describe, expect, it } from 'vitest'
import { LOOP_DELAY_MS, LOOP_FRAMES } from './exportLoop'

describe('exported loop timing', () => {
  it('holds each frame long enough to read as a slow orbit', () => {
    expect(LOOP_DELAY_MS).toBeGreaterThanOrEqual(160)
    expect(LOOP_FRAMES).toBeGreaterThanOrEqual(16)
  })
})
