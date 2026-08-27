import type { Season } from '../scene/palettes'

const OPTIONS: { id: Season; label: string; mark: string }[] = [
  { id: 'spring', label: 'Spring', mark: '🌸' },
  { id: 'summer', label: 'Summer', mark: '☀️' },
  { id: 'autumn', label: 'Autumn', mark: '🌧️' },
]

export function SeasonBar({ season, onChange }: { season: Season; onChange: (season: Season) => void }) {
  return (
    <div className="season-bar" role="radiogroup" aria-label="Season">
      {OPTIONS.map((option) => {
        const selected = option.id === season
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={selected ? 'season-btn is-selected' : 'season-btn'}
            onClick={() => onChange(option.id)}
          >
            <span aria-hidden="true">{option.mark}</span>
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
