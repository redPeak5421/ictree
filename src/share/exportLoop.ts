import { applyPalette, GIFEncoder, quantize } from 'gifenc'
import { SNAP_PITCH } from '../scene/orbit'
import { colorsOf } from '../scene/palettes'
import type { SceneRef } from '../scene/sceneState'
import { VIEW_PITCH } from '../scene/tree'
import { isOverhead, OVERHEAD } from '../scene/view'
import { injectGifComment } from './containerMeta'
import { STILL_NO_CANVAS } from './exportStill'
import { buildShareSearch, type ShareState } from './params'
import { blitSiteQr, rasterSiteQr, siteQrPayload } from './siteQr'

export const LOOP_FRAMES = 20
export const LOOP_DELAY_MS = 180
const LOOP_MAX_SIDE = 640
const LOOP_FILENAME = 'ictree-loop.gif'

const PRESERVE_CURRENT_CAMERA = Symbol('preserve-current-camera')

interface PreserveCurrentCameraAbort extends Error {
  [PRESERVE_CURRENT_CAMERA]: true
}

export function preserveCurrentCameraAbortReason(): PreserveCurrentCameraAbort {
  const reason = new Error('Loop capture was aborted after the camera changed ownership.')
  reason.name = 'AbortError'
  return Object.assign(reason, { [PRESERVE_CURRENT_CAMERA]: true as const })
}

function preservesCurrentCamera(signal?: AbortSignal): boolean {
  const reason = signal?.reason as Partial<PreserveCurrentCameraAbort> | undefined
  return signal?.aborted === true && reason?.[PRESERVE_CURRENT_CAMERA] === true
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortReason(signal)
}

function nextFrame(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal))
      return
    }
    let frame = 0
    const cleanup = () => signal?.removeEventListener('abort', onAbort)
    const onAbort = () => {
      cancelAnimationFrame(frame)
      cleanup()
      reject(abortReason(signal!))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    frame = requestAnimationFrame(() => {
      cleanup()
      resolve()
    })
  })
}

async function twoFrames(signal?: AbortSignal) {
  await nextFrame(signal)
  await nextFrame(signal)
}

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}

export function formatLoopProgress(label: string, current: number, total: number): string {
  return `${label} ${current}/${total}`
}

export async function downloadLoopGif(
  state: ShareState,
  scene: SceneRef,
  signal?: AbortSignal,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  throwIfAborted(signal)
  const search = buildShareSearch(state)
  const colors = colorsOf(state.season, state.tree)
  const site = siteQrPayload()
  const src = document.querySelector('[data-ictree-canvas]') as HTMLCanvasElement | null
  if (!src) throw new Error(STILL_NO_CANVAS)
  const cam = scene.current
  const backup = {
    yaw: cam.yaw,
    pitch: cam.pitch,
    pitchTarget: cam.pitchTarget,
    yawTarget: cam.yawTarget,
    spinYaw: cam.spinYaw,
    spinPitch: cam.spinPitch,
  }
  let cameraFinalized = false
  const finalizeCamera = () => {
    if (cameraFinalized) return
    cameraFinalized = true
    if (preservesCurrentCamera(signal)) return
    cam.yaw = backup.yaw
    cam.pitch = backup.pitch
    cam.pitchTarget = backup.pitchTarget
    cam.yawTarget = backup.yawTarget
    cam.spinYaw = backup.spinYaw
    cam.spinPitch = backup.spinPitch
  }
  const onAbort = () => finalizeCamera()
  signal?.addEventListener('abort', onAbort, { once: true })
  const frames: { data: Uint8ClampedArray; width: number; height: number }[] = []
  try {
    throwIfAborted(signal)
    const pitch =
      isOverhead(cam.pitch) || cam.pitch >= SNAP_PITCH || cam.pitchTarget === OVERHEAD ? VIEW_PITCH : cam.pitch
    cam.pitchTarget = null
    cam.yawTarget = null
    cam.spinYaw = 0
    cam.spinPitch = 0
    cam.grow = 1
    cam.growTarget = 1
    const baseYaw = cam.yaw
    const w = src.width
    const h = src.height
    const scale = Math.max(w, h) > LOOP_MAX_SIDE ? LOOP_MAX_SIDE / Math.max(w, h) : 1
    const width = Math.max(1, Math.round(w * scale))
    const height = Math.max(1, Math.round(h * scale))
    const patch = rasterSiteQr(colors, site, width, height)
    for (let i = 0; i < LOOP_FRAMES; i++) {
      throwIfAborted(signal)
      cam.yaw = baseYaw + (i / LOOP_FRAMES) * Math.PI * 2
      cam.pitch = pitch
      await twoFrames(signal)
      throwIfAborted(signal)
      const off = document.createElement('canvas')
      off.width = width
      off.height = height
      const ctx = off.getContext('2d')
      if (!ctx) throw new Error(STILL_NO_CANVAS)
      ctx.imageSmoothingEnabled = scale < 1
      ctx.drawImage(src, 0, 0, width, height)
      const image = ctx.getImageData(0, 0, width, height)
      blitSiteQr(image, patch)
      frames.push({ data: new Uint8ClampedArray(image.data), width, height })
      onProgress?.(i + 1, LOOP_FRAMES)
    }
  } finally {
    signal?.removeEventListener('abort', onAbort)
    finalizeCamera()
  }

  throwIfAborted(signal)
  const gif = GIFEncoder()
  for (let i = 0; i < frames.length; i++) {
    throwIfAborted(signal)
    const frame = frames[i]!
    const palette = quantize(frame.data, 256, { format: 'rgb565' })
    const index = applyPalette(frame.data, palette)
    gif.writeFrame(index, frame.width, frame.height, {
      palette,
      delay: LOOP_DELAY_MS,
      ...(i === 0 ? { repeat: 0 } : {}),
    })
  }
  gif.finish()
  throwIfAborted(signal)
  const bytes = injectGifComment(gif.bytes(), search)
  downloadBlob(new Blob([Uint8Array.from(bytes)], { type: 'image/gif' }), LOOP_FILENAME)
}
