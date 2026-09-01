import jsQR from 'jsqr'
import { rasterQr } from '../qr/raster'
import type { ModuleGrid } from '../qr/types'
import type { SceneColors } from '../scene/palettes'
import { tokenFromQrBytes } from './secret'

export function scanTreePayload(grid: ModuleGrid, colors: SceneColors): string | null {
  const { data, width, height } = rasterQr(grid, colors, { modulePx: 8, quiet: 4, morphT: 1 })
  const decoded = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })
  if (!decoded) return null
  return tokenFromQrBytes(decoded.binaryData) ?? decoded.data ?? null
}
