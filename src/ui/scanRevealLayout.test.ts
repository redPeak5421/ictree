import { describe, expect, it } from 'vitest'
import { frozenRasterScale, rasterTextPlacement } from './ScanReveal'

interface PlacementInput {
  layout: { width: number; height: number }
  lines: Array<{
    text: string
    x: number
    top: number
    height: number
    baseline: number
    width: number
  }>
}

interface PlacementOutput {
  left: number
  top: number
  width: number
  height: number
  lines: Array<{
    text: string
    left: number
    top: number
    width: number
    height: number
    baseline: number
  }>
}

interface FrozenScaleOutput {
  left: number
  top: number
  scaleX: number
  scaleY: number
}

describe('rasterTextPlacement', () => {
  it('converts authoritative full-stage line boxes to text-button coordinates', () => {
    const raster = {
      layout: { width: 240, height: 96 },
      lines: [
        { text: 'wide line', x: 400, top: 216, height: 48, baseline: 250, width: 160 },
        { text: 'short', x: 400, top: 264, height: 48, baseline: 298, width: 80 },
      ],
    }
    expect((rasterTextPlacement as (input: PlacementInput) => PlacementOutput)(raster)).toEqual({
      left: 280,
      top: 216,
      width: 240,
      height: 96,
      lines: [
        { text: 'wide line', left: 40, top: 0, width: 160, height: 48, baseline: 34 },
        { text: 'short', left: 80, top: 48, width: 80, height: 48, baseline: 82 },
      ],
    })
  })

  it('scales a frozen coordinate box into the current stage without relayout', () => {
    expect((frozenRasterScale as (
      placement: Pick<PlacementOutput, 'left' | 'top'>,
      frozenWidth: number,
      frozenHeight: number,
      currentWidth: number,
      currentHeight: number,
    ) => FrozenScaleOutput)({ left: 280, top: 216 }, 800, 600, 400, 900)).toEqual({
      left: 140,
      top: 324,
      scaleX: 0.5,
      scaleY: 1.5,
    })
  })
})
