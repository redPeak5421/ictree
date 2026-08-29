import { crc32, unframeStillPayload } from './stillEncode'

export const PNG_TEXT_KEY = 'grove'
export const PNG_CHUNK_TYPE = 'grVe'

const PNG_SIG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER = new TextDecoder()

function u32(buf: Uint8Array, offset: number): number {
  return ((buf[offset]! << 24) | (buf[offset + 1]! << 16) | (buf[offset + 2]! << 8) | buf[offset + 3]!) >>> 0
}

function putU32(buf: Uint8Array, offset: number, value: number) {
  buf[offset] = (value >>> 24) & 0xff
  buf[offset + 1] = (value >>> 16) & 0xff
  buf[offset + 2] = (value >>> 8) & 0xff
  buf[offset + 3] = value & 0xff
}

function isPng(buf: Uint8Array): boolean {
  if (buf.length < 8) return false
  for (let i = 0; i < 8; i++) if (buf[i] !== PNG_SIG[i]) return false
  return true
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  let n = 0
  for (const part of parts) n += part.length
  const out = new Uint8Array(n)
  let off = 0
  for (const part of parts) {
    out.set(part, off)
    off += part.length
  }
  return out
}

function writePngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  putU32(out, 0, data.length)
  out[4] = type.charCodeAt(0)
  out[5] = type.charCodeAt(1)
  out[6] = type.charCodeAt(2)
  out[7] = type.charCodeAt(3)
  out.set(data, 8)
  putU32(out, 8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

interface PngChunk {
  type: string
  data: Uint8Array
  end: number
  ok: boolean
}

function walkPng(buf: Uint8Array): PngChunk[] {
  const chunks: PngChunk[] = []
  if (!isPng(buf)) return chunks
  let pos = 8
  while (pos + 12 <= buf.length) {
    const len = u32(buf, pos)
    if (pos + 12 + len > buf.length) break
    const type = String.fromCharCode(buf[pos + 4]!, buf[pos + 5]!, buf[pos + 6]!, buf[pos + 7]!)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    const crc = u32(buf, pos + 8 + len)
    const end = pos + 12 + len
    chunks.push({ type, data, end, ok: crc32(buf.subarray(pos + 4, pos + 8 + len)) === crc })
    pos = end
    if (type === 'IEND') break
  }
  return chunks
}

export function textGroveData(search: string): Uint8Array {
  const key = TEXT_ENCODER.encode(PNG_TEXT_KEY)
  const value = TEXT_ENCODER.encode(search)
  const out = new Uint8Array(key.length + 1 + value.length)
  out.set(key, 0)
  out[key.length] = 0
  out.set(value, key.length + 1)
  return out
}

export function normalizeHiddenText(raw: string): string | null {
  const text = raw.trim()
  if (text.startsWith('?')) return text
  try {
    const url = new URL(text)
    if (url.search.startsWith('?')) return url.search
  } catch {
    return null
  }
  return null
}

export function pickHiddenSearch(candidates: Array<string | null>): string | null {
  const votes = new Map<string, number>()
  const order: string[] = []
  for (const candidate of candidates) {
    if (candidate == null) continue
    const text = normalizeHiddenText(candidate)
    if (!text) continue
    if (!votes.has(text)) order.push(text)
    votes.set(text, (votes.get(text) ?? 0) + 1)
  }
  if (order.length === 0) return null
  let best = order[0]!
  let bestN = votes.get(best)!
  for (const text of order) {
    const n = votes.get(text)!
    if (n > bestN) {
      best = text
      bestN = n
    }
  }
  return best
}

export function insertPngChunksAfterIhdr(
  png: Uint8Array,
  chunks: readonly { type: string; data: Uint8Array }[],
): Uint8Array {
  if (!isPng(png) || png.length < 20) throw new Error('invalid png')
  const firstLen = u32(png, 8)
  const insertAt = 8 + 12 + firstLen
  if (insertAt > png.length) throw new Error('invalid png')
  const written = chunks.map((chunk) => writePngChunk(chunk.type, chunk.data))
  return concatBytes([png.subarray(0, insertAt), ...written, png.subarray(insertAt)])
}

export function readPngText(png: Uint8Array, key: string): string | null {
  for (const chunk of walkPng(png)) {
    if (!chunk.ok || chunk.type !== 'tEXt') continue
    const split = chunk.data.indexOf(0)
    if (split < 0) continue
    if (TEXT_DECODER.decode(chunk.data.subarray(0, split)) !== key) continue
    return TEXT_DECODER.decode(chunk.data.subarray(split + 1))
  }
  return null
}

export function readPngChunk(png: Uint8Array, type: string): Uint8Array | null {
  for (const chunk of walkPng(png)) {
    if (chunk.ok && chunk.type === type) return chunk.data
  }
  return null
}

export function appendPngTrailer(png: Uint8Array, framed: Uint8Array): Uint8Array {
  return concatBytes([png, framed])
}

export function readPngTrailer(png: Uint8Array): Uint8Array | null {
  const chunks = walkPng(png)
  const iend = chunks.find((chunk) => chunk.type === 'IEND' && chunk.ok)
  if (!iend) return null
  const rest = png.subarray(iend.end)
  if (rest.length < 10) return null
  return unframeStillPayload(rest) ? rest : null
}

function gifHeader(buf: Uint8Array): boolean {
  if (buf.length < 13) return false
  const head = String.fromCharCode(buf[0]!, buf[1]!, buf[2]!, buf[3]!, buf[4]!, buf[5]!)
  return head === 'GIF87a' || head === 'GIF89a'
}

function gctBytes(packed: number): number {
  return packed & 0x80 ? 3 * 2 ** ((packed & 7) + 1) : 0
}

function skipSubBlocks(buf: Uint8Array, start: number): number {
  let pos = start
  while (pos < buf.length) {
    const n = buf[pos]!
    pos += 1
    if (n === 0) return pos
    if (pos + n > buf.length) return buf.length
    pos += n
  }
  return pos
}

function readSubBlocks(buf: Uint8Array, start: number): { bytes: Uint8Array; next: number } {
  const parts: Uint8Array[] = []
  let pos = start
  while (pos < buf.length) {
    const n = buf[pos]!
    pos += 1
    if (n === 0) return { bytes: concatBytes(parts), next: pos }
    if (pos + n > buf.length) {
      parts.push(buf.subarray(pos))
      return { bytes: concatBytes(parts), next: buf.length }
    }
    parts.push(buf.subarray(pos, pos + n))
    pos += n
  }
  return { bytes: concatBytes(parts), next: pos }
}

export function injectGifComment(gif: Uint8Array, text: string): Uint8Array {
  if (!gifHeader(gif)) throw new Error('invalid gif')
  const insertAt = 13 + gctBytes(gif[10]!)
  const payload = TEXT_ENCODER.encode(text)
  const blocks: Uint8Array[] = [new Uint8Array([0x21, 0xfe])]
  for (let i = 0; i < payload.length; i += 255) {
    const slice = payload.subarray(i, Math.min(payload.length, i + 255))
    const block = new Uint8Array(1 + slice.length)
    block[0] = slice.length
    block.set(slice, 1)
    blocks.push(block)
  }
  blocks.push(new Uint8Array([0]))
  return concatBytes([gif.subarray(0, insertAt), ...blocks, gif.subarray(insertAt)])
}

export function readGifComments(gif: Uint8Array): string[] {
  const comments: string[] = []
  if (!gifHeader(gif)) return comments
  let pos = 13 + gctBytes(gif[10]!)
  while (pos < gif.length) {
    const marker = gif[pos]!
    if (marker === 0x3b) break
    if (marker === 0x21) {
      if (pos + 1 >= gif.length) break
      const label = gif[pos + 1]!
      if (label === 0xfe) {
        const block = readSubBlocks(gif, pos + 2)
        comments.push(TEXT_DECODER.decode(block.bytes))
        pos = block.next
        continue
      }
      pos = skipSubBlocks(gif, pos + 2)
      continue
    }
    if (marker === 0x2c) {
      if (pos + 10 > gif.length) break
      const packed = gif[pos + 9]!
      pos += 10 + gctBytes(packed)
      if (pos >= gif.length) break
      pos += 1
      pos = skipSubBlocks(gif, pos)
      continue
    }
    pos += 1
  }
  return comments
}

function decodeJpegCom(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('latin1').decode(bytes)
  }
}

export function readJpegCom(jpeg: Uint8Array): string[] {
  if (jpeg.length < 2 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return []
  const comments: string[] = []
  let pos = 2
  while (pos < jpeg.length) {
    if (jpeg[pos] !== 0xff) {
      pos += 1
      continue
    }
    while (pos < jpeg.length && jpeg[pos] === 0xff) pos += 1
    if (pos >= jpeg.length) break
    const marker = jpeg[pos]!
    pos += 1
    if (marker === 0xda || marker === 0xd9) break
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (pos + 2 > jpeg.length) break
    const len = (jpeg[pos]! << 8) | jpeg[pos + 1]!
    if (len < 2 || pos + len > jpeg.length) break
    if (marker === 0xfe) comments.push(decodeJpegCom(jpeg.subarray(pos + 2, pos + len)))
    pos += len
  }
  return comments
}

