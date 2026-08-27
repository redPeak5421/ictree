import { describe, expect, it } from 'vitest'
import { colorsOf } from './palettes'

describe('colorsOf', () => {
  it('keeps the cream background token', () => {
    expect(colorsOf('autumn', 'default').bg).toBe('#f6f1e7')
  })

  it('uses pink foliage in spring and gold in autumn for the default swatch', () => {
    const spring = colorsOf('spring', 'default').foliage.toLowerCase()
    const autumn = colorsOf('autumn', 'default').foliage.toLowerCase()
    const summer = colorsOf('summer', 'default').foliage.toLowerCase()
    expect(spring).not.toBe(autumn)
    expect(summer).not.toBe(autumn)
    expect(spring).toBe('#e8a0b0')
  })

  it('lets a named swatch override foliage', () => {
    expect(colorsOf('summer', 'coral').foliage.toLowerCase()).toBe('#e83030')
    expect(colorsOf('autumn', 'gold').foliage.toLowerCase()).toBe('#e8a800')
  })
})
