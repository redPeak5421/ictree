import type { Season } from '../scene/palettes'

interface Nodes {
  ctx: AudioContext
  master: GainNode
  spring: GainNode
  summer: GainNode
  autumn: GainNode
}

let nodes: Nodes | null = null
let season: Season = 'autumn'

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * 2
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

function connectNoise(ctx: AudioContext, dest: AudioNode, type: BiquadFilterType, freq: number, q: number) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  src.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  filter.Q.value = q
  src.connect(filter)
  filter.connect(dest)
  src.start()
}

function connectTone(ctx: AudioContext, dest: AudioNode, freq: number, type: OscillatorType) {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.value = freq
  const gain = ctx.createGain()
  gain.gain.value = 0.12
  osc.connect(gain)
  gain.connect(dest)
  osc.start()
}

function ensure(): Nodes {
  if (nodes) return nodes
  const ctx = new AudioContext()
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  const spring = ctx.createGain()
  const summer = ctx.createGain()
  const autumn = ctx.createGain()
  spring.gain.value = 0
  summer.gain.value = 0
  autumn.gain.value = 0
  spring.connect(master)
  summer.connect(master)
  autumn.connect(master)

  connectNoise(ctx, spring, 'highpass', 1200, 0.7)
  connectTone(ctx, spring, 392, 'sine')
  connectNoise(ctx, summer, 'lowpass', 400, 0.5)
  connectTone(ctx, summer, 174, 'triangle')
  connectNoise(ctx, autumn, 'bandpass', 1800, 0.9)

  nodes = { ctx, master, spring, summer, autumn }
  applySeason(0.01)
  return nodes
}

function applySeason(timeConstant: number) {
  if (!nodes) return
  const t = nodes.ctx.currentTime
  nodes.spring.gain.setTargetAtTime(season === 'spring' ? 1 : 0, t, timeConstant)
  nodes.summer.gain.setTargetAtTime(season === 'summer' ? 1 : 0, t, timeConstant)
  nodes.autumn.gain.setTargetAtTime(season === 'autumn' ? 1 : 0, t, timeConstant)
}

export function setAmbienceMuted(next: boolean) {
  if (!next) {
    const graph = ensure()
    void graph.ctx.resume()
  }
  if (!nodes) return
  nodes.master.gain.setTargetAtTime(next ? 0 : 0.16, nodes.ctx.currentTime, 0.08)
}

export function setAmbienceSeason(next: Season) {
  season = next
  applySeason(0.12)
}

