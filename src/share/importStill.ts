import { parseShareParams, type ShareState } from './params'
import {
  pickHiddenSearch,
  PNG_CHUNK_TYPE,
  PNG_TEXT_KEY,
  readGifComments,
  readJpegCom,
  readPngChunk,
  readPngText,
  readPngTrailer,
} from './containerMeta'
import { unframeStillPayload } from './stillEncode'

export const STILL_ERROR = 'This image is not a grove still.'
export const STILL_MAX_FILE = 12 * 1024 * 1024

export async function readStillFile(file: File): Promise<ShareState> {
  if (file.size === 0 || file.size > STILL_MAX_FILE) throw new Error(STILL_ERROR)
  const buf = new Uint8Array(await file.arrayBuffer())
  const candidates: Array<string | null> = []
  candidates.push(readPngText(buf, PNG_TEXT_KEY))
  const grove = readPngChunk(buf, PNG_CHUNK_TYPE)
  candidates.push(grove ? unframeStillPayload(grove) : null)
  const trailer = readPngTrailer(buf)
  candidates.push(trailer ? unframeStillPayload(trailer) : null)
  for (const comment of readGifComments(buf)) candidates.push(comment)
  for (const comment of readJpegCom(buf)) candidates.push(comment)
  const winner = pickHiddenSearch(candidates)
  if (!winner) throw new Error(STILL_ERROR)
  return parseShareParams(winner)
}
