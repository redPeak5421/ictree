export const STILL_MAGIC = new Uint8Array([0x47, 0x52, 0x56, 0x31])

const CRC_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[i] = c
}

const MAX_PAYLOAD = 4096

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function assertSearch(search: string): Uint8Array {
  if (!search.startsWith('?')) throw new Error('invalid still payload')
  const body = new TextEncoder().encode(search)
  if (body.length === 0 || body.length > MAX_PAYLOAD) throw new Error('invalid still payload')
  return body
}

export function frameStillPayload(search: string): Uint8Array {
  const body = assertSearch(search)
  const out = new Uint8Array(6 + body.length + 4)
  out.set(STILL_MAGIC, 0)
  out[4] = (body.length >> 8) & 0xff
  out[5] = body.length & 0xff
  out.set(body, 6)
  const crc = crc32(out.subarray(0, 6 + body.length))
  out[6 + body.length] = (crc >>> 24) & 0xff
  out[7 + body.length] = (crc >>> 16) & 0xff
  out[8 + body.length] = (crc >>> 8) & 0xff
  out[9 + body.length] = crc & 0xff
  return out
}

export function unframeStillPayload(framed: Uint8Array): string | null {
  if (framed.length < 10) return null
  if (
    framed[0] !== STILL_MAGIC[0] ||
    framed[1] !== STILL_MAGIC[1] ||
    framed[2] !== STILL_MAGIC[2] ||
    framed[3] !== STILL_MAGIC[3]
  ) {
    return null
  }
  const n = ((framed[4]! << 8) | framed[5]!) >>> 0
  if (n === 0 || n > MAX_PAYLOAD || framed.length < 6 + n + 4) return null
  const crcOff = 6 + n
  const expect =
    ((framed[crcOff]! << 24) | (framed[crcOff + 1]! << 16) | (framed[crcOff + 2]! << 8) | framed[crcOff + 3]!) >>> 0
  if (crc32(framed.subarray(0, crcOff)) !== expect) return null
  const text = new TextDecoder().decode(framed.subarray(6, crcOff))
  return text.startsWith('?') ? text : null
}
