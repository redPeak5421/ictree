import { encodeGrid } from '../qr/encode'
import { DEFAULT_PAYLOAD } from '../qr/payload'
import { rasterQr } from '../qr/raster'
import { QUIET_ZONE } from '../qr/types'
import type { SceneColors } from '../scene/palettes'

interface SiteQrPatch {
  data: Uint8ClampedArray
  width: number
  height: number
  x: number
  y: number
}

interface SiteQrPlacement {
  x: number
  y: number
  width: number
  height: number
}

const MAX_FRACTION = 0.26
const MIN_MODULE_PX = 2
const PREFERRED_MODULE_PX = 3
const MAX_MODULE_PX = 8
const MARGIN_FRACTION = 0.03

export function siteQrPayload(
  origin = globalThis.location?.origin ?? '',
  pathname = globalThis.location?.pathname ?? '/',
): string {
  if (!origin) return DEFAULT_PAYLOAD
  try {
    const url = new URL(pathname || '/', origin)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return DEFAULT_PAYLOAD
    const path = url.pathname || '/'
    return path === '/' ? `${url.origin}/` : `${url.origin}${path}`
  } catch {
    return DEFAULT_PAYLOAD
  }
}

export function rasterSiteQr(
  colors: SceneColors,
  payload: string,
  frameWidth: number,
  frameHeight: number,
): SiteQrPatch {
  const grid = encodeGrid(payload)
  const n = grid.size + QUIET_ZONE * 2
  const maxSide = Math.min(frameWidth, frameHeight)
  const cap = Math.max(n * MIN_MODULE_PX, Math.floor(maxSide * MAX_FRACTION))
  let modulePx = Math.floor(cap / n)
  if (modulePx < MIN_MODULE_PX) modulePx = MIN_MODULE_PX
  if (modulePx < PREFERRED_MODULE_PX && PREFERRED_MODULE_PX * n <= Math.floor(maxSide * MAX_FRACTION)) {
    modulePx = PREFERRED_MODULE_PX
  }
  if (modulePx > MAX_MODULE_PX) modulePx = MAX_MODULE_PX
  const { data, width, height } = rasterQr(grid, colors, {
    modulePx,
    quiet: QUIET_ZONE,
    morphT: 1,
  })
  const margin = Math.max(4, Math.round(maxSide * MARGIN_FRACTION))
  return {
    data,
    width,
    height,
    x: Math.max(0, frameWidth - width - margin),
    y: Math.max(0, frameHeight - height - margin),
  }
}

export function blitSiteQr(
  frame: { data: Uint8ClampedArray; width: number; height: number },
  patch: SiteQrPatch,
): SiteQrPlacement {
  const destX = Math.max(0, patch.x)
  const destY = Math.max(0, patch.y)
  const maxX = Math.min(patch.width, frame.width - destX)
  const maxY = Math.min(patch.height, frame.height - destY)
  if (maxX > 0 && maxY > 0) {
    const rowBytes = maxX * 4
    for (let row = 0; row < maxY; row++) {
      const destOff = ((destY + row) * frame.width + destX) * 4
      const srcOff = row * patch.width * 4
      frame.data.set(patch.data.subarray(srcOff, srcOff + rowBytes), destOff)
    }
  }
  return { x: destX, y: destY, width: Math.max(0, maxX), height: Math.max(0, maxY) }
}

export function compositeSiteQr(
  frame: { data: Uint8ClampedArray; width: number; height: number },
  colors: SceneColors,
  payload: string,
): SiteQrPlacement {
  return blitSiteQr(frame, rasterSiteQr(colors, payload, frame.width, frame.height))
}
