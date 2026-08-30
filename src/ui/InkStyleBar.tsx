import { useT } from '../i18n/useLocale'
import type { InkStyle } from '../share/params'

const OPTIONS: InkStyle[] = ['plants', 'blocks']

export function InkStyleBar({ ink, onChange }: { ink: InkStyle; onChange: (ink: InkStyle) => void }) {
  const t = useT()
  return (
    <div className="segmented" role="radiogroup" aria-label={t.inkStyle}>
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={ink === option}
          className={ink === option ? 'segment is-selected' : 'segment'}
          onClick={() => onChange(option)}
        >
          {t.inkStyles[option]}
        </button>
      ))}
    </div>
  )
}
