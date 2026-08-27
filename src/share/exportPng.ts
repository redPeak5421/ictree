import { QUIET_ZONE, type ModuleGrid } from '../qr/types'
import { rasterQr } from '../qr/raster'
import type { SceneColors } from '../scene/palettes'

export function downloadQrPng(grid: ModuleGrid, colors: SceneColors, filename = 'grove-qr.png') {
  const n = grid.size + QUIET_ZONE * 2
  const modulePx = Math.max(8, Math.floor(1024 / n))
  const { data, width, height } = rasterQr(grid, colors, {
    modulePx,
    quiet: QUIET_ZONE,
    morphT: 1,
  })
  const src = document.createElement('canvas')
  src.width = width
  src.height = height
  const ctx = src.getContext('2d')
  if (!ctx) return
  ctx.putImageData(new ImageData(data, width, height), 0, 0)

  // A dense code can raster wider than 1024 even at the minimum module size;
  // never let it be cropped, because a cropped QR silently stops scanning.
  const side = Math.max(1024, width)
  const out = document.createElement('canvas')
  out.width = side
  out.height = side
  const octx = out.getContext('2d')
  if (!octx) return
  octx.fillStyle = '#f4f1ea'
  octx.fillRect(0, 0, side, side)
  octx.imageSmoothingEnabled = false
  const pad = Math.floor((side - width) / 2)
  octx.drawImage(src, pad, pad)

  out.toBlob((blob) => {
    if (!blob) return
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = filename
    a.click()
    URL.revokeObjectURL(href)
  }, 'image/png')
}
