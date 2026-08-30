import type { Season } from '../scene/palettes'

export interface AmbienceMix {
  spring: number
  summer: number
  autumn: number
  rain: number
}

export const AMBIENCE_CLIPS = {
  spring: '/audio/spring.mp3',
  summer: '/audio/summer.mp3',
  autumn: '/audio/autumn.mp3',
  rain: '/audio/rain.mp3',
} as const

/**
 * One seasonal bed plus an optional rain layer. Rain ducks the season so
 * weather reads as weather, not a second landscape.
 */
export function ambienceMix(season: Season, raining: boolean): AmbienceMix {
  const duck = raining ? 0.32 : 1
  return {
    spring: season === 'spring' ? duck : 0,
    summer: season === 'summer' ? duck : 0,
    autumn: season === 'autumn' ? duck : 0,
    rain: raining ? 1 : 0,
  }
}

interface Nodes {
  ctx: AudioContext
  master: GainNode
  spring: GainNode
  summer: GainNode
  autumn: GainNode
  rain: GainNode
}

let nodes: Nodes | null = null
let season: Season = 'autumn'
let raining = false
let load: Promise<void> | null = null

/** Crossfade the tail into the head so a field recording can loop. */
export function crossfadeLoop(src: Float32Array, fade: number): Float32Array {
  const length = src.length - fade
  const dst = new Float32Array(length)
  dst.set(src.subarray(0, length))
  for (let i = 0; i < fade; i++) {
    const t = i / fade
    dst[i] = src[i]! * t + src[src.length - fade + i]! * (1 - t)
  }
  return dst
}

function makeLoopable(buffer: AudioBuffer, fadeSeconds = 1.4): AudioBuffer {
  const fade = Math.min(Math.floor(fadeSeconds * buffer.sampleRate), Math.floor(buffer.length / 3))
  const length = buffer.length - fade
  const out = new AudioBuffer({
    length,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  })
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    out.getChannelData(channel).set(crossfadeLoop(buffer.getChannelData(channel), fade))
  }
  return out
}

async function decodeClip(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load ${url}`)
  const data = await response.arrayBuffer()
  return ctx.decodeAudioData(data.slice(0))
}

function applyMix(timeConstant: number) {
  if (!nodes) return
  const mix = ambienceMix(season, raining)
  const t = nodes.ctx.currentTime
  nodes.spring.gain.setTargetAtTime(mix.spring, t, timeConstant)
  nodes.summer.gain.setTargetAtTime(mix.summer * 0.82, t, timeConstant)
  nodes.autumn.gain.setTargetAtTime(mix.autumn, t, timeConstant)
  nodes.rain.gain.setTargetAtTime(mix.rain, t, timeConstant)
}

async function ensure(): Promise<Nodes> {
  if (nodes) return nodes
  const ctx = new AudioContext()
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  const spring = ctx.createGain()
  const summer = ctx.createGain()
  const autumn = ctx.createGain()
  const rain = ctx.createGain()
  for (const bed of [spring, summer, autumn, rain]) {
    bed.gain.value = 0
    bed.connect(master)
  }

  nodes = { ctx, master, spring, summer, autumn, rain }
  applyMix(0.01)

  load ??= (async () => {
    const graph = nodes
    if (!graph) return
    const [springBuf, summerBuf, autumnBuf, rainBuf] = await Promise.all([
      decodeClip(graph.ctx, AMBIENCE_CLIPS.spring),
      decodeClip(graph.ctx, AMBIENCE_CLIPS.summer),
      decodeClip(graph.ctx, AMBIENCE_CLIPS.autumn),
      decodeClip(graph.ctx, AMBIENCE_CLIPS.rain),
    ])
    const start = (buffer: AudioBuffer, dest: AudioNode) => {
      const source = graph.ctx.createBufferSource()
      source.buffer = makeLoopable(buffer)
      source.loop = true
      source.connect(dest)
      source.start()
    }
    start(springBuf, graph.spring)
    start(summerBuf, graph.summer)
    start(autumnBuf, graph.autumn)
    start(rainBuf, graph.rain)
  })()

  await load
  return nodes
}

export function setAmbienceMuted(next: boolean) {
  if (!next) {
    void ensure().then((graph) => {
      void graph.ctx.resume()
      graph.master.gain.setTargetAtTime(0.26, graph.ctx.currentTime, 0.1)
    })
    return
  }
  if (!nodes) return
  nodes.master.gain.setTargetAtTime(0, nodes.ctx.currentTime, 0.08)
}

export function setAmbienceSeason(next: Season) {
  season = next
  applyMix(0.16)
}

export function setAmbienceRain(next: boolean) {
  raining = next
  applyMix(0.2)
}
