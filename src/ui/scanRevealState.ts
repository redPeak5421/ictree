import type { AppMode } from '../share/params'

export interface ScanRevealState {
  text: string
  closing: boolean
  materializing: boolean
  settled: boolean
}

export function canInteractWithTree(state: ScanRevealState | null): boolean {
  return state === null || (state.settled && !state.closing)
}

/** Source-changing controls wait for visible WebGL leaves to return first. */
export function shouldDeferScanRevealMutation(
  state: ScanRevealState | null,
  reverseLeaves: boolean,
): boolean {
  return state !== null && reverseLeaves
}

export interface ScanRevealModeChange {
  reveal: ScanRevealState | null
  pendingMode: AppMode | null
  immediateMode: AppMode | null
}

export function requestScanRevealModeChange(
  state: ScanRevealState | null,
  mode: AppMode,
  reverseLeaves: boolean,
): ScanRevealModeChange {
  if (!shouldDeferScanRevealMutation(state, reverseLeaves)) {
    return { reveal: null, pendingMode: null, immediateMode: mode }
  }
  return {
    reveal: requestScanRevealClose(state),
    pendingMode: mode,
    immediateMode: null,
  }
}

export function startScanReveal(text: string): ScanRevealState {
  return { text, closing: false, materializing: false, settled: false }
}

export function startScanRevealIfIdle(
  state: ScanRevealState | null,
  text: string,
): ScanRevealState {
  return state ?? startScanReveal(text)
}

export function materializeScanReveal(state: ScanRevealState | null): ScanRevealState | null {
  if (!state || state.closing || state.materializing) return state
  return { ...state, materializing: true }
}

export function settleScanReveal(state: ScanRevealState | null): ScanRevealState | null {
  if (!state || state.closing || (state.materializing && state.settled)) return state
  return { ...state, materializing: true, settled: true }
}

export function requestScanRevealClose(
  state: ScanRevealState | null,
  reverseLeaves = true,
): ScanRevealState | null {
  if (!state || state.closing) return state
  if (!reverseLeaves) return null
  return { ...state, closing: true }
}

export function finishScanReveal(state: ScanRevealState | null): ScanRevealState | null {
  return state?.closing ? null : state
}
