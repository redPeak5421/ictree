import { describe, expect, it } from 'vitest'
import { encodeGrid } from './encode'

describe('encodeGrid', () => {
  it('returns a byte-stable grid for the same payload', () => {
    const a = encodeGrid('https://example.com/')
    const b = encodeGrid('https://example.com/')
    expect(a.size).toBe(b.size)
    expect(a.version).toBe(b.version)
    expect(a.payload).toBe('https://example.com/')
    expect(a.cells.map((c) => `${c.x},${c.y},${c.dark},${c.kind}`)).toEqual(
      b.cells.map((c) => `${c.x},${c.y},${c.dark},${c.kind}`),
    )
  })

  it('places finder patterns in three corners', () => {
    const grid = encodeGrid('https://example.com/')
    const at = (x: number, y: number) => grid.cells.find((c) => c.x === x && c.y === y)
    expect(at(0, 0)?.kind).toBe('finder')
    expect(at(0, 0)?.dark).toBe(true)
    expect(at(grid.size - 1, 0)?.kind).toBe('finder')
    expect(at(0, grid.size - 1)?.kind).toBe('finder')
    expect(at(grid.size - 1, grid.size - 1)?.kind).not.toBe('finder')
  })

  it('tags the timing patterns', () => {
    const grid = encodeGrid('https://example.com/')
    const timing = grid.cells.find((c) => c.x === 8 && c.y === 6)
    expect(timing?.kind).toBe('timing')
  })
})
