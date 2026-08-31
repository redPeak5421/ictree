import { describe, expect, it } from 'vitest'
import {
  canInteractWithGrove,
  finishScanReveal,
  materializeScanReveal,
  requestScanRevealClose,
  requestScanRevealModeChange,
  shouldDeferScanRevealMutation,
  settleScanReveal,
  startScanReveal,
  startScanRevealIfIdle,
} from './scanRevealState'

describe('scan reveal lifecycle', () => {
  it('restores footer interaction after the reveal settles but locks every transition', () => {
    const opening = startScanReveal('opening')
    const materializing = materializeScanReveal(opening)
    const settled = settleScanReveal(opening)
    const closing = requestScanRevealClose(settled)

    expect(canInteractWithGrove(null)).toBe(true)
    expect(canInteractWithGrove(opening)).toBe(false)
    expect(canInteractWithGrove(materializing)).toBe(false)
    expect(canInteractWithGrove(settled)).toBe(true)
    expect(canInteractWithGrove(closing)).toBe(false)
  })

  it('defers a mode change until WebGL leaves have completed their return', () => {
    const settled = settleScanReveal(startScanReveal('https://example.com/grove'))

    expect(requestScanRevealModeChange(settled, 'create', true)).toEqual({
      reveal: {
        text: 'https://example.com/grove',
        closing: true,
        materializing: true,
        settled: true,
      },
      pendingMode: 'create',
      immediateMode: null,
    })
  })

  it('changes mode immediately when no WebGL leaves need to return', () => {
    const materializing = materializeScanReveal(startScanReveal('fallback result'))

    expect(requestScanRevealModeChange(materializing, 'create', false)).toEqual({
      reveal: null,
      pendingMode: null,
      immediateMode: 'create',
    })
    expect(requestScanRevealModeChange(null, 'reveal', true)).toEqual({
      reveal: null,
      pendingMode: null,
      immediateMode: 'reveal',
    })
  })

  it('defers source-changing controls until active WebGL leaves return', () => {
    const settled = settleScanReveal(startScanReveal('visible result'))

    expect(shouldDeferScanRevealMutation(settled, true)).toBe(true)
    expect(shouldDeferScanRevealMutation(null, true)).toBe(false)
    expect(shouldDeferScanRevealMutation(settled, false)).toBe(false)
  })

  it('starts with the exact nonempty literal text', () => {
    const text = '  https://example.com/leaf\n第二行  '

    expect(startScanReveal(text)).toEqual({
      text,
      closing: false,
      materializing: false,
      settled: false,
    })
  })

  it('starts only while idle and preserves an active reveal session', () => {
    const active = materializeScanReveal(startScanReveal('first session'))

    expect(startScanRevealIfIdle(null, 'new session')).toEqual(startScanReveal('new session'))
    expect(startScanRevealIfIdle(active, 'stale replacement')).toBe(active)
  })

  it('settles without changing the reveal text', () => {
    const started = startScanReveal('gv1.literal-token')

    expect(settleScanReveal(started)).toEqual({
      text: 'gv1.literal-token',
      closing: false,
      materializing: true,
      settled: true,
    })
  })

  it('requests close without clearing the reveal', () => {
    const started = startScanReveal('https://example.com/grove')

    expect(requestScanRevealClose(started)).toEqual({
      text: started.text,
      closing: true,
      materializing: false,
      settled: false,
    })
  })

  it('finishes immediately when there are no 3D leaves to reverse', () => {
    const started = startScanReveal('fallback result')

    expect(requestScanRevealClose(started, false)).toBeNull()
  })

  it('keeps repeated and late transitions idempotent', () => {
    const settled = settleScanReveal(settleScanReveal(startScanReveal('literal')))
    const closing = requestScanRevealClose(requestScanRevealClose(settled))

    expect(settled).toEqual({ text: 'literal', closing: false, materializing: true, settled: true })
    expect(closing).toEqual({ text: 'literal', closing: true, materializing: true, settled: true })
    expect(settleScanReveal(closing)).toBe(closing)
    expect(settleScanReveal(null)).toBeNull()
    expect(requestScanRevealClose(null)).toBeNull()
    expect(finishScanReveal(null)).toBeNull()
  })

  it('materializes exactly once and ignores late progress after close', () => {
    const started = startScanReveal('literal progress')

    const materializing = materializeScanReveal(started)
    expect(materializing).toEqual({
      text: started.text,
      closing: false,
      materializing: true,
      settled: false,
    })
    expect(materializeScanReveal(materializing)).toBe(materializing)
    const closing = requestScanRevealClose(started)
    expect(materializeScanReveal(closing)).toBe(closing)
    expect(materializeScanReveal(null)).toBeNull()
  })

  it('finishes only when the leaf close endpoint is reported', () => {
    const started = startScanReveal('keep until leaves return')
    const closing = requestScanRevealClose(started)

    expect(finishScanReveal(started)).toBe(started)
    expect(closing).not.toBeNull()
    expect(finishScanReveal(closing)).toBeNull()
  })
})
