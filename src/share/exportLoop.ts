import { applyPalette, GIFEncoder, quantize } from 'gifenc'
import { SNAP_PITCH } from '../scene/orbit'
import type { SceneRef } from '../scene/sceneState'
import { VIEW_PITCH } from '../scene/tree'
import { isOverhead, OVERHEAD } from '../scene/view'
import { injectGifComment } from './containerMeta'
import { STILL_NO_CANVAS } from './exportStill'
import { buildShareSearch, type ShareState } from './params'

export const LOOP_FRAMES = 20
export const LOOP_DELAY_MS = 180
export const LOOP_MAX_SIDE = 640
export const LOOP_FILENAME = 'grove-loop.gif'

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

async function twoFrames() {
  await nextFrame()
  await nextFrame()
}

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}

export async function downloadLoopGif(state: ShareState, scene: SceneRef): Promise<void> {
  const search = buildShareSearch(state)
  const src = document.querySelector('[data-grove-canvas]') as HTMLCanvasElement | null
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
  const pitch =
    isOverhead(cam.pitch) || cam.pitch >= SNAP_PITCH || cam.pitchTarget === OVERHEAD ? VIEW_PITCH : cam.pitch
  cam.pitchTarget = null
  cam.yawTarget = null
  cam.spinYaw = 0
  cam.spinPitch = 0
  const frames: { data: Uint8ClampedArray; width: number; height: number }[] = []
  try {
    const baseYaw = cam.yaw
    for (let i = 0; i < LOOP_FRAMES; i++) {
      cam.yaw = baseYaw + (i / LOOP_FRAMES) * Math.PI * 2
      cam.pitch = pitch === OVERHEAD ? VIEW_PITCH : pitch
      await twoFrames()
      const w = src.width
      const h = src.height
      const scale = Math.max(w, h) > LOOP_MAX_SIDE ? LOOP_MAX_SIDE / Math.max(w, h) : 1
      const width = Math.max(1, Math.round(w * scale))
      const height = Math.max(1, Math.round(h * scale))
      const off = document.createElement('canvas')
      off.width = width
      off.height = height
      const ctx = off.getContext('2d')
      if (!ctx) throw new Error(STILL_NO_CANVAS)
      ctx.imageSmoothingEnabled = scale < 1
      ctx.drawImage(src, 0, 0, width, height)
      const image = ctx.getImageData(0, 0, width, height)
      frames.push({ data: new Uint8ClampedArray(image.data), width, height })
    }
  } finally {
    cam.yaw = backup.yaw
    cam.pitch = backup.pitch
    cam.pitchTarget = backup.pitchTarget
    cam.yawTarget = backup.yawTarget
    cam.spinYaw = backup.spinYaw
    cam.spinPitch = backup.spinPitch
  }

  const gif = GIFEncoder()
  for (let i = 0; i < frames.length; i++) {
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
  const bytes = injectGifComment(gif.bytes(), search)
  downloadBlob(new Blob([Uint8Array.from(bytes)], { type: 'image/gif' }), LOOP_FILENAME)
}
