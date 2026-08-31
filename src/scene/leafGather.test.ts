import { describe, expect, it } from 'vitest'
import { layoutLeafText } from './leafReveal'
import {
  LEAF_GATHER_DURATION_MS,
  LEAF_GATHER_PLANT_READY_INK_MIX,
  LEAF_GATHER_TEXT_REVEAL_PROGRESS,
  canAdvanceLeafGather,
  leafGatherColorCacheKey,
  leafGatherShaderReferencePose,
  leafGatherEndpointTransition,
  leafGatherPose,
  leafGatherLineBox,
  leafGatherTextRevealTransition,
  leafGatherTargetPixelSize,
  leafGatherTextBounds,
  leafGatherTextBoundsFor,
  leafGatherVariation,
  packLeafGatherAttributes,
  stepLeafGatherProgress,
  type LeafGatherFrame,
  type LeafGatherEndpointState,
  type LeafGatherPackedMotion,
  type LeafGatherTransform,
  type LeafGatherTextRevealState,
} from './leafGather'

const source: LeafGatherTransform = {
  position: [2, 3, 4],
  quaternion: [0, 0, 0, 1],
  scale: [1.2, 1.2, 1.2],
}

const target: LeafGatherTransform = {
  position: [-5, 7, 1],
  quaternion: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
  scale: [0.8, 0.8, 0.8],
}

const frame: LeafGatherFrame = {
  right: [1, 0, 0],
  up: [0, 0, 1],
  depth: [0, 1, 0],
}

describe('leafGatherPose', () => {
  it('returns the exact source and target transforms at the endpoints', () => {
    const variation = leafGatherVariation(4, 731)

    expect(leafGatherPose(source, target, 0, variation, frame)).toEqual(source)
    expect(leafGatherPose(source, target, 1, variation, frame)).toEqual(target)
    expect(leafGatherPose(source, target, -1, variation, frame)).toEqual(source)
    expect(leafGatherPose(source, target, 2, variation, frame)).toEqual(target)
  })

  it('gives different leaves deterministic, non-central paths in camera coordinates', () => {
    const firstVariation = leafGatherVariation(2, 991)
    const secondVariation = leafGatherVariation(3, 991)
    const first = leafGatherPose(source, target, 0.55, firstVariation, frame)
    const again = leafGatherPose(source, target, 0.55, firstVariation, frame)
    const second = leafGatherPose(source, target, 0.55, secondVariation, frame)
    const straight = source.position.map((value, index) => value + (target.position[index]! - value) * 0.5)

    expect(first).toEqual(again)
    expect(first.position).not.toEqual(second.position)
    expect(first.quaternion).not.toEqual(second.quaternion)
    expect(first.position[2]).toBeGreaterThan(straight[2]!)
    expect(first.position).not.toEqual(straight)
  })
})

describe('stepLeafGatherProgress', () => {
  it('moves monotonically and clamps at both directional endpoints', () => {
    const quarterSecond = LEAF_GATHER_DURATION_MS / 4000
    const opening = stepLeafGatherProgress(0.25, quarterSecond, 'opening', false)
    const closing = stepLeafGatherProgress(0.75, quarterSecond, 'closing', false)

    expect(opening.progress).toBeCloseTo(0.5)
    expect(opening.progress).toBeGreaterThan(0.25)
    expect(opening.done).toBe(false)
    expect(closing.progress).toBeCloseTo(0.5)
    expect(closing.progress).toBeLessThan(0.75)
    expect(closing.done).toBe(false)
    expect(stepLeafGatherProgress(0.98, 99, 'opening', false)).toEqual({ progress: 1, done: true })
    expect(stepLeafGatherProgress(0.02, 99, 'closing', false)).toEqual({ progress: 0, done: true })
  })

  it('jumps directly to the requested endpoint for reduced motion', () => {
    expect(stepLeafGatherProgress(0.2, 0, 'opening', true)).toEqual({ progress: 1, done: true })
    expect(stepLeafGatherProgress(0.8, 0, 'closing', true)).toEqual({ progress: 0, done: true })
  })
})

describe('leafGatherEndpointTransition', () => {
  it('emits each directional endpoint once and rearms after reversal', () => {
    let state: LeafGatherEndpointState = { direction: 'opening', notified: false }

    let transition = leafGatherEndpointTransition(state, 'opening', false)
    expect(transition.event).toBeNull()
    transition = leafGatherEndpointTransition(transition.state, 'opening', true)
    expect(transition.event).toBe('settled')
    transition = leafGatherEndpointTransition(transition.state, 'opening', true)
    expect(transition.event).toBeNull()
    transition = leafGatherEndpointTransition(transition.state, 'closing', false)
    expect(transition.event).toBeNull()
    transition = leafGatherEndpointTransition(transition.state, 'closing', true)
    expect(transition.event).toBe('closed')
    transition = leafGatherEndpointTransition(transition.state, 'closing', true)
    expect(transition.event).toBeNull()
    state = transition.state
    expect(state).toEqual({ direction: 'closing', notified: true })
  })
})

describe('leafGatherTextRevealTransition', () => {
  it('emits when opening first reaches the reveal threshold after held progress', () => {
    let state: LeafGatherTextRevealState = { notified: false }

    let transition = leafGatherTextRevealTransition(state, 'opening', 0)
    expect(transition.reveal).toBe(false)
    transition = leafGatherTextRevealTransition(
      transition.state,
      'opening',
      LEAF_GATHER_TEXT_REVEAL_PROGRESS - 0.001,
    )
    expect(transition.reveal).toBe(false)
    transition = leafGatherTextRevealTransition(
      transition.state,
      'opening',
      LEAF_GATHER_TEXT_REVEAL_PROGRESS,
    )
    expect(transition.reveal).toBe(true)
    state = transition.state
    expect(state).toEqual({ notified: true })
  })

  it('suppresses reveal while closing even above the threshold', () => {
    const transition = leafGatherTextRevealTransition({ notified: false }, 'closing', 1)

    expect(transition).toEqual({ state: { notified: false }, reveal: false })
  })

  it('emits exactly once when reduced motion jumps past the threshold', () => {
    let transition = leafGatherTextRevealTransition({ notified: false }, 'opening', 1)
    expect(transition.reveal).toBe(true)

    transition = leafGatherTextRevealTransition(transition.state, 'opening', 1)
    expect(transition.reveal).toBe(false)
    transition = leafGatherTextRevealTransition(transition.state, 'closing', 0)
    expect(transition.reveal).toBe(false)
  })
})

describe('leafGatherColorCacheKey', () => {
  it('changes when pitch is the only changed color input', () => {
    const input = {
      foliage: '#246824',
      foliageVar: '#58a84a',
      finder: '#184818',
      accent: '#d98698',
      fruit: '#d8342a',
      inkLift: 0.03,
      pitch: 0.72,
      tree: 'cherry',
      fruiting: false,
    } as const

    expect(leafGatherColorCacheKey(input)).toBe(leafGatherColorCacheKey({ ...input }))
    expect(leafGatherColorCacheKey({ ...input, pitch: 0.721 })).not.toBe(
      leafGatherColorCacheKey(input),
    )
  })
})

describe('leafGatherTextBounds', () => {
  it('scales the text box and center with the CSS stage dimensions', () => {
    const small = leafGatherTextBounds(400, 300)
    const large = leafGatherTextBounds(800, 600)

    expect(large.maxWidth).toBeCloseTo(small.maxWidth * 2)
    expect(large.maxHeight).toBeCloseTo(small.maxHeight * 2)
    expect(large.centerX).toBeCloseTo(small.centerX * 2)
    expect(large.centerY).toBeCloseTo(small.centerY * 2)
    expect(large.maxWidth).toBeCloseTo(800 * 0.82)
    expect(large.maxHeight).toBeCloseTo(600 * 0.5)
    expect(large.centerY).toBeCloseTo(600 * 0.44)
  })

  it('lowers only the minimum needed to preserve hundreds of explicit lines', () => {
    const text = Array.from({ length: 200 }, (_, index) => String(index % 10)).join('\n')
    const preferred = leafGatherTextBounds(800, 600)
    const bounds = leafGatherTextBoundsFor(text, 800, 600)
    const layout = layoutLeafText(
      text,
      bounds,
      (value, fontSize) => Array.from(value).length * fontSize * 0.5,
    )

    expect(bounds.minFontSize).toBeLessThan(preferred.minFontSize)
    expect(layout.lines).toHaveLength(200)
    expect(layout.height).toBeLessThanOrEqual(bounds.maxHeight)
    expect(layout.lines.join('\n')).toBe(text)
  })

  it('retains the preferred minimum font floor for ordinary text', () => {
    expect(leafGatherTextBoundsFor('Grove reveal', 800, 600).minFontSize).toBe(
      leafGatherTextBounds(800, 600).minFontSize,
    )
  })

  it('keeps an ordinary URL on one restrained line at a 1024 by 640 stage', () => {
    const bounds = leafGatherTextBoundsFor('https://www.example.com/', 1024, 640)
    const layout = layoutLeafText(
      'https://www.example.com/',
      bounds,
      (value, fontSize) => Array.from(value).length * fontSize * 0.55,
    )

    expect(layout.lines).toEqual(['https://www.example.com/'])
    expect(layout.fontSize).toBeLessThanOrEqual(48)
  })

  it('caps reveal text at 48 CSS pixels even on a large stage', () => {
    expect(leafGatherTextBounds(2560, 1600).maxFontSize).toBe(48)
  })

  it('continues to scale the maximum font proportionally below the cap', () => {
    const compact = leafGatherTextBounds(240, 160)
    const doubled = leafGatherTextBounds(480, 320)

    expect(compact.maxFontSize).toBeLessThan(48)
    expect(doubled.maxFontSize).toBeCloseTo(compact.maxFontSize * 2)
  })
})

describe('leafGatherLineBox', () => {
  it('places the alphabetic baseline after half-leading and measured ascent', () => {
    expect(leafGatherLineBox(100, 30, 18, 6, 2)).toEqual({
      top: 160,
      height: 30,
      baseline: 181,
    })
  })
})

describe('canAdvanceLeafGather', () => {
  it('waits for the fully restored plant layer only when requested', () => {
    expect(canAdvanceLeafGather(false, 1)).toBe(true)
    expect(canAdvanceLeafGather(true, LEAF_GATHER_PLANT_READY_INK_MIX)).toBe(true)
    expect(canAdvanceLeafGather(true, LEAF_GATHER_PLANT_READY_INK_MIX + 0.001)).toBe(false)
  })
})

describe('leafGatherTargetPixelSize', () => {
  it('keeps leaves inside the stroke of a small glyph', () => {
    const diameter = leafGatherTargetPixelSize(8, 240, 160)

    expect(diameter).toBeGreaterThanOrEqual(0.5)
    expect(diameter).toBeLessThanOrEqual(0.8)
    expect(leafGatherTargetPixelSize(8, 240, 160)).toBe(diameter)
  })

  it('shrinks crowded leaves when sources outnumber active glyph pixels', () => {
    const uncrowded = leafGatherTargetPixelSize(64, 4_000, 2_000)
    const crowded = leafGatherTargetPixelSize(64, 400, 4_000)

    expect(uncrowded).toBeLessThanOrEqual(64 * 0.08)
    expect(crowded).toBeLessThan(uncrowded * 0.5)
    expect(crowded).toBeGreaterThanOrEqual(0.35)
  })
})

const packedMotions: LeafGatherPackedMotion[] = [
  {
    target: {
      position: [8, 4, 2],
      quaternion: [0, 0, 0, 1],
      scale: [0.5, 0.75, 1],
    },
    variation: { delay: 0.125, arc: 2, depth: -0.5, side: 0.75, twist: 1.5, scalePulse: -0.25 },
  },
  {
    target: {
      position: [-6, 10, 12],
      quaternion: [0, 1, 0, 0],
      scale: [1.25, 1.5, 1],
    },
    variation: { delay: 0.25, arc: 3, depth: 0.5, side: -1.25, twist: -2, scalePulse: 0.125 },
  },
  {
    target: {
      position: [14, -8, 16],
      quaternion: [1, 0, 0, 0],
      scale: [1.75, 2, 1],
    },
    variation: { delay: 0.375, arc: 4, depth: 1.5, side: 2.25, twist: 2.5, scalePulse: 0.25 },
  },
]

describe('packLeafGatherAttributes', () => {
  it('packs every target and motion value without dropping the last leaf', () => {
    const packed = packLeafGatherAttributes(packedMotions)

    expect(packed.count).toBe(3)
    expect(packed.targetPosition).toHaveLength(9)
    expect(packed.targetQuaternion).toHaveLength(12)
    expect(packed.targetScale).toHaveLength(9)
    expect(packed.motion).toHaveLength(12)
    expect(packed.spin).toHaveLength(6)
    expect([...packed.targetPosition]).toEqual([8, 4, 2, -6, 10, 12, 14, -8, 16])
    expect([...packed.targetQuaternion.slice(8)]).toEqual([1, 0, 0, 0])
    expect([...packed.targetScale.slice(6)]).toEqual([1.75, 2, 1])
    expect([...packed.motion.slice(8)]).toEqual([0.375, 4, 1.5, 2.25])
    expect([...packed.spin.slice(4)]).toEqual([2.5, 0.25])
  })

  it('is deterministic and returns independent packed buffers', () => {
    const first = packLeafGatherAttributes(packedMotions)
    const second = packLeafGatherAttributes(packedMotions)

    expect(second).toEqual(first)
    expect(second.targetPosition).not.toBe(first.targetPosition)
    expect(second.motion).not.toBe(first.motion)
  })
})

describe('leafGatherShaderReferencePose', () => {
  it('matches the CPU pose endpoints and varied mid-flight paths from packed attributes', () => {
    const packed = packLeafGatherAttributes(packedMotions)

    packedMotions.forEach((motion, index) => {
      const atSource = leafGatherShaderReferencePose(source, packed, index, 0, frame)
      const atTarget = leafGatherShaderReferencePose(source, packed, index, 1, frame)
      const middle = leafGatherShaderReferencePose(source, packed, index, 0.62, frame)
      const expectedMiddle = leafGatherPose(source, motion.target, 0.62, motion.variation, frame)

      expect(atSource).toEqual(source)
      expect(atTarget.position).toEqual(motion.target.position)
      expect(atTarget.quaternion).toEqual(motion.target.quaternion)
      expect(atTarget.scale).toEqual(motion.target.scale)
      expectedMiddle.position.forEach((value, axis) => expect(middle.position[axis]).toBeCloseTo(value, 5))
      expectedMiddle.quaternion.forEach((value, axis) => expect(middle.quaternion[axis]).toBeCloseTo(value, 5))
      expectedMiddle.scale.forEach((value, axis) => expect(middle.scale[axis]).toBeCloseTo(value, 5))
    })

    const firstMiddle = leafGatherShaderReferencePose(source, packed, 0, 0.62, frame)
    const secondMiddle = leafGatherShaderReferencePose(source, packed, 1, 0.62, frame)
    expect(firstMiddle.position).not.toEqual(secondMiddle.position)
    expect(firstMiddle.quaternion).not.toEqual(secondMiddle.quaternion)
  })
})
