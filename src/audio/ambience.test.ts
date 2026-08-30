import { describe, expect, it } from 'vitest'
import { AMBIENCE_CLIPS, ambienceMix, crossfadeLoop } from './ambience'

describe('ambience mix', () => {
  it('opens exactly one seasonal bed when it is dry', () => {
    expect(ambienceMix('spring', false)).toEqual({ spring: 1, summer: 0, autumn: 0, rain: 0 })
    expect(ambienceMix('summer', false)).toEqual({ spring: 0, summer: 1, autumn: 0, rain: 0 })
    expect(ambienceMix('autumn', false)).toEqual({ spring: 0, summer: 0, autumn: 1, rain: 0 })
  })

  it('layers rain over a ducked seasonal bed', () => {
    const spring = ambienceMix('spring', true)
    expect(spring.rain).toBe(1)
    expect(spring.spring).toBeGreaterThan(0)
    expect(spring.spring).toBeLessThan(1)
    expect(spring.summer).toBe(0)
    expect(spring.autumn).toBe(0)

    const autumn = ambienceMix('autumn', true)
    expect(autumn.rain).toBe(1)
    expect(autumn.autumn).toBe(spring.spring)
    expect(autumn.spring).toBe(0)
  })

  it('points every bed at a real field-recording clip', () => {
    expect(AMBIENCE_CLIPS).toEqual({
      spring: '/audio/spring.mp3',
      summer: '/audio/summer.mp3',
      autumn: '/audio/autumn.mp3',
      rain: '/audio/rain.mp3',
    })
  })
})

describe('crossfadeLoop', () => {
  it('crossfades the tail into the head and shortens the buffer', () => {
    const src = new Float32Array(8)
    src.set([1, 1, 1, 1, 0, 0, 0, 0])
    const loop = crossfadeLoop(src, 4)
    expect([...loop]).toEqual([0, 0.25, 0.5, 0.75])
  })
})
