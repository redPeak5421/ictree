import { useEffect, useRef } from 'react'
import { useT } from '../i18n/useLocale'
import { rasterQr } from '../qr/raster'
import { QUIET_ZONE, type ModuleGrid } from '../qr/types'
import type { SceneColors } from '../scene/palettes'

export function QrFallback({ grid, colors }: { grid: ModuleGrid; colors: SceneColors }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const t = useT()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const { data, width, height } = rasterQr(grid, colors, {
      modulePx: 8,
      quiet: QUIET_ZONE,
      morphT: 1,
    })
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.putImageData(new ImageData(data, width, height), 0, 0)
  }, [colors, grid])

  return (
    <div className="qr-fallback">
      <p className="qr-fallback-note">{t.webglUnavailable}</p>
      <canvas ref={ref} className="qr-fallback-canvas" />
    </div>
  )
}
