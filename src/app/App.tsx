import { useCallback, useEffect, useRef, useState } from 'react'
import { translateMessage } from '../i18n/messages'
import { useT } from '../i18n/useLocale'
import { TreeCanvas } from '../scene/TreeCanvas'
import type { AppMode } from '../share/params'
import { HintPill } from '../ui/HintPill'
import { InkStyleBar } from '../ui/InkStyleBar'
import { GitHubLink } from '../ui/GitHubLink'
import { LanguageSelect } from '../ui/LanguageSelect'
import { MuteButton } from '../ui/MuteButton'
import { ModeBar } from '../ui/ModeBar'
import { PasswordField } from '../ui/PasswordField'
import { QrFallback } from '../ui/QrFallback'
import { RevealPanel } from '../ui/RevealPanel'
import { ScanReveal } from '../ui/ScanReveal'
import {
  canInteractWithTree,
  finishScanReveal,
  materializeScanReveal,
  requestScanRevealClose,
  settleScanReveal,
  shouldDeferScanRevealMutation,
  startScanRevealIfIdle,
  type ScanRevealState,
} from '../ui/scanRevealState'
import { SeasonBar } from '../ui/SeasonBar'
import { ShareMenu } from '../ui/ShareMenu'
import { TreeRow } from '../ui/TreeRow'
import { UrlField } from '../ui/UrlField'
import { WeatherButton } from '../ui/WeatherButton'
import { useTreeState } from './useTreeState'

export function App() {
  const state = useTreeState()
  const t = useT()
  const [reveal, setReveal] = useState<ScanRevealState | null>(null)
  const treeInteractive = canInteractWithTree(reveal)
  const modeRef = useRef(state.mode)
  const pendingRevealActionRef = useRef<(() => void) | null>(null)
  modeRef.current = state.mode
  const share = {
    url: state.payload,
    season: state.season,
    tree: state.tree,
    locked: state.locked,
    mode: state.mode,
    ink: state.ink,
  }
  const shareMenu = (
    <ShareMenu
      state={share}
      grid={state.grid}
      colors={state.colors}
      scene={state.scene}
      onApplyStill={state.applyShareState}
      disabled={reveal !== null}
    />
  )

  useEffect(() => {
    if (state.mode !== 'reveal') {
      pendingRevealActionRef.current = null
      setReveal(null)
    }
  }, [state.mode])

  const onRevealed = useCallback((text: string) => {
    if (modeRef.current !== 'reveal') return
    setReveal((current) => {
      const started = startScanRevealIfIdle(current, text)
      if (started === current) return current
      return state.webgl ? started : settleScanReveal(started)
    })
  }, [state.webgl])
  const onRevealClose = useCallback(() => {
    pendingRevealActionRef.current = null
    setReveal((current) => requestScanRevealClose(current, state.webgl))
  }, [state.webgl])
  const applyAfterRevealClose = useCallback((action: () => void) => {
    if (!shouldDeferScanRevealMutation(reveal, state.webgl)) {
      pendingRevealActionRef.current = null
      setReveal(null)
      action()
      return
    }
    pendingRevealActionRef.current = action
    setReveal((current) => requestScanRevealClose(current))
  }, [reveal, state.webgl])
  const onModeChange = useCallback((mode: AppMode) => {
    if (mode === modeRef.current) return
    applyAfterRevealClose(() => state.setMode(mode))
  }, [applyAfterRevealClose, state.setMode])
  const onRevealSettled = useCallback(() => {
    setReveal(settleScanReveal)
  }, [])
  const onRevealTextReveal = useCallback(() => {
    setReveal(materializeScanReveal)
  }, [])
  const onRevealClosed = useCallback(() => {
    setReveal(finishScanReveal)
    const pendingAction = pendingRevealActionRef.current
    pendingRevealActionRef.current = null
    pendingAction?.()
  }, [])
  return (
    <div className="app">
      <div className="stage">
        {state.webgl ? (
          <TreeCanvas
            grid={state.grid}
            tree={state.tree}
            season={state.season}
            scene={state.scene}
            reduced={state.reduced}
            rain={state.rain}
            ink={state.ink}
            locked={state.locked}
            reveal={reveal}
            onRevealTextReveal={onRevealTextReveal}
            onRevealSettled={onRevealSettled}
            onRevealClosed={onRevealClosed}
            onToggle={state.toggleView}
            onOverhead={state.setOverhead}
          />
        ) : (
          <QrFallback grid={state.grid} colors={state.colors} />
        )}
        {reveal && (
          <ScanReveal
            reveal={reveal}
            tree={state.tree}
            colors={state.colors}
            reduced={state.reduced}
            onClose={onRevealClose}
          />
        )}
      </div>
      <footer
        className={`chrome${treeInteractive ? '' : ' is-locked'}`}
        inert={!treeInteractive}
        aria-disabled={!treeInteractive}
      >
        <div className="top-row">
          <div className="top-lead">
            <GitHubLink />
            <ModeBar mode={state.mode} onChange={onModeChange} />
          </div>
          <div className="top-tools">
            <LanguageSelect />
            <MuteButton muted={state.muted} onToggle={state.toggleMuted} />
            <WeatherButton rain={state.rain} onToggle={state.toggleRain} />
          </div>
        </div>
        {state.error && <p className="error">{translateMessage(t, state.error)}</p>}
        {state.mode === 'create' ? (
          <div className="field-card">
            <div className="field-row">
              <UrlField value={state.url} onChange={state.setUrl} />
              {shareMenu}
            </div>
            <PasswordField value={state.password} onChange={state.setPassword} />
          </div>
        ) : (
          <RevealPanel
            grid={state.grid}
            colors={state.colors}
            locked={state.locked}
            shareMenu={shareMenu}
            disabled={reveal !== null}
            onRevealed={onRevealed}
          />
        )}
        <SeasonBar
          season={state.season}
          onChange={(season) => applyAfterRevealClose(() => state.setSeason(season))}
        />
        <InkStyleBar
          ink={state.ink}
          onChange={(ink) => applyAfterRevealClose(() => state.setInk(ink))}
        />
        <TreeRow
          tree={state.tree}
          season={state.season}
          onChange={(tree) => applyAfterRevealClose(() => state.setTree(tree))}
        />
        {state.webgl && reveal === null && (
          <HintPill overhead={state.overhead} onToggle={state.toggleView} />
        )}
      </footer>
    </div>
  )
}
