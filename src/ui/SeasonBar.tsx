import { useT } from '../i18n/useLocale'
import type { Season } from '../scene/palettes'

const OPTIONS: { id: Season; mark: string }[] = [
  { id: 'spring', mark: '🌸' },
  { id: 'summer', mark: '☀️' },
  { id: 'autumn', mark: '🌧️' },
]

export function SeasonBar({ season, onChange }: { season: Season; onChange: (season: Season) => void }) {
  const t = useT()
  return (
    <div className="segmented" role="radiogroup" aria-label={t.season}>
      {OPTIONS.map((option) => {
        const selected = option.id === season
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={selected ? 'segment is-selected' : 'segment'}
            onClick={() => onChange(option.id)}
          >
            <span aria-hidden="true">{option.mark}</span>
            <span>{t.seasons[option.id]}</span>
          </button>
        )
      })}
    </div>
  )
}
