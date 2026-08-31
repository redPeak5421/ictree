export interface LeafTextBounds {
  maxWidth: number
  maxHeight: number
  minFontSize: number
  maxFontSize: number
  lineHeightRatio?: number
}

export type LeafTextBreak = 'wrap' | '\n' | '\r' | '\r\n'

export interface LeafTextLayout {
  lines: string[]
  /** One separator between each pair of lines. Explicit newline values are preserved verbatim. */
  breaks: LeafTextBreak[]
  fontSize: number
  lineHeight: number
  width: number
  height: number
}

export type LeafTextMeasure = (text: string, fontSize: number) => number

interface ExplicitLines {
  segments: string[]
  separators: Exclude<LeafTextBreak, 'wrap'>[]
}

function explicitLines(text: string): ExplicitLines {
  const segments: string[] = []
  const separators: Exclude<LeafTextBreak, 'wrap'>[] = []
  const newline = /\r\n|\r|\n/g
  let start = 0
  let match = newline.exec(text)

  while (match) {
    segments.push(text.slice(start, match.index))
    separators.push(match[0] as Exclude<LeafTextBreak, 'wrap'>)
    start = match.index + match[0].length
    match = newline.exec(text)
  }
  segments.push(text.slice(start))
  return { segments, separators }
}

function measuredWidth(text: string, fontSize: number, measure: LeafTextMeasure): number {
  const width = measure(text, fontSize)
  if (!Number.isFinite(width) || width < 0) throw new RangeError('Text measurement must be finite and non-negative.')
  return width
}

function fittingPrefix(points: string[], maxWidth: number, fontSize: number, measure: LeafTextMeasure): number {
  let low = 0
  let high = points.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (measuredWidth(points.slice(0, middle).join(''), fontSize, measure) <= maxWidth) low = middle
    else high = middle - 1
  }
  return low
}

const COMBINING_MARK = /\p{Mark}/u
const LETTER = /\p{Letter}/u

type HangulClass = 'l' | 'v' | 't' | 'lv' | 'lvt'

function hangulClass(point: number): HangulClass | undefined {
  if ((point >= 0x1100 && point <= 0x115f) || (point >= 0xa960 && point <= 0xa97c)) return 'l'
  if ((point >= 0x1160 && point <= 0x11a7) || (point >= 0xd7b0 && point <= 0xd7c6)) return 'v'
  if ((point >= 0x11a8 && point <= 0x11ff) || (point >= 0xd7cb && point <= 0xd7fb)) return 't'
  if (point >= 0xac00 && point <= 0xd7a3) return (point - 0xac00) % 28 === 0 ? 'lv' : 'lvt'
  return undefined
}

function joinsHangul(left: HangulClass | undefined, right: HangulClass | undefined): boolean {
  if (!left || !right) return false
  if (left === 'l') return right === 'l' || right === 'v' || right === 'lv' || right === 'lvt'
  if (left === 'lv' || left === 'v') return right === 'v' || right === 't'
  return (left === 'lvt' || left === 't') && right === 't'
}

const VIRAMAS = new Set([
  0x094d, 0x09cd, 0x0a4d, 0x0acd, 0x0b4d, 0x0bcd, 0x0c4d, 0x0ccd, 0x0d4d, 0x0dca,
  0x0e3a, 0x0f84, 0x1039, 0x103a, 0x1714, 0x1734, 0x17d2, 0x1a60, 0x1b44, 0x1baa,
  0x1bab, 0xa806, 0xa8c4, 0xa953, 0xa9c0, 0xaaf6, 0x10a3f, 0x11046, 0x11070, 0x110b9,
  0x11133, 0x11134, 0x111c0, 0x11235, 0x112ea, 0x1134d, 0x11442, 0x114c2, 0x115bf,
  0x1163f, 0x116b6, 0x1172b, 0x11839, 0x1193d, 0x1193e, 0x119e0, 0x11a34, 0x11a47,
  0x11a99, 0x11c3f, 0x11d44, 0x11d45, 0x11d97, 0x11f41, 0x11f42,
])

const INDIC_SCRIPT_RANGES: Array<readonly [number, number]> = [
  [0x0900, 0x097f], [0x0980, 0x09ff], [0x0a00, 0x0a7f], [0x0a80, 0x0aff],
  [0x0b00, 0x0b7f], [0x0b80, 0x0bff], [0x0c00, 0x0c7f], [0x0c80, 0x0cff],
  [0x0d00, 0x0d7f], [0x0d80, 0x0dff], [0x0e00, 0x0e7f], [0x0f00, 0x0fff],
  [0x1000, 0x109f], [0x1700, 0x177f], [0x1780, 0x17ff], [0x1a20, 0x1aaf],
  [0x1b00, 0x1bff], [0xa800, 0xa82f], [0xa880, 0xa8df], [0xa930, 0xa95f],
  [0xa980, 0xa9df], [0xaae0, 0xaaff], [0x10a00, 0x10a5f], [0x11000, 0x1107f],
  [0x11080, 0x110cf], [0x11100, 0x111df], [0x11200, 0x112ff], [0x11300, 0x1137f],
  [0x11400, 0x114df], [0x11580, 0x1165f], [0x11680, 0x1174f], [0x11800, 0x1184f],
  [0x11900, 0x119ff], [0x11a00, 0x11aaf], [0x11c00, 0x11cff], [0x11d00, 0x11dff],
  [0x11f00, 0x11f5f],
]

function indicScriptOf(point: number): number | undefined {
  const index = INDIC_SCRIPT_RANGES.findIndex(([start, end]) => point >= start && point <= end)
  return index < 0 ? undefined : index
}

function isVariationSelector(point: number): boolean {
  return (point >= 0xfe00 && point <= 0xfe0f) || (point >= 0xe0100 && point <= 0xe01ef)
}

function isEmojiModifier(point: number): boolean {
  return point >= 0x1f3fb && point <= 0x1f3ff
}

function isRegionalIndicator(point: number): boolean {
  return point >= 0x1f1e6 && point <= 0x1f1ff
}

function extendsGrapheme(value: string): boolean {
  const point = value.codePointAt(0)!
  return point === 0x200c || COMBINING_MARK.test(value) || isVariationSelector(point) || isEmojiModifier(point)
}

function fallbackGraphemes(text: string): string[] {
  const points = Array.from(text)
  const graphemes: string[] = []
  let index = 0

  while (index < points.length) {
    let grapheme = points[index++]!
    let lastHangulClass = hangulClass(grapheme.codePointAt(0)!)
    let activeIndicScript = indicScriptOf(grapheme.codePointAt(0)!)
    let linkerScript: number | undefined
    if (isRegionalIndicator(grapheme.codePointAt(0)!) && index < points.length) {
      const next = points[index]!
      if (isRegionalIndicator(next.codePointAt(0)!)) {
        grapheme += next
        index += 1
      }
    }

    while (index < points.length) {
      const next = points[index]!
      if (extendsGrapheme(next)) {
        grapheme += next
        const nextPoint = next.codePointAt(0)!
        if (VIRAMAS.has(nextPoint)) linkerScript = activeIndicScript ?? indicScriptOf(nextPoint)
        else if (nextPoint === 0x200c) linkerScript = undefined
        index += 1
        continue
      }
      if (next === '\u200d' && index + 1 < points.length) {
        grapheme += next
        index += 1
        if (linkerScript === undefined) {
          grapheme += points[index]!
          lastHangulClass = hangulClass(points[index]!.codePointAt(0)!)
          activeIndicScript = indicScriptOf(points[index]!.codePointAt(0)!)
          index += 1
        }
        continue
      }
      const nextPoint = next.codePointAt(0)!
      if (linkerScript !== undefined && LETTER.test(next) && indicScriptOf(nextPoint) === linkerScript) {
        grapheme += next
        lastHangulClass = hangulClass(nextPoint)
        activeIndicScript = linkerScript
        linkerScript = undefined
        index += 1
        continue
      }
      const nextHangulClass = hangulClass(nextPoint)
      if (joinsHangul(lastHangulClass, nextHangulClass)) {
        grapheme += next
        lastHangulClass = nextHangulClass
        index += 1
        continue
      }
      break
    }
    graphemes.push(grapheme)
  }
  return graphemes
}

function graphemesOf(text: string): string[] {
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), ({ segment }) => segment)
  }
  return fallbackGraphemes(text)
}

function wrapLine(text: string, maxWidth: number, fontSize: number, measure: LeafTextMeasure): string[] {
  const lines: string[] = []
  let remaining = graphemesOf(text)

  if (remaining.length === 0) return ['']
  while (remaining.length > 0) {
    if (measuredWidth(remaining.join(''), fontSize, measure) <= maxWidth) {
      lines.push(remaining.join(''))
      break
    }

    const fit = Math.max(1, fittingPrefix(remaining, maxWidth, fontSize, measure))
    let end = fit
    for (let index = fit; index > 0; index -= 1) {
      if (/\s/u.test(remaining[index - 1]!)) {
        end = index
        break
      }
    }
    lines.push(remaining.slice(0, end).join(''))
    remaining = remaining.slice(end)
  }
  return lines
}

function layoutAtFont(
  text: string,
  bounds: LeafTextBounds,
  fontSize: number,
  measure: LeafTextMeasure,
): LeafTextLayout {
  const explicit = explicitLines(text)
  const lines: string[] = []
  const breaks: LeafTextBreak[] = []

  for (let segmentIndex = 0; segmentIndex < explicit.segments.length; segmentIndex += 1) {
    const wrapped = wrapLine(explicit.segments[segmentIndex]!, bounds.maxWidth, fontSize, measure)
    for (let lineIndex = 0; lineIndex < wrapped.length; lineIndex += 1) {
      lines.push(wrapped[lineIndex]!)
      if (lineIndex < wrapped.length - 1) breaks.push('wrap')
    }
    const separator = explicit.separators[segmentIndex]
    if (separator) breaks.push(separator)
  }

  const lineHeight = fontSize * (bounds.lineHeightRatio ?? 1.2)
  const width = Math.max(0, ...lines.map((line) => measuredWidth(line, fontSize, measure)))
  return { lines, breaks, fontSize, lineHeight, width, height: lineHeight * lines.length }
}

const MAX_FONT_SEARCH_ATTEMPTS = 1076

function layoutFits(layout: LeafTextLayout, bounds: LeafTextBounds): boolean {
  return layout.width <= bounds.maxWidth && layout.height <= bounds.maxHeight
}

/** Finds a whole-step font size that preserves all input characters and fits the box. */
export function layoutLeafText(
  text: string,
  bounds: LeafTextBounds,
  measure: LeafTextMeasure,
): LeafTextLayout {
  const { maxWidth, maxHeight, minFontSize, maxFontSize } = bounds
  const lineHeightRatio = bounds.lineHeightRatio ?? 1.2
  if (![maxWidth, maxHeight, minFontSize, maxFontSize, lineHeightRatio].every(Number.isFinite)) {
    throw new RangeError('Text bounds must be finite.')
  }
  if (maxWidth <= 0 || maxHeight <= 0 || minFontSize <= 0 || maxFontSize < minFontSize || lineHeightRatio <= 0) {
    throw new RangeError('Text bounds must be positive and font sizes must be ordered.')
  }

  const maximum = layoutAtFont(text, bounds, maxFontSize, measure)
  if (layoutFits(maximum, bounds)) return maximum
  const minimum = layoutAtFont(text, bounds, minFontSize, measure)
  if (!layoutFits(minimum, bounds)) {
    throw new RangeError('Text cannot fit within the requested bounds without truncation.')
  }

  let fittingLayout = minimum
  const latticeEnd = Math.ceil(maxFontSize - minFontSize)
  const fontAt = (index: number) => index === latticeEnd
    ? minFontSize
    : Math.max(minFontSize, maxFontSize - index)
  let fittingIndex = latticeEnd
  const lowestLatticeIndex = latticeEnd - 1
  const lowestLatticeFont = fontAt(lowestLatticeIndex)
  if (lowestLatticeIndex > 0 && lowestLatticeFont > minFontSize && lowestLatticeFont < maxFontSize) {
    const lowestLatticeLayout = layoutAtFont(text, bounds, lowestLatticeFont, measure)
    if (!layoutFits(lowestLatticeLayout, bounds)) return fittingLayout
    fittingLayout = lowestLatticeLayout
    fittingIndex = lowestLatticeIndex
  } else if (Number.isInteger(maxFontSize - minFontSize)) {
    const nextWholeFont = minFontSize + 1
    if (nextWholeFont > minFontSize && nextWholeFont < maxFontSize) {
      const nextWholeLayout = layoutAtFont(text, bounds, nextWholeFont, measure)
      if (!layoutFits(nextWholeLayout, bounds)) return fittingLayout
    }
  }

  let unfittingIndex = 0
  for (let attempt = 0; attempt < MAX_FONT_SEARCH_ATTEMPTS; attempt += 1) {
    if (fittingIndex - unfittingIndex <= 1) break
    const candidateIndex = unfittingIndex + Math.floor((fittingIndex - unfittingIndex) / 2)
    if (!(candidateIndex > unfittingIndex) || !(candidateIndex < fittingIndex)) break
    const candidateFont = fontAt(candidateIndex)
    const layout = layoutAtFont(text, bounds, candidateFont, measure)
    if (layoutFits(layout, bounds)) {
      fittingLayout = layout
      fittingIndex = candidateIndex
    } else {
      unfittingIndex = candidateIndex
    }
  }
  return fittingLayout
}

export interface LeafTarget {
  /** Horizontal mask coordinate, inside an active pixel. */
  x: number
  /** Vertical mask coordinate, inside an active pixel. */
  y: number
}

interface ActivePixel {
  index: number
  x: number
  y: number
}

export const LEAF_ALPHA_THRESHOLD = 127

function seedValue(seed: number | string): number {
  if (typeof seed === 'number') return Number.isFinite(seed) ? seed >>> 0 : 0
  let value = 2166136261
  for (const point of Array.from(seed)) {
    value ^= point.codePointAt(0)!
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

function seededRandom(seed: number | string): () => number {
  let value = seedValue(seed)
  return () => {
    value = (value + 0x6d2b79f5) | 0
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(values: T[], random: () => number): T[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const held = values[index]!
    values[index] = values[swapIndex]!
    values[swapIndex] = held
  }
  return values
}

function greatestCommonDivisor(a: number, b: number): number {
  let left = a
  let right = b
  while (right !== 0) {
    const remainder = left % right
    left = right
    right = remainder
  }
  return left
}

/**
 * Samples mask pixels in pixel coordinates. Integer parts identify the source
 * pixel; fractional parts keep duplicate targets distinct without leaving it.
 */
export function sampleLeafTargets(
  alphaMask: ArrayLike<number>,
  width: number,
  height: number,
  count: number,
  seed: number | string,
): LeafTarget[] {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError('Mask dimensions must be positive integers.')
  }
  if (!Number.isInteger(count) || count < 0) throw new RangeError('Target count must be a non-negative integer.')
  if (alphaMask.length < width * height) throw new RangeError('Alpha mask is smaller than its dimensions.')
  if (count === 0) return []

  const active: ActivePixel[] = []
  const bands: Array<{ start: number; end: number }> = []
  let minXPixel: ActivePixel | undefined
  let maxXPixel: ActivePixel | undefined
  let minYPixel: ActivePixel | undefined
  let maxYPixel: ActivePixel | undefined
  let previousRowActive = false
  for (let y = 0; y < height; y += 1) {
    const rowStart = active.length
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      if (alphaMask[index]! > LEAF_ALPHA_THRESHOLD) {
        const pixel = { index, x, y }
        active.push(pixel)
        if (!minXPixel || x < minXPixel.x) minXPixel = pixel
        if (!maxXPixel || x > maxXPixel.x) maxXPixel = pixel
        if (!minYPixel || y < minYPixel.y) minYPixel = pixel
        if (!maxYPixel || y > maxYPixel.y) maxYPixel = pixel
      }
    }
    const rowActive = active.length > rowStart
    if (rowActive && previousRowActive) bands[bands.length - 1]!.end = active.length
    else if (rowActive) bands.push({ start: rowStart, end: active.length })
    previousRowActive = rowActive
  }
  if (active.length === 0) throw new RangeError('Cannot sample an empty alpha mask.')

  const random = seededRandom(seed)
  const uniqueLimit = Math.min(count, active.length)
  const selected: ActivePixel[] = []
  const selectedIndices = new Set<number>()
  const add = (pixel: ActivePixel | undefined) => {
    if (pixel && selected.length < uniqueLimit && !selectedIndices.has(pixel.index)) {
      selected.push(pixel)
      selectedIndices.add(pixel.index)
    }
  }

  add(minXPixel)
  add(maxXPixel)
  add(minYPixel)
  add(maxYPixel)

  for (const band of bands) {
    if (selected.length >= uniqueLimit) break
    add(active[band.start + Math.floor(random() * (band.end - band.start))])
  }

  if (selected.length < uniqueLimit) {
    let activeIndex = Math.floor(random() * active.length)
    let stride = active.length === 1 ? 1 : 1 + Math.floor(random() * (active.length - 1))
    while (greatestCommonDivisor(stride, active.length) !== 1) {
      stride = stride === active.length - 1 ? 1 : stride + 1
    }
    for (let visited = 0; visited < active.length && selected.length < uniqueLimit; visited += 1) {
      add(active[activeIndex])
      activeIndex = (activeIndex + stride) % active.length
    }
  }
  shuffled(selected, random)

  const targets = selected.map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 }))
  while (targets.length < count) {
    const pixel = selected[Math.floor(random() * selected.length)]!
    const jitterX = (random() - 0.5) * 0.5
    const jitterY = (random() - 0.5) * 0.5
    targets.push({ x: pixel.x + 0.5 + jitterX, y: pixel.y + 0.5 + jitterY })
  }
  return targets
}

export interface RevealBlend {
  leafOpacity: number
  textOpacity: number
}

const TEXT_REVEAL_START = 0.72

function smoothstep(progress: number): number {
  if (progress <= 0) return 0
  if (progress >= 1) return 1
  return progress * progress * (3 - 2 * progress)
}

/** Crossfades late to text while retaining enough canopy to avoid a blank frame. */
export function revealBlend(progress: number): RevealBlend {
  const clamped = Math.min(1, Math.max(0, progress))
  const textOpacity = smoothstep((clamped - TEXT_REVEAL_START) / (1 - TEXT_REVEAL_START))
  return {
    leafOpacity: 0.2 + 0.8 * (1 - textOpacity),
    textOpacity,
  }
}
