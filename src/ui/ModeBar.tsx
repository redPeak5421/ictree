import { useT } from '../i18n/useLocale'
import type { AppMode } from '../share/params'

const MODES: AppMode[] = ['create', 'reveal']

export function ModeBar({ mode, onChange }: { mode: AppMode; onChange: (mode: AppMode) => void }) {
  const t = useT()
  return (
    <div className="mode-bar" role="radiogroup" aria-label={t.mode}>
      {MODES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={mode === option}
          className={mode === option ? 'mode-tab is-selected' : 'mode-tab'}
          onClick={() => onChange(option)}
        >
          {t[option]}
        </button>
      ))}
    </div>
  )
}
