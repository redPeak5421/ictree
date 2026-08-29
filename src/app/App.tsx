import { TreeCanvas } from '../scene/TreeCanvas'
import { HintPill } from '../ui/HintPill'
import { ModeBar } from '../ui/ModeBar'
import { MuteButton } from '../ui/MuteButton'
import { PaletteRow } from '../ui/PaletteRow'
import { PasswordField } from '../ui/PasswordField'
import { QrFallback } from '../ui/QrFallback'
import { RevealPanel } from '../ui/RevealPanel'
import { SeasonBar } from '../ui/SeasonBar'
import { ShareMenu } from '../ui/ShareMenu'
import { UrlField } from '../ui/UrlField'
import { useTreeState } from './useTreeState'

export function App() {
  const state = useTreeState()
  const share = {
    url: state.payload,
    season: state.season,
    palette: state.palette,
    locked: state.locked,
    mode: state.mode,
  }
  return (
    <div className="app">
      <div className="stage">
        <span className="wordmark">grove</span>
        {state.webgl ? (
          <TreeCanvas
            grid={state.grid}
            palette={state.palette}
            season={state.season}
            scene={state.scene}
            reduced={state.reduced}
            onToggle={state.toggleView}
            onOverhead={state.setOverhead}
          />
        ) : (
          <QrFallback grid={state.grid} colors={state.colors} />
        )}
      </div>
      <footer className="chrome">
        <ModeBar mode={state.mode} onChange={state.setMode} />
        <HintPill overhead={state.overhead} onToggle={state.toggleView} />
        {state.error && <p className="error">{state.error}</p>}
        {state.mode === 'create' ? (
          <>
            <div className="url-row">
              <UrlField value={state.url} onChange={state.setUrl} />
              <ShareMenu
                state={share}
                grid={state.grid}
                colors={state.colors}
                scene={state.scene}
                onApplyStill={state.applyShareState}
              />
            </div>
            <PasswordField value={state.password} onChange={state.setPassword} />
          </>
        ) : (
          <>
            <RevealPanel grid={state.grid} colors={state.colors} locked={state.locked} />
            <div className="url-row">
              <p className="reveal-note">Import a still, then scan the grove to read it.</p>
              <ShareMenu
                state={share}
                grid={state.grid}
                colors={state.colors}
                scene={state.scene}
                onApplyStill={state.applyShareState}
              />
            </div>
          </>
        )}
        <div className="season-row">
          <SeasonBar season={state.season} onChange={state.setSeason} />
          <MuteButton muted={state.muted} onToggle={state.toggleMuted} />
        </div>
        <PaletteRow palette={state.palette} onChange={state.setPalette} />
      </footer>
    </div>
  )
}
