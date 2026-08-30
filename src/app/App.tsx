import { translateMessage } from '../i18n/messages'
import { useT } from '../i18n/useLocale'
import { TreeCanvas } from '../scene/TreeCanvas'
import { HintPill } from '../ui/HintPill'
import { InkStyleBar } from '../ui/InkStyleBar'
import { LanguageSelect } from '../ui/LanguageSelect'
import { ModeBar } from '../ui/ModeBar'
import { PasswordField } from '../ui/PasswordField'
import { QrFallback } from '../ui/QrFallback'
import { RevealPanel } from '../ui/RevealPanel'
import { SeasonBar } from '../ui/SeasonBar'
import { ShareMenu } from '../ui/ShareMenu'
import { TreeRow } from '../ui/TreeRow'
import { UrlField } from '../ui/UrlField'
import { WeatherButton } from '../ui/WeatherButton'
import { useTreeState } from './useTreeState'

export function App() {
  const state = useTreeState()
  const t = useT()
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
    />
  )
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
            onToggle={state.toggleView}
            onOverhead={state.setOverhead}
          />
        ) : (
          <QrFallback grid={state.grid} colors={state.colors} />
        )}
      </div>
      <footer className="chrome">
        <div className="top-row">
          <ModeBar mode={state.mode} onChange={state.setMode} />
          <div className="top-tools">
            <LanguageSelect />
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
          <>
            <RevealPanel grid={state.grid} colors={state.colors} locked={state.locked} />
            <div className="field-row is-note">
              {shareMenu}
            </div>
          </>
        )}
        <SeasonBar season={state.season} onChange={state.setSeason} />
        <InkStyleBar ink={state.ink} onChange={state.setInk} />
        <TreeRow tree={state.tree} season={state.season} onChange={state.setTree} />
        {state.webgl && <HintPill overhead={state.overhead} onToggle={state.toggleView} />}
      </footer>
    </div>
  )
}
