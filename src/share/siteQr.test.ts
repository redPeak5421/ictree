import { describe, expect, it } from 'vitest'
import jsQR from 'jsqr'
import { applyPalette, quantize } from 'gifenc'
import { colorsOf } from '../scene/palettes'
import { DEFAULT_PAYLOAD } from '../qr/payload'
import { compositeSiteQr, siteQrPayload } from './siteQr'

function creamFrame(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 244
    data[i + 1] = 241
    data[i + 2] = 234
    data[i + 3] = 255
  }
  return { data, width, height }
}

function decodeFrame(frame: { data: Uint8ClampedArray; width: number; height: number }) {
  return jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'attemptBoth' })
}

function sample(frame: { data: Uint8ClampedArray; width: number }, x: number, y: number) {
  const i = (y * frame.width + x) * 4
  return [frame.data[i]!, frame.data[i + 1]!, frame.data[i + 2]!] as const
}

describe('siteQrPayload', () => {
  it('encodes the current origin as a URL', () => {
    expect(siteQrPayload('https://grove.example.com', '/')).toBe('https://grove.example.com/')
    expect(siteQrPayload('https://ictree.example.workers.dev/', '')).toBe('https://ictree.example.workers.dev/')
  })

  it('keeps a deployed subpath so the QR opens the app, not the host root', () => {
    expect(siteQrPayload('https://user.github.io', '/QRCode/')).toBe('https://user.github.io/QRCode/')
    expect(siteQrPayload('https://user.github.io', '/QRCode')).toBe('https://user.github.io/QRCode')
  })

  it('falls back when origin is missing', () => {
    expect(siteQrPayload('')).toBe(DEFAULT_PAYLOAD)
  })
})

describe('compositeSiteQr', () => {
  const site = 'https://grove.example.com/'

  it('paints a bottom-right themed QR of the site address', () => {
    const frame = creamFrame(640, 480)
    const placed = compositeSiteQr(frame, colorsOf('autumn', 'cherry'), site)
    expect(placed.width).toBeLessThanOrEqual(Math.round(Math.min(640, 480) * 0.28))
    expect(placed.x).toBeGreaterThan(640 / 2)
    expect(placed.y).toBeGreaterThan(480 / 2)
    expect(placed.x + placed.width).toBeLessThanOrEqual(640)
    expect(placed.y + placed.height).toBeLessThanOrEqual(480)
    expect(decodeFrame(frame)?.data).toBe(site)
  })

  it('uses the selected tree and season colours for dark modules', () => {
    const cherry = creamFrame(480, 480)
    const maple = creamFrame(480, 480)
    const cherryPlaced = compositeSiteQr(cherry, colorsOf('spring', 'cherry'), site)
    const maplePlaced = compositeSiteQr(maple, colorsOf('autumn', 'maple'), site)
    const cx = cherryPlaced.x + Math.floor(cherryPlaced.width / 2)
    const cy = cherryPlaced.y + Math.floor(cherryPlaced.height / 2)
    const mx = maplePlaced.x + Math.floor(maplePlaced.width / 2)
    const my = maplePlaced.y + Math.floor(maplePlaced.height / 2)
    expect(sample(cherry, cx, cy)).not.toEqual(sample(maple, mx, my))
    expect(decodeFrame(cherry)?.data).toBe(site)
    expect(decodeFrame(maple)?.data).toBe(site)
  })

  it('encodes the site address, not the grove payload', () => {
    const frame = creamFrame(512, 512)
    compositeSiteQr(frame, colorsOf('summer', 'willow'), 'https://grove.example.com/app')
    expect(decodeFrame(frame)?.data).toBe('https://grove.example.com/app')
    expect(decodeFrame(frame)?.data).not.toBe('https://secret.example/hidden')
  })

  it('stays scannable after gifenc 256-color quantization', () => {
    const frame = creamFrame(640, 480)
    compositeSiteQr(frame, colorsOf('autumn', 'maple'), site)
    const palette = quantize(frame.data, 256, { format: 'rgb565' })
    const index = applyPalette(frame.data, palette)
    const quantized = new Uint8ClampedArray(frame.data.length)
    for (let i = 0; i < index.length; i++) {
      const rgb = palette[index[i]!]!
      const o = i * 4
      quantized[o] = rgb[0]!
      quantized[o + 1] = rgb[1]!
      quantized[o + 2] = rgb[2]!
      quantized[o + 3] = 255
    }
    expect(jsQR(quantized, frame.width, frame.height, { inversionAttempts: 'attemptBoth' })?.data).toBe(site)
  })
})
