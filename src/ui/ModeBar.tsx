import type { AppMode } from '../share/params'

export function ModeBar({ mode, onChange }: { mode: AppMode; onChange: (mode: AppMode) => void }) {
  return (
    <div className="mode-bar" role="radiogroup" aria-label="Mode">
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'create'}
        className={mode === 'create' ? 'season-btn is-selected' : 'season-btn'}
        onClick={() => onChange('create')}
      >
        Create
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'reveal'}
        className={mode === 'reveal' ? 'season-btn is-selected' : 'season-btn'}
        onClick={() => onChange('reveal')}
      >
        Reveal
      </button>
    </div>
  )
}
