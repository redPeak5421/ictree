import { describe, expect, it } from 'vitest'
import { encodeGrid } from '../qr/encode'
import { colorsOf } from '../scene/palettes'
import { scanGrovePayload } from './scanGrove'

describe('scanGrovePayload', () => {
  it('reads the live payload from the mosaic', () => {
    const payload = 'https://example.com/scan'
    const grid = encodeGrid(payload)
    expect(scanGrovePayload(grid, colorsOf('autumn', 'default'))).toBe(payload)
  })

  it('returns the wrapped token, not the hidden URL', () => {
    const payload = `gv1.${'A'.repeat(80)}`
    const grid = encodeGrid(payload)
    expect(scanGrovePayload(grid, colorsOf('spring', 'default'))).toBe(payload)
  })
})
