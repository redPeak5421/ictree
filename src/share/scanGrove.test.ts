import { describe, expect, it } from 'vitest'
import { encodeGrid } from '../qr/encode'
import { colorsOf } from '../scene/palettes'
import { TREE_IDS } from '../scene/treeSpecies'
import { scanGrovePayload } from './scanGrove'
import { wrapSecret } from './secret'

describe('scanGrovePayload', () => {
  it('reads the live payload from the mosaic', () => {
    const payload = 'https://example.com/scan'
    const grid = encodeGrid(payload)
    expect(scanGrovePayload(grid, colorsOf('autumn', 'cherry'))).toBe(payload)
  })

  it('returns the wrapped token, not the hidden URL', async () => {
    const hidden = 'https://example.com/secret'
    const payload = await wrapSecret(hidden, 'grove')
    const grid = encodeGrid(payload)
    expect(scanGrovePayload(grid, colorsOf('spring', 'cherry'))).toBe(payload)
    expect(payload.includes('example.com')).toBe(false)
  })

  it('reads a plain-text greeting', () => {
    expect(scanGrovePayload(encodeGrid('你好'), colorsOf('autumn', 'cherry'))).toBe('你好')
  })

  it('reads every plantable tree in every season, green summers included', async () => {
    const payloads = [
      await wrapSecret('https://example.com/scan-lock', 'grove'),
      'https://example.com/',
      'http://example.com/',
      '你好',
      `https://example.com/${'p'.repeat(180)}`,
    ]
    const failures: string[] = []
    for (const payload of payloads) {
      const grid = encodeGrid(payload)
      for (const tree of TREE_IDS) {
        for (const season of ['spring', 'summer', 'autumn'] as const) {
          if (scanGrovePayload(grid, colorsOf(season, tree)) !== payload) failures.push(`v${grid.version} ${tree} ${season}`)
        }
      }
    }
    expect(failures).toEqual([])
  })
})
