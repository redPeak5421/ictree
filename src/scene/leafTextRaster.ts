import { layoutLeafText, type LeafTextLayout } from './leafReveal'
import {
  LEAF_GATHER_FONT_FAMILY,
  leafGatherLineBox,
  leafGatherTextBoundsFor,
} from './leafGather'

const FONT_WEIGHT = 700
const FONT_METRIC_SAMPLE = 'ÅMg中国gjpq'
const SAFE_ASCENT_RATIO = 0.8
const SAFE_DESCENT_RATIO = 0.2

export interface LeafTextRasterLine {
  /** The literal display-line content returned by layoutLeafText. */
  text: string
  x: number
  top: number
  height: number
  baseline: number
  width: number
}

export interface LeafTextRaster {
  layout: LeafTextLayout
  lines: LeafTextRasterLine[]
  alphaMask: Uint8ClampedArray
  stageWidth: number
  stageHeight: number
}

function fontDeclaration(fontSize: number): string {
  return `${FONT_WEIGHT} ${fontSize}px ${LEAF_GATHER_FONT_FAMILY}`
}

function positiveMetric(primary: number | undefined, secondary: number | undefined, fallback: number): number {
  if (primary !== undefined && Number.isFinite(primary) && primary > 0) return primary
  if (secondary !== undefined && Number.isFinite(secondary) && secondary > 0) return secondary
  return fallback
}

/**
 * Rasterizes literal reveal text across a full CSS-sized stage. This is
 * intentionally lazy and browser-only: importing the module never touches
 * document, so Node unit tests can still type-check the scene.
 */
export function createLeafTextRaster(
  text: string,
  cssStageWidth: number,
  cssStageHeight: number,
): LeafTextRaster {
  const stageWidth = Math.max(1, Math.round(cssStageWidth))
  const stageHeight = Math.max(1, Math.round(cssStageHeight))
  const bounds = leafGatherTextBoundsFor(text, stageWidth, stageHeight)
  if (typeof document === 'undefined') {
    throw new Error('Leaf-gather text rasterization requires a browser document.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = stageWidth
  canvas.height = stageHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Leaf-gather text rasterization requires a Canvas 2D context.')

  const measure = (value: string, fontSize: number) => {
    context.font = fontDeclaration(fontSize)
    return context.measureText(value).width
  }
  const layout = layoutLeafText(text, bounds, measure)
  context.clearRect(0, 0, stageWidth, stageHeight)
  context.font = fontDeclaration(layout.fontSize)
  context.fillStyle = '#000000'
  context.textAlign = 'center'
  context.textBaseline = 'alphabetic'

  const textTop = bounds.centerY - layout.height / 2
  const representative = context.measureText(FONT_METRIC_SAMPLE)
  const fontAscent = positiveMetric(
    representative.fontBoundingBoxAscent,
    representative.actualBoundingBoxAscent,
    layout.fontSize * SAFE_ASCENT_RATIO,
  )
  const fontDescent = positiveMetric(
    representative.fontBoundingBoxDescent,
    representative.actualBoundingBoxDescent,
    layout.fontSize * SAFE_DESCENT_RATIO,
  )
  const lines = layout.lines.map((line, index) => {
    const box = leafGatherLineBox(textTop, layout.lineHeight, fontAscent, fontDescent, index)
    context.fillText(line, bounds.centerX, box.baseline)
    return {
      text: line,
      x: bounds.centerX,
      top: box.top,
      height: box.height,
      baseline: box.baseline,
      width: measure(line, layout.fontSize),
    }
  })

  const rgba = context.getImageData(0, 0, stageWidth, stageHeight).data
  const alphaMask = new Uint8ClampedArray(stageWidth * stageHeight)
  for (let source = 3, target = 0; source < rgba.length; source += 4, target += 1) {
    alphaMask[target] = rgba[source]!
  }
  return { layout, lines, alphaMask, stageWidth, stageHeight }
}
