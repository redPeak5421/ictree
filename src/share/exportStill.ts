import { colorsOf } from '../scene/palettes'
import { appendPngTrailer, insertPngChunksAfterIhdr, PNG_CHUNK_TYPE, textGroveData } from './containerMeta'
import { buildShareSearch, type ShareState } from './params'
import { compositeSiteQr, siteQrPayload } from './siteQr'
import { frameStillPayload } from './stillEncode'

const STILL_FILENAME = 'grove-still.png'
export const STILL_NO_CANVAS = 'Need WebGL to save a still.'

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

export async function downloadStillPng(state: ShareState): Promise<void> {
  const search = buildShareSearch(state)
  const framed = frameStillPayload(search)
  const src = document.querySelector('[data-grove-canvas]') as HTMLCanvasElement | null
  if (!src) throw new Error(STILL_NO_CANVAS)
  await nextFrame()
  const out = document.createElement('canvas')
  out.width = src.width
  out.height = src.height
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error(STILL_NO_CANVAS)
  ctx.drawImage(src, 0, 0)
  const image = ctx.getImageData(0, 0, out.width, out.height)
  compositeSiteQr(image, colorsOf(state.season, state.tree), siteQrPayload())
  ctx.putImageData(image, 0, 0)
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error(STILL_NO_CANVAS)
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const withChunks = insertPngChunksAfterIhdr(bytes, [
    { type: 'tEXt', data: textGroveData(search) },
    { type: PNG_CHUNK_TYPE, data: framed },
  ])
  const final = appendPngTrailer(withChunks, framed)
  downloadBlob(new Blob([Uint8Array.from(final)], { type: 'image/png' }), STILL_FILENAME)
}
