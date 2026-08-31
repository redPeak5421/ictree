import { describe, expect, it } from 'vitest'
import { isAbortError, isShareActionCurrent } from './ShareMenu'

describe('share menu async guards', () => {
  it('accepts callbacks only for the current enabled mounted action', () => {
    expect(isShareActionCurrent(4, 4, false, true)).toBe(true)
    expect(isShareActionCurrent(3, 4, false, true)).toBe(false)
    expect(isShareActionCurrent(4, 4, true, true)).toBe(false)
    expect(isShareActionCurrent(4, 4, false, false)).toBe(false)
  })

  it('recognizes abort failures without hiding ordinary failures', () => {
    expect(isAbortError(new DOMException('cancelled', 'AbortError'))).toBe(true)
    expect(isAbortError(new Error('capture failed'))).toBe(false)
    expect(isAbortError({ name: 'AbortError' })).toBe(true)
  })
})
