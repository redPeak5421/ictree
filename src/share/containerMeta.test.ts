import { describe, expect, it } from 'vitest'
import {
  appendPngTrailer,
  injectGifComment,
  insertPngChunksAfterIhdr,
  normalizeHiddenText,
  pickHiddenSearch,
  readGifComments,
  readJpegCom,
  readPngChunk,
  readPngText,
  readPngTrailer,
  textGroveData,
} from './containerMeta'
import { frameStillPayload, unframeStillPayload } from './stillEncode'

const SEARCH = '?u=https://example.com/a%20b&s=spring&p=coral&t=maple'

const MIN_PNG = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83,
  222, 0, 0, 0, 12, 73, 68, 65, 84, 8, 215, 99, 96, 96, 96, 0, 0, 0, 4, 0, 1, 39, 52, 39, 10, 0, 0, 0, 0, 73, 69, 78,
  68, 174, 66, 96, 130,
])

const MIN_GIF = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
])

function stripPngTrailer(png: Uint8Array): Uint8Array {
  const trailer = readPngTrailer(png)
  if (!trailer) return png
  return png.subarray(0, png.length - trailer.length)
}

function rebuildPngWithoutMeta(png: Uint8Array): Uint8Array {
  const sig = png.subarray(0, 8)
  const kept: Uint8Array[] = [sig]
  let pos = 8
  while (pos + 12 <= png.length) {
    const len = ((png[pos]! << 24) | (png[pos + 1]! << 16) | (png[pos + 2]! << 8) | png[pos + 3]!) >>> 0
    const end = pos + 12 + len
    if (end > png.length) break
    const type = String.fromCharCode(png[pos + 4]!, png[pos + 5]!, png[pos + 6]!, png[pos + 7]!)
    if (type === 'tEXt' || type === 'grVe') {
      pos = end
      continue
    }
    kept.push(png.subarray(pos, end))
    pos = end
    if (type === 'IEND') break
  }
  const out = new Uint8Array(kept.reduce((n, part) => n + part.length, 0))
  let off = 0
  for (const part of kept) {
    out.set(part, off)
    off += part.length
  }
  return out
}

describe('PNG still metadata', () => {
  it('writes and reads tEXt, grVe, and an IEND trailer', () => {
    const framed = frameStillPayload(SEARCH)
    const withChunks = insertPngChunksAfterIhdr(MIN_PNG, [
      { type: 'tEXt', data: textGroveData(SEARCH) },
      { type: 'grVe', data: framed },
    ])
    const full = appendPngTrailer(withChunks, framed)
    expect(readPngText(full, 'grove')).toBe(SEARCH)
    expect(unframeStillPayload(readPngChunk(full, 'grVe')!)).toBe(SEARCH)
    expect(unframeStillPayload(readPngTrailer(full)!)).toBe(SEARCH)

    const noTrailer = stripPngTrailer(full)
    expect(readPngText(noTrailer, 'grove')).toBe(SEARCH)
    expect(unframeStillPayload(readPngChunk(noTrailer, 'grVe')!)).toBe(SEARCH)
    expect(readPngTrailer(noTrailer)).toBeNull()

    const pixelsOnly = rebuildPngWithoutMeta(full)
    expect(readPngText(pixelsOnly, 'grove')).toBeNull()
    expect(readPngChunk(pixelsOnly, 'grVe')).toBeNull()
    expect(readPngTrailer(pixelsOnly)).toBeNull()
  })
})

describe('GIF and vote helpers', () => {
  it('injects a comment that can be stripped', () => {
    const withComment = injectGifComment(MIN_GIF, SEARCH)
    expect(readGifComments(withComment)).toContain(SEARCH)
    const start = withComment.findIndex(
      (byte, i) => byte === 0x21 && withComment[i + 1] === 0xfe,
    )
    expect(start).toBeGreaterThan(-1)
    let end = start + 2
    while (end < withComment.length && withComment[end] !== 0) {
      end += 1 + withComment[end]!
    }
    end += 1
    const stripped = new Uint8Array(withComment.length - (end - start))
    stripped.set(withComment.subarray(0, start))
    stripped.set(withComment.subarray(end), start)
    expect(readGifComments(stripped)).not.toContain(SEARCH)
  })

  it('majority-votes hidden search strings', () => {
    expect(pickHiddenSearch([SEARCH, SEARCH, '?u=other&s=autumn&p=default'])).toBe(SEARCH)
    expect(pickHiddenSearch([null, null])).toBeNull()
    expect(normalizeHiddenText('https://x.example/' + SEARCH)).toBe(SEARCH)
  })

  it('reads JPEG COM segments', () => {
    const payload = new TextEncoder().encode(SEARCH)
    const jpeg = new Uint8Array(4 + 2 + payload.length + 2)
    jpeg[0] = 0xff
    jpeg[1] = 0xd8
    jpeg[2] = 0xff
    jpeg[3] = 0xfe
    const len = payload.length + 2
    jpeg[4] = (len >> 8) & 0xff
    jpeg[5] = len & 0xff
    jpeg.set(payload, 6)
    jpeg[6 + payload.length] = 0xff
    jpeg[7 + payload.length] = 0xd9
    expect(readJpegCom(jpeg)).toEqual([SEARCH])
  })
})
