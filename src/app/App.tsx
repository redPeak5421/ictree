import { TreeCanvas } from '../scene/TreeCanvas'
import { HintPill } from '../ui/HintPill'
import { MuteButton } from '../ui/MuteButton'
import { PaletteRow } from '../ui/PaletteRow'
import { QrFallback } from '../ui/QrFallback'
import { SeasonBar } from '../ui/SeasonBar'
import { ShareMenu } from '../ui/ShareMenu'
import { UrlField } from '../ui/UrlField'
import { useTreeState } from './useTreeState'

export function App() {
  const state = useTreeState()
  return (
    <div className="app">
      <div className="stage">
        <span className="wordmark">grove</span>
        {state.webgl ? (
          <TreeCanvas
            grid={state.grid}
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
        <HintPill overhead={state.overhead} onToggle={state.toggleView} />
        {state.error && <p className="error">{state.error}</p>}
        <div className="url-row">
          <UrlField value={state.url} onChange={state.setUrl} />
          <ShareMenu
            url={state.url}
            season={state.season}
            palette={state.palette}
            grid={state.grid}
            colors={state.colors}
          />
        </div>
        <div className="season-row">
          <SeasonBar season={state.season} onChange={state.setSeason} />
          <MuteButton muted={state.muted} onToggle={state.toggleMuted} />
        </div>
        <PaletteRow palette={state.palette} onChange={state.setPalette} />
      </footer>
    </div>
  )
}
