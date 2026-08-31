import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useT } from '../i18n/useLocale'
import {
  LEAF_GATHER_DURATION_MS,
  LEAF_GATHER_FONT_FAMILY,
} from '../scene/leafGather'
import { leafTexture } from '../scene/leafTexture'
import { createLeafTextRaster, type LeafTextRaster } from '../scene/leafTextRaster'
import type { SceneColors } from '../scene/palettes'
import { leafShapeFor, type TreeSpecies } from '../scene/treeSpecies'
import type { ScanRevealState } from './scanRevealState'

interface RasterStyle extends CSSProperties {
  '--scan-copy-duration': string
}

export interface RasterLinePlacement {
  text: string
  left: number
  top: number
  width: number
  height: number
  baseline: number
}

export interface RasterTextPlacement {
  left: number
  top: number
  width: number
  height: number
  lines: RasterLinePlacement[]
}

export interface FrozenRasterScale {
  left: number
  top: number
  scaleX: number
  scaleY: number
}

interface FrozenRaster {
  raster: LeafTextRaster
  width: number
  height: number
}

/** Maps frozen CSS pixel coordinates through the resized WebGL viewport. */
export function frozenRasterScale(
  placement: Pick<RasterTextPlacement, 'left' | 'top'>,
  frozenWidth: number,
  frozenHeight: number,
  currentWidth: number,
  currentHeight: number,
): FrozenRasterScale {
  const scaleX = Math.max(1, currentWidth) / Math.max(1, frozenWidth)
  const scaleY = Math.max(1, currentHeight) / Math.max(1, frozenHeight)
  return {
    left: placement.left * scaleX,
    top: placement.top * scaleY,
    scaleX,
    scaleY,
  }
}

/** Converts full-stage raster boxes to coordinates local to the text button. */
export function rasterTextPlacement(
  raster: Pick<LeafTextRaster, 'layout' | 'lines'>,
): RasterTextPlacement {
  const first = raster.lines[0]
  if (!first) return { left: 0, top: 0, width: 0, height: 0, lines: [] }
  const left = first.x - raster.layout.width / 2
  const top = first.top
  const bottom = Math.max(...raster.lines.map((line) => line.top + line.height))
  return {
    left,
    top,
    width: raster.layout.width,
    height: bottom - top,
    lines: raster.lines.map((line) => ({
      text: line.text,
      left: line.x - left - line.width / 2,
      top: line.top - top,
      width: line.width,
      height: line.height,
      baseline: line.baseline - top,
    })),
  }
}

function textureTile(
  tree: TreeSpecies,
  foliage: string,
  foliageVar: string,
  accent: string,
): string | null {
  if (typeof document === 'undefined') return null
  try {
    const shape = leafShapeFor(tree)
    const source = leafTexture(shape).image as CanvasImageSource & { width?: number; height?: number }
    const width = Math.max(1, Number(source.width) || 0)
    const height = Math.max(1, Number(source.height) || 0)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context || typeof canvas.toDataURL !== 'function') return null

    context.drawImage(source, 0, 0, width, height)
    context.globalCompositeOperation = 'source-in'
    const tint = context.createLinearGradient(0, 0, width, height)
    tint.addColorStop(0, foliageVar)
    tint.addColorStop(0.48, foliage)
    tint.addColorStop(0.82, foliageVar)
    tint.addColorStop(1, accent)
    context.fillStyle = tint
    context.fillRect(0, 0, width, height)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

function literalLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/u)
}

export function ScanReveal({
  reveal,
  tree,
  colors,
  reduced,
  onClose,
}: {
  reveal: ScanRevealState
  tree: TreeSpecies
  colors: SceneColors
  reduced: boolean
  onClose: () => void
}) {
  const t = useT()
  const host = useRef<HTMLDivElement>(null)
  const frozenRef = useRef<{ text: string; value: FrozenRaster | null } | null>(null)
  const [copied, setCopied] = useState(false)
  const [frozen, setFrozen] = useState<FrozenRaster | null>(null)
  const [hostSize, setHostSize] = useState<{ width: number; height: number } | null>(null)
  const textureUrl = useMemo(
    () => textureTile(tree, colors.foliage, colors.foliageVar, colors.accent),
    [colors.accent, colors.foliage, colors.foliageVar, tree],
  )

  useLayoutEffect(() => {
    const element = host.current
    if (!element) return
    const measure = () => {
      const bounds = element.getBoundingClientRect()
      return {
        width: Math.max(1, Math.round(bounds.width)),
        height: Math.max(1, Math.round(bounds.height)),
      }
    }
    const initial = measure()
    setHostSize(initial)
    const cached = frozenRef.current
    if (cached?.text === reveal.text) {
      setFrozen(cached.value)
    } else {
      let value: FrozenRaster | null = null
      try {
        value = {
          raster: createLeafTextRaster(reveal.text, initial.width, initial.height),
          ...initial,
        }
      } catch {
        // Solid literal text remains as the browser-only fallback.
      }
      frozenRef.current = { text: reveal.text, value }
      setFrozen(value)
    }

    const updateSize = () => {
      const next = measure()
      setHostSize((current) => current?.width === next.width && current.height === next.height
        ? current
        : next)
    }
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize)
      return () => window.removeEventListener('resize', updateSize)
    }
    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [reveal.text])

  const copyEnabled = (reveal.materializing || reduced) && !reveal.closing
  const copy = async () => {
    if (!copyEnabled) return
    try {
      await navigator.clipboard.writeText(reveal.text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const raster = frozen?.raster ?? null
  const placement = raster ? rasterTextPlacement(raster) : null
  const scaled = frozen && hostSize && placement
    ? frozenRasterScale(
        placement,
        frozen.width,
        frozen.height,
        hostSize.width,
        hostSize.height,
      )
    : null
  const wordStyle: RasterStyle = {
    '--scan-copy-duration': `${Math.round(LEAF_GATHER_DURATION_MS * 0.28)}ms`,
    color: colors.foliage,
    fontFamily: LEAF_GATHER_FONT_FAMILY,
  }
  if (raster && placement && scaled) {
    wordStyle.left = scaled.left
    wordStyle.top = scaled.top
    wordStyle.width = placement.width
    wordStyle.height = placement.height
    wordStyle.fontSize = raster.layout.fontSize
    wordStyle.lineHeight = `${raster.layout.lineHeight}px`
    wordStyle.transform = `scale(${scaled.scaleX}, ${scaled.scaleY})`
    wordStyle.transformOrigin = 'top left'
  }
  const textureStyle: CSSProperties | undefined = textureUrl
    ? { backgroundImage: `url("${textureUrl}")` }
    : undefined

  const renderLines = () => placement
    ? placement.lines.map((line, index) => (
        <span
          className="scan-reveal-line"
          key={`${index}:${line.text}`}
          style={{
            left: line.left,
            top: line.top,
            width: line.width,
            height: line.height,
            lineHeight: `${line.height}px`,
          }}
        >
          {line.text}
        </span>
      ))
    : literalLines(reveal.text).map((line, index) => (
        <span className="scan-reveal-line" key={`${index}:${line}`}>
          {line}
        </span>
      ))

  return (
    <div
      ref={host}
      className={[
        'scan-reveal',
        reveal.materializing ? 'is-materializing' : '',
        reveal.settled ? 'is-settled' : '',
        reveal.closing ? 'is-closing' : '',
        reduced ? 'is-reduced' : '',
      ].filter(Boolean).join(' ')}
      style={
        {
          '--scan-leaf': colors.foliage,
          '--scan-var': colors.foliageVar,
          '--scan-accent': colors.accent,
          '--scan-finder': colors.finder,
        } as CSSProperties
      }
    >
      <button
        type="button"
        className={`scan-words${placement ? ' has-raster' : ''}`}
        style={wordStyle}
        onClick={() => void copy()}
        aria-label={`${t.copyPayload}: ${reveal.text}`}
        aria-disabled={!copyEnabled}
        tabIndex={copyEnabled ? 0 : -1}
      >
        <span className="scan-words-base" aria-hidden="true">{renderLines()}</span>
        {textureUrl && (
          <span className="scan-words-texture" style={textureStyle} aria-hidden="true">
            {renderLines()}
          </span>
        )}
      </button>
      {copied && <p className="scan-copied" role="status">{t.copied}</p>}
      <button
        type="button"
        className="scan-dismiss"
        onClick={onClose}
        disabled={reveal.closing}
        aria-label={t.restoreQr}
      >
        {t.restoreQr}
      </button>
    </div>
  )
}
