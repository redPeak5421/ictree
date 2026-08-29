import { describe, expect, it } from 'vitest'
import {
  appendPngTrailer,
  injectGifComment,
  insertPngChunksAfterIhdr,
  PNG_CHUNK_TYPE,
  textGroveData,
} from './containerMeta'
import { readStillFile, STILL_ERROR } from './importStill'
import { frameStillPayload } from './stillEncode'

const SEARCH = '?u=https://example.com/a%20b&s=spring&p=coral'
const STATE = {
  url: 'https://example.com/a b',
  season: 'spring',
  palette: 'coral',
  locked: false,
  mode: 'create',
} as const

const MIN_PNG = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83,
  222, 0, 0, 0, 12, 73, 68, 65, 84, 8, 215, 99, 96, 96, 96, 0, 0, 0, 4, 0, 1, 39, 52, 39, 10, 0, 0, 0, 0, 73, 69, 78,
  68, 174, 66, 96, 130,
])

const MIN_GIF = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
])

function fileOf(bytes: Uint8Array, name: string, type: string): File {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new File([copy.buffer], name, { type })
}

describe('readStillFile', () => {
  it('reads PNG tEXt / grVe / trailer', async () => {
    const framed = frameStillPayload(SEARCH)
    const png = appendPngTrailer(
      insertPngChunksAfterIhdr(MIN_PNG, [
        { type: 'tEXt', data: textGroveData(SEARCH) },
        { type: PNG_CHUNK_TYPE, data: framed },
      ]),
      framed,
    )
    await expect(readStillFile(fileOf(png, 'grove-still.png', 'image/png'))).resolves.toEqual(STATE)
  })

  it('reads a GIF comment', async () => {
    const gif = injectGifComment(MIN_GIF, SEARCH)
    await expect(readStillFile(fileOf(gif, 'grove-loop.gif', 'image/gif'))).resolves.toEqual(STATE)
  })

  it('reads a JPEG COM segment', async () => {
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
    await expect(readStillFile(fileOf(jpeg, 'grove.jpg', 'image/jpeg'))).resolves.toEqual(STATE)
  })

  it('rejects empty, oversized, and metadata-less files', async () => {
    await expect(readStillFile(fileOf(new Uint8Array(), 'empty.png', 'image/png'))).rejects.toThrow(STILL_ERROR)
    await expect(readStillFile(fileOf(MIN_PNG, 'plain.png', 'image/png'))).rejects.toThrow(STILL_ERROR)
    const huge = { size: 12 * 1024 * 1024 + 1, arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)) } } as File
    await expect(readStillFile(huge)).rejects.toThrow(STILL_ERROR)
  })
})
