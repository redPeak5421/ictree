import { describe, expect, it } from 'vitest'
import {
  layoutLeafText,
  revealBlend,
  sampleLeafTargets,
  type LeafTextLayout,
} from './leafReveal'

const measure = (text: string, fontSize: number) => Array.from(text).length * fontSize * 0.5

const unitCodePointMeasure = (text: string, _fontSize: number) => Array.from(text).length

function withoutIntlSegmenter<T>(operation: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Segmenter')
  Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: undefined })
  try {
    return operation()
  } finally {
    if (descriptor) Object.defineProperty(Intl, 'Segmenter', descriptor)
  }
}

function reconstruct(layout: LeafTextLayout): string {
  return layout.lines.reduce(
    (text, line, index) => text + line + (layout.breaks[index] === 'wrap' ? '' : (layout.breaks[index] ?? '')),
    '',
  )
}

describe('layoutLeafText', () => {
  it('keeps a family ZWJ sequence on one display line', () => {
    const family = '👨‍👩‍👧‍👦'
    const layout = layoutLeafText(
      `A${family}B`,
      { maxWidth: 7, maxHeight: 10, minFontSize: 1, maxFontSize: 1, lineHeightRatio: 1 },
      unitCodePointMeasure,
    )

    expect(layout.lines).toEqual(['A', family, 'B'])
  })

  it('keeps a combining sequence on one display line', () => {
    const combined = 'e\u0301'
    const layout = layoutLeafText(
      `A${combined}B`,
      { maxWidth: 2, maxHeight: 10, minFontSize: 1, maxFontSize: 1, lineHeightRatio: 1 },
      unitCodePointMeasure,
    )

    expect(layout.lines).toEqual(['A', combined, 'B'])
  })

  it('keeps a regional-indicator flag together when Intl.Segmenter is unavailable', () => {
    withoutIntlSegmenter(() => {
      const flag = '🇨🇳'
      const layout = layoutLeafText(
        `A${flag}B`,
        { maxWidth: 2, maxHeight: 10, minFontSize: 1, maxFontSize: 1, lineHeightRatio: 1 },
        unitCodePointMeasure,
      )

      expect(layout.lines).toEqual(['A', flag, 'B'])
    })
  })

  it('keeps a Hangul Jamo syllable together when Intl.Segmenter is unavailable', () => {
    withoutIntlSegmenter(() => {
      const syllable = '\u1100\u1161'
      const layout = layoutLeafText(
        `A${syllable}B`,
        { maxWidth: 2, maxHeight: 10, minFontSize: 1, maxFontSize: 1, lineHeightRatio: 1 },
        unitCodePointMeasure,
      )

      expect(layout.lines).toEqual(['A', syllable, 'B'])
    })
  })

  it('keeps an Indic virama conjunct together when Intl.Segmenter is unavailable', () => {
    withoutIntlSegmenter(() => {
      const conjunct = '\u0915\u094d\u0937'
      const layout = layoutLeafText(
        `A${conjunct}B`,
        { maxWidth: 3, maxHeight: 10, minFontSize: 1, maxFontSize: 1, lineHeightRatio: 1 },
        unitCodePointMeasure,
      )

      expect(layout.lines).toEqual(['A', conjunct, 'B'])
    })
  })

  it('keeps Indic virama plus ZWNJ together when Intl.Segmenter is unavailable', () => {
    withoutIntlSegmenter(() => {
      const cluster = '\u0915\u094d\u200c'
      const layout = layoutLeafText(
        `A${cluster}B`,
        { maxWidth: 3, maxHeight: 10, minFontSize: 1, maxFontSize: 1, lineHeightRatio: 1 },
        unitCodePointMeasure,
      )

      expect(layout.lines).toEqual(['A', cluster, 'B'])
    })
  })

  it('does not bind a Latin letter after an Indic virama when Intl.Segmenter is unavailable', () => {
    withoutIntlSegmenter(() => {
      const cluster = '\u0915\u094d'
      const layout = layoutLeafText(
        `${cluster}AB`,
        { maxWidth: 2, maxHeight: 10, minFontSize: 1, maxFontSize: 1, lineHeightRatio: 1 },
        unitCodePointMeasure,
      )

      expect(layout.lines).toEqual([cluster, 'AB'])
    })
  })

  it('wraps a long unspaced URL by Unicode code point without changing it', () => {
    const text = 'https://example.com/🌳林/grove-with-a-very-long-unspaced-path'
    const layout = layoutLeafText(
      text,
      { maxWidth: 84, maxHeight: 240, minFontSize: 8, maxFontSize: 16 },
      measure,
    )

    expect(layout.lines.length).toBeGreaterThan(2)
    expect(layout.lines.every((line) => measure(line, layout.fontSize) <= 84)).toBe(true)
    expect(layout.lines.some((line) => line.includes('🌳'))).toBe(true)
    for (const line of layout.lines) {
      const first = line.charCodeAt(0)
      const last = line.charCodeAt(line.length - 1)
      expect(first >= 0xdc00 && first <= 0xdfff).toBe(false)
      expect(last >= 0xd800 && last <= 0xdbff).toBe(false)
    }
    expect(reconstruct(layout)).toBe(text)
  })

  it('prefers whitespace wrap points while preserving that whitespace', () => {
    const layout = layoutLeafText(
      'leaf grove canopy',
      { maxWidth: 35, maxHeight: 100, minFontSize: 10, maxFontSize: 10, lineHeightRatio: 1 },
      measure,
    )

    expect(layout.lines).toEqual(['leaf ', 'grove ', 'canopy'])
    expect(layout.breaks).toEqual(['wrap', 'wrap'])
    expect(reconstruct(layout)).toBe('leaf grove canopy')
  })

  it('preserves explicit lines and shrinks until their total height fits', () => {
    const layout = layoutLeafText(
      'Grove\nReveal',
      { maxWidth: 200, maxHeight: 36, minFontSize: 10, maxFontSize: 20 },
      measure,
    )

    expect(layout.lines).toEqual(['Grove', 'Reveal'])
    expect(layout.breaks).toEqual(['\n'])
    expect(layout.fontSize).toBe(15)
    expect(layout.lineHeight).toBe(18)
    expect(layout.height).toBe(36)
    expect(layout.width).toBeLessThanOrEqual(200)
    expect(reconstruct(layout)).toBe('Grove\nReveal')
  })

  it('treats empty text as one empty display line', () => {
    const layout = layoutLeafText(
      '',
      { maxWidth: 100, maxHeight: 20, minFontSize: 10, maxFontSize: 10 },
      measure,
    )

    expect(layout).toEqual({
      lines: [''],
      breaks: [],
      fontSize: 10,
      lineHeight: 12,
      width: 0,
      height: 12,
    })
  })

  it('recognizes CRLF and CR as single explicit breaks without losing their original form', () => {
    const text = 'A\r\nB\rC\n'
    const layout = layoutLeafText(
      text,
      { maxWidth: 100, maxHeight: 100, minFontSize: 10, maxFontSize: 10 },
      measure,
    )

    expect(layout.lines).toEqual(['A', 'B', 'C', ''])
    expect(layout.breaks).toEqual(['\r\n', '\r', '\n'])
    expect(reconstruct(layout)).toBe(text)
  })

  it('rejects invalid bounds and invalid measurement results', () => {
    const valid = { maxWidth: 100, maxHeight: 100, minFontSize: 10, maxFontSize: 20 }

    expect(() => layoutLeafText('Grove', { ...valid, maxWidth: 0 }, measure)).toThrow(RangeError)
    expect(() => layoutLeafText('Grove', { ...valid, maxHeight: Number.NaN }, measure)).toThrow(RangeError)
    expect(() => layoutLeafText('Grove', { ...valid, minFontSize: 0 }, measure)).toThrow(RangeError)
    expect(() => layoutLeafText('Grove', { ...valid, maxFontSize: 9 }, measure)).toThrow(RangeError)
    expect(() => layoutLeafText('Grove', valid, () => Number.NaN)).toThrow(RangeError)
    expect(() => layoutLeafText('Grove', valid, () => -1)).toThrow(RangeError)
    expect(() => layoutLeafText('Grove', valid, () => Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })

  it('falls back from a huge unfitting font size to a valid minimum without stalling', () => {
    let measurements = 0
    const layout = layoutLeafText(
      'G',
      { maxWidth: 8, maxHeight: 8, minFontSize: 8, maxFontSize: 2 ** 54, lineHeightRatio: 1 },
      (_text, fontSize) => {
        measurements += 1
        if (measurements > 20) throw new Error('Font search stalled.')
        return fontSize
      },
    )

    expect(layout.fontSize).toBe(8)
    expect(measurements).toBeLessThanOrEqual(20)
  })

  it('finds the largest fitting font across a range wider than the search budget', () => {
    const layout = layoutLeafText(
      'G',
      { maxWidth: 10, maxHeight: 10, minFontSize: 1, maxFontSize: 300, lineHeightRatio: 1 },
      (_text, fontSize) => fontSize,
    )

    expect(layout.fontSize).toBe(10)
  })

  it('keeps fractional font candidates on the maximum-minus-whole-steps lattice', () => {
    const layout = layoutLeafText(
      'G',
      { maxWidth: 15.5, maxHeight: 15.5, minFontSize: 8.5, maxFontSize: 20.5, lineHeightRatio: 1 },
      (_text, fontSize) => fontSize,
    )

    expect(layout.fontSize).toBe(15.5)
  })
})

function twoBandMask(): { alpha: Uint8ClampedArray; width: number; height: number } {
  const width = 9
  const height = 8
  const alpha = new Uint8ClampedArray(width * height)
  for (const y of [1, 2]) for (let x = 0; x < width; x += 1) alpha[y * width + x] = 255
  for (const y of [5, 6]) for (let x = 1; x < width - 1; x += 1) alpha[y * width + x] = 255
  return { alpha, width, height }
}

describe('sampleLeafTargets', () => {
  it('returns the requested deterministic sample only on active pixels', () => {
    const { alpha, width, height } = twoBandMask()
    const first = sampleLeafTargets(alpha, width, height, 12, 731)
    const again = sampleLeafTargets(alpha, width, height, 12, 731)

    expect(first).toHaveLength(12)
    expect(again).toEqual(first)
    for (const target of first) {
      const x = Math.floor(target.x)
      const y = Math.floor(target.y)
      expect(alpha[y * width + x]).toBeGreaterThan(127)
    }
  })

  it('covers broad mask bounds and separated line bands', () => {
    const { alpha, width, height } = twoBandMask()
    const targets = sampleLeafTargets(alpha, width, height, 12, 731)
    const xs = targets.map(({ x }) => Math.floor(x))
    const ys = targets.map(({ y }) => Math.floor(y))

    expect(Math.min(...xs)).toBe(0)
    expect(Math.max(...xs)).toBe(8)
    expect(Math.min(...ys)).toBe(1)
    expect(Math.max(...ys)).toBe(6)
    expect(ys.some((y) => y <= 2)).toBe(true)
    expect(ys.some((y) => y >= 5)).toBe(true)
  })

  it('changes non-anchor samples when the seed changes', () => {
    const { alpha, width, height } = twoBandMask()

    expect(sampleLeafTargets(alpha, width, height, 12, 731)).not.toEqual(
      sampleLeafTargets(alpha, width, height, 12, 732),
    )
  })

  it('reuses active pixels with deterministic in-pixel jitter when more targets are requested', () => {
    const alpha = new Uint8ClampedArray([255, 0, 0, 0, 0, 255])
    const targets = sampleLeafTargets(alpha, 3, 2, 7, 'grove')

    expect(targets).toHaveLength(7)
    expect(new Set(targets.map(({ x, y }) => `${x},${y}`)).size).toBeGreaterThan(2)
    for (const target of targets) {
      const pixelX = Math.floor(target.x)
      const pixelY = Math.floor(target.y)
      expect(alpha[pixelY * 3 + pixelX]).toBe(255)
      expect(target.x).toBeGreaterThan(pixelX)
      expect(target.x).toBeLessThan(pixelX + 1)
      expect(target.y).toBeGreaterThan(pixelY)
      expect(target.y).toBeLessThan(pixelY + 1)
    }
  })

  it('covers many fragmented line bands without requiring every active pixel as a target', () => {
    const width = 48
    const height = 128
    const alpha = new Uint8ClampedArray(width * height)
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 1) alpha[y * width + x] = 255
    }

    const targets = sampleLeafTargets(alpha, width, height, 48, 'fragmented')
    const xs = targets.map(({ x }) => Math.floor(x))
    const ys = targets.map(({ y }) => Math.floor(y))
    expect(targets).toHaveLength(48)
    expect(Math.min(...xs)).toBe(0)
    expect(Math.max(...xs)).toBe(width - 1)
    expect(Math.min(...ys)).toBe(0)
    expect(Math.max(...ys)).toBe(height - 2)
    expect(new Set(ys).size).toBeGreaterThan(32)
  })

  it('returns an empty result for zero targets even when the mask has no active pixels', () => {
    expect(sampleLeafTargets(new Uint8ClampedArray(4), 2, 2, 0, 1)).toEqual([])
  })

  it('rejects an empty mask when targets are requested', () => {
    expect(() => sampleLeafTargets(new Uint8ClampedArray(4), 2, 2, 1, 1)).toThrow(RangeError)
  })

  it('uses alpha values strictly above the threshold', () => {
    const targets = sampleLeafTargets(new Uint8ClampedArray([127, 128]), 2, 1, 1, 1)

    expect(Math.floor(targets[0]!.x)).toBe(1)
  })

  it('rejects malformed dimensions, counts, and mask lengths', () => {
    const alpha = new Uint8ClampedArray(4)

    expect(() => sampleLeafTargets(alpha, 0, 2, 1, 1)).toThrow(RangeError)
    expect(() => sampleLeafTargets(alpha, 1.5, 2, 1, 1)).toThrow(RangeError)
    expect(() => sampleLeafTargets(alpha, 2, 2, -1, 1)).toThrow(RangeError)
    expect(() => sampleLeafTargets(new Uint8ClampedArray(3), 2, 2, 1, 1)).toThrow(RangeError)
  })
})

describe('revealBlend', () => {
  it('keeps leaves fully visible until the late text reveal begins', () => {
    expect(revealBlend(0)).toEqual({ leafOpacity: 1, textOpacity: 0 })
    expect(revealBlend(0.7)).toEqual({ leafOpacity: 1, textOpacity: 0 })
    expect(revealBlend(0.8).textOpacity).toBeGreaterThan(0)
  })

  it('stays continuous without an opacity gap and retains leaves at the endpoint', () => {
    const samples = Array.from({ length: 101 }, (_, index) => revealBlend(index / 100))

    for (const blend of samples) {
      expect(blend.leafOpacity + blend.textOpacity).toBeGreaterThanOrEqual(1)
    }
    for (let index = 1; index < samples.length; index += 1) {
      expect(Math.abs(samples[index]!.leafOpacity - samples[index - 1]!.leafOpacity)).toBeLessThan(0.1)
      expect(Math.abs(samples[index]!.textOpacity - samples[index - 1]!.textOpacity)).toBeLessThan(0.1)
    }
    expect(revealBlend(1)).toEqual({ leafOpacity: 0.2, textOpacity: 1 })
    expect(revealBlend(-1)).toEqual(revealBlend(0))
    expect(revealBlend(2)).toEqual(revealBlend(1))
  })
})
