export const LEAF_GATHER_DURATION_MS = 1800
export const LEAF_GATHER_FONT_FAMILY = '"Avenir Next", "Segoe UI", "Noto Sans", sans-serif'
export const LEAF_GATHER_TEXT_CENTER_X_RATIO = 0.5
export const LEAF_GATHER_TEXT_CENTER_Y_RATIO = 0.44
export const LEAF_GATHER_TEXT_MAX_WIDTH_RATIO = 0.82
export const LEAF_GATHER_TEXT_MAX_HEIGHT_RATIO = 0.5
export const LEAF_GATHER_TEXT_LINE_HEIGHT_RATIO = 1.16
export const LEAF_GATHER_TEXT_MAX_FONT_SIZE = 48
export const LEAF_GATHER_PLANT_READY_INK_MIX = 0.02
export const LEAF_GATHER_TEXT_REVEAL_PROGRESS = 0.72

export type LeafGatherVector = readonly [number, number, number]
export type LeafGatherQuaternion = readonly [number, number, number, number]

export interface LeafGatherTransform {
  position: LeafGatherVector
  quaternion: LeafGatherQuaternion
  scale: LeafGatherVector
}

export interface LeafGatherFrame {
  right: LeafGatherVector
  up: LeafGatherVector
  depth: LeafGatherVector
}

export interface LeafGatherVariation {
  delay: number
  arc: number
  depth: number
  side: number
  twist: number
  scalePulse: number
}

export interface LeafGatherPackedMotion {
  target: LeafGatherTransform
  variation: LeafGatherVariation
}

export interface LeafGatherPackedAttributes {
  count: number
  targetPosition: Float32Array
  targetQuaternion: Float32Array
  targetScale: Float32Array
  /** delay, arc, depth, side */
  motion: Float32Array
  /** twist, scalePulse */
  spin: Float32Array
}

export interface LeafGatherColorCacheInput {
  foliage: string
  foliageVar: string
  finder: string
  accent: string
  fruit: string
  inkLift: number
  pitch: number
  tree: string
  fruiting: boolean
}

export interface LeafGatherTextBounds {
  maxWidth: number
  maxHeight: number
  minFontSize: number
  maxFontSize: number
  lineHeightRatio: number
  centerX: number
  centerY: number
}

export interface LeafGatherLineBox {
  top: number
  height: number
  baseline: number
}

export type LeafGatherDirection = 'opening' | 'closing'

export interface LeafGatherStep {
  progress: number
  done: boolean
}

export interface LeafGatherEndpointState {
  direction: LeafGatherDirection
  notified: boolean
}

export interface LeafGatherEndpointTransition {
  state: LeafGatherEndpointState
  event: 'settled' | 'closed' | null
}

export interface LeafGatherTextRevealState {
  notified: boolean
}

export interface LeafGatherTextRevealTransition {
  state: LeafGatherTextRevealState
  reveal: boolean
}

/** Canvas baseline aligned to the same measured CSS line box. */
export function leafGatherLineBox(
  textTop: number,
  lineHeight: number,
  fontAscent: number,
  fontDescent: number,
  lineIndex: number,
): LeafGatherLineBox {
  if (![textTop, lineHeight, fontAscent, fontDescent, lineIndex].every(Number.isFinite)) {
    throw new RangeError('Leaf-gather line metrics must be finite.')
  }
  if (lineHeight <= 0 || fontAscent < 0 || fontDescent < 0 || !Number.isInteger(lineIndex) || lineIndex < 0) {
    throw new RangeError('Leaf-gather line metrics and index must be non-negative.')
  }
  const top = textTop + lineIndex * lineHeight
  const halfLeading = (lineHeight - fontAscent - fontDescent) / 2
  return { top, height: lineHeight, baseline: top + halfLeading + fontAscent }
}

/** Opening waits until block ink is effectively gone; closing never uses this gate. */
export function canAdvanceLeafGather(waitForPlants: boolean, inkMix: number): boolean {
  return !waitForPlants
    || (Number.isFinite(inkMix) && inkMix <= LEAF_GATHER_PLANT_READY_INK_MIX)
}

/** Every scene value used by leaf, filler, or ornament color calculation. */
export function leafGatherColorCacheKey(input: LeafGatherColorCacheInput): string {
  return [
    input.foliage,
    input.foliageVar,
    input.finder,
    input.accent,
    input.fruit,
    input.inkLift,
    input.pitch,
    input.tree,
    input.fruiting,
  ].join('|')
}

/** Rearms on reversal and emits each reached endpoint once. */
export function leafGatherEndpointTransition(
  previous: LeafGatherEndpointState,
  direction: LeafGatherDirection,
  done: boolean,
): LeafGatherEndpointTransition {
  const state = previous.direction === direction
    ? previous
    : { direction, notified: false }
  if (!done || state.notified) return { state, event: null }
  return {
    state: { direction, notified: true },
    event: direction === 'opening' ? 'settled' : 'closed',
  }
}

/** Emits once per gather lifetime when opening reaches the text-reveal threshold. */
export function leafGatherTextRevealTransition(
  previous: LeafGatherTextRevealState,
  direction: LeafGatherDirection,
  progress: number,
): LeafGatherTextRevealTransition {
  if (
    previous.notified
    || direction === 'closing'
    || !Number.isFinite(progress)
    || progress < LEAF_GATHER_TEXT_REVEAL_PROGRESS
  ) {
    return { state: previous, reveal: false }
  }
  return { state: { notified: true }, reveal: true }
}

/** Packs one fixed-width row per rendered instance for GPU instancing. */
export function packLeafGatherAttributes(
  motions: readonly LeafGatherPackedMotion[],
): LeafGatherPackedAttributes {
  const count = motions.length
  const targetPosition = new Float32Array(count * 3)
  const targetQuaternion = new Float32Array(count * 4)
  const targetScale = new Float32Array(count * 3)
  const motion = new Float32Array(count * 4)
  const spin = new Float32Array(count * 2)
  motions.forEach(({ target, variation }, index) => {
    targetPosition.set(target.position, index * 3)
    targetQuaternion.set(target.quaternion, index * 4)
    targetScale.set(target.scale, index * 3)
    motion.set([variation.delay, variation.arc, variation.depth, variation.side], index * 4)
    spin.set([variation.twist, variation.scalePulse], index * 2)
  })
  return { count, targetPosition, targetQuaternion, targetScale, motion, spin }
}

const TARGET_FONT_DIAMETER_RATIO = 0.08
const MIN_TARGET_PIXEL_DIAMETER = 0.35
const MAX_TARGET_PIXEL_DIAMETER = 7.5

/** Glyph-space diameter for one settled leaf, before pixels become world units. */
export function leafGatherTargetPixelSize(
  fontSize: number,
  activePixelCount: number,
  sourceCount: number,
): number {
  if (![fontSize, activePixelCount, sourceCount].every(Number.isFinite)) {
    throw new RangeError('Leaf-gather target sizing requires finite values.')
  }
  if (fontSize <= 0 || activePixelCount < 0 || sourceCount < 0) {
    throw new RangeError('Leaf-gather target sizing requires a positive font and non-negative counts.')
  }
  const fontDiameter = Math.min(
    MAX_TARGET_PIXEL_DIAMETER,
    Math.max(0.5, fontSize * TARGET_FONT_DIAMETER_RATIO),
  )
  const density = sourceCount > activePixelCount && sourceCount > 0
    ? Math.sqrt(activePixelCount / sourceCount)
    : 1
  return Math.max(MIN_TARGET_PIXEL_DIAMETER, fontDiameter * density)
}

function mixSeed(index: number, seed: number): number {
  let value = (seed >>> 0) ^ Math.imul((index | 0) + 1, 0x9e3779b1)
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad)
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97)
  return (value ^ (value >>> 15)) >>> 0
}

function nextRandom(state: { value: number }): number {
  state.value = (state.value + 0x6d2b79f5) | 0
  let value = Math.imul(state.value ^ (state.value >>> 15), 1 | state.value)
  value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

/** Stable motion character for one rendered instance. */
export function leafGatherVariation(index: number, seed: number): LeafGatherVariation {
  const state = { value: mixSeed(index, seed) }
  return {
    delay: nextRandom(state) * 0.16,
    arc: 1.2 + nextRandom(state) * 1.8,
    depth: (nextRandom(state) - 0.5) * 2.2,
    side: (nextRandom(state) - 0.5) * 2.6,
    twist: (nextRandom(state) - 0.5) * Math.PI * 3,
    scalePulse: (nextRandom(state) - 0.5) * 0.24,
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function smoothstep(value: number): number {
  const clamped = clamp01(value)
  return clamped * clamped * (3 - 2 * clamped)
}

function normalized(vector: LeafGatherVector): LeafGatherVector {
  const length = Math.hypot(vector[0], vector[1], vector[2])
  if (length <= Number.EPSILON) return [0, 1, 0]
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

function normalizedQuaternion(quaternion: LeafGatherQuaternion): LeafGatherQuaternion {
  const length = Math.hypot(quaternion[0], quaternion[1], quaternion[2], quaternion[3])
  if (length <= Number.EPSILON) return [0, 0, 0, 1]
  return [
    quaternion[0] / length,
    quaternion[1] / length,
    quaternion[2] / length,
    quaternion[3] / length,
  ]
}

function slerp(
  fromValue: LeafGatherQuaternion,
  toValue: LeafGatherQuaternion,
  progress: number,
): LeafGatherQuaternion {
  const from = normalizedQuaternion(fromValue)
  let to = normalizedQuaternion(toValue)
  let cosine = from[0] * to[0] + from[1] * to[1] + from[2] * to[2] + from[3] * to[3]
  if (cosine < 0) {
    cosine = -cosine
    to = [-to[0], -to[1], -to[2], -to[3]]
  }
  if (cosine > 0.9995) {
    return normalizedQuaternion([
      from[0] + (to[0] - from[0]) * progress,
      from[1] + (to[1] - from[1]) * progress,
      from[2] + (to[2] - from[2]) * progress,
      from[3] + (to[3] - from[3]) * progress,
    ])
  }
  const angle = Math.acos(Math.max(-1, Math.min(1, cosine)))
  const sine = Math.sin(angle)
  const fromWeight = Math.sin((1 - progress) * angle) / sine
  const toWeight = Math.sin(progress * angle) / sine
  return [
    from[0] * fromWeight + to[0] * toWeight,
    from[1] * fromWeight + to[1] * toWeight,
    from[2] * fromWeight + to[2] * toWeight,
    from[3] * fromWeight + to[3] * toWeight,
  ]
}

function axisAngle(axisValue: LeafGatherVector, angle: number): LeafGatherQuaternion {
  const axis = normalized(axisValue)
  const half = angle / 2
  const sine = Math.sin(half)
  return [axis[0] * sine, axis[1] * sine, axis[2] * sine, Math.cos(half)]
}

function multiplyQuaternion(
  left: LeafGatherQuaternion,
  right: LeafGatherQuaternion,
): LeafGatherQuaternion {
  return normalizedQuaternion([
    left[3] * right[0] + left[0] * right[3] + left[1] * right[2] - left[2] * right[1],
    left[3] * right[1] - left[0] * right[2] + left[1] * right[3] + left[2] * right[0],
    left[3] * right[2] + left[0] * right[1] - left[1] * right[0] + left[2] * right[3],
    left[3] * right[3] - left[0] * right[0] - left[1] * right[1] - left[2] * right[2],
  ])
}

export function leafGatherPose(
  source: LeafGatherTransform,
  target: LeafGatherTransform,
  progress: number,
  variation: LeafGatherVariation,
  frame: LeafGatherFrame,
): LeafGatherTransform {
  const clamped = clamp01(progress)
  if (clamped === 0) return source
  if (clamped === 1) return target

  const local = clamp01((clamped - variation.delay) / (1 - variation.delay))
  if (local === 0) return source
  const eased = smoothstep(local)
  const flight = Math.sin(Math.PI * local)
  const position = [0, 1, 2].map((axis) => {
    const direct = source.position[axis]! + (target.position[axis]! - source.position[axis]!) * eased
    return direct
      + frame.up[axis]! * variation.arc * flight
      + frame.depth[axis]! * variation.depth * flight
      + frame.right[axis]! * variation.side * flight
  }) as [number, number, number]
  const baseQuaternion = slerp(source.quaternion, target.quaternion, eased)
  const rotationAxis: LeafGatherVector = [
    frame.up[0] + frame.depth[0] * 0.35 + frame.right[0] * 0.2,
    frame.up[1] + frame.depth[1] * 0.35 + frame.right[1] * 0.2,
    frame.up[2] + frame.depth[2] * 0.35 + frame.right[2] * 0.2,
  ]
  const quaternion = multiplyQuaternion(
    baseQuaternion,
    axisAngle(rotationAxis, variation.twist * flight),
  )
  const pulse = 1 + variation.scalePulse * flight
  const scale = [0, 1, 2].map((axis) => (
    source.scale[axis]! + (target.scale[axis]! - source.scale[axis]!) * eased
  ) * pulse) as [number, number, number]
  return { position, quaternion, scale }
}

/** CPU reference for the exact attribute layout consumed by the vertex shader. */
export function leafGatherShaderReferencePose(
  source: LeafGatherTransform,
  packed: LeafGatherPackedAttributes,
  index: number,
  progress: number,
  frame: LeafGatherFrame,
): LeafGatherTransform {
  if (!Number.isInteger(index) || index < 0 || index >= packed.count) {
    throw new RangeError('Leaf-gather packed attribute index is out of range.')
  }
  const positionOffset = index * 3
  const quaternionOffset = index * 4
  const motionOffset = index * 4
  const spinOffset = index * 2
  const target: LeafGatherTransform = {
    position: [
      packed.targetPosition[positionOffset]!,
      packed.targetPosition[positionOffset + 1]!,
      packed.targetPosition[positionOffset + 2]!,
    ],
    quaternion: [
      packed.targetQuaternion[quaternionOffset]!,
      packed.targetQuaternion[quaternionOffset + 1]!,
      packed.targetQuaternion[quaternionOffset + 2]!,
      packed.targetQuaternion[quaternionOffset + 3]!,
    ],
    scale: [
      packed.targetScale[positionOffset]!,
      packed.targetScale[positionOffset + 1]!,
      packed.targetScale[positionOffset + 2]!,
    ],
  }
  const variation: LeafGatherVariation = {
    delay: packed.motion[motionOffset]!,
    arc: packed.motion[motionOffset + 1]!,
    depth: packed.motion[motionOffset + 2]!,
    side: packed.motion[motionOffset + 3]!,
    twist: packed.spin[spinOffset]!,
    scalePulse: packed.spin[spinOffset + 1]!,
  }
  return leafGatherPose(source, target, progress, variation, frame)
}

export function stepLeafGatherProgress(
  progress: number,
  deltaSeconds: number,
  direction: LeafGatherDirection,
  reduced: boolean,
): LeafGatherStep {
  const endpoint = direction === 'opening' ? 1 : 0
  if (reduced) return { progress: endpoint, done: true }
  const delta = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0)
    / (LEAF_GATHER_DURATION_MS / 1000)
  const next = clamp01(clamp01(progress) + (direction === 'opening' ? delta : -delta))
  return { progress: next, done: next === endpoint }
}

export function leafGatherTextBounds(stageWidth: number, stageHeight: number): LeafGatherTextBounds {
  if (![stageWidth, stageHeight].every(Number.isFinite) || stageWidth <= 0 || stageHeight <= 0) {
    throw new RangeError('Leaf-gather stage dimensions must be positive and finite.')
  }
  const minimumStage = Math.min(stageWidth, stageHeight)
  const minFontSize = Math.min(
    LEAF_GATHER_TEXT_MAX_FONT_SIZE,
    Math.max(7, minimumStage * 0.016),
  )
  return {
    maxWidth: stageWidth * LEAF_GATHER_TEXT_MAX_WIDTH_RATIO,
    maxHeight: stageHeight * LEAF_GATHER_TEXT_MAX_HEIGHT_RATIO,
    minFontSize,
    maxFontSize: Math.min(
      LEAF_GATHER_TEXT_MAX_FONT_SIZE,
      Math.max(minFontSize, Math.min(stageWidth * 0.105, stageHeight * 0.115)),
    ),
    lineHeightRatio: LEAF_GATHER_TEXT_LINE_HEIGHT_RATIO,
    centerX: stageWidth * LEAF_GATHER_TEXT_CENTER_X_RATIO,
    centerY: stageHeight * LEAF_GATHER_TEXT_CENTER_Y_RATIO,
  }
}

/** Text-aware bounds that preserve the preferred floor unless explicit lines require less. */
export function leafGatherTextBoundsFor(
  text: string,
  stageWidth: number,
  stageHeight: number,
): LeafGatherTextBounds {
  const bounds = leafGatherTextBounds(stageWidth, stageHeight)
  const explicitLineCount = (text.match(/\r\n|\r|\n/g)?.length ?? 0) + 1
  const heightLimitedMinimum = bounds.maxHeight
    / (explicitLineCount * bounds.lineHeightRatio)
    * (1 - 1e-9)
  return {
    ...bounds,
    minFontSize: Math.min(bounds.minFontSize, heightLimitedMinimum),
  }
}
