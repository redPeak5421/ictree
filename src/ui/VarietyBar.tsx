import { selectedVariety, type TreeVariety } from '../scene/treeSpecies'

const OPTIONS: { id: TreeVariety; label: string }[] = [
  { id: 'oak', label: 'Oak' },
  { id: 'maple', label: 'Maple' },
  { id: 'cherry', label: 'Cherry' },
  { id: 'sparse', label: 'Sparse' },
]

export function VarietyBar({
  payload,
  variety,
  onChange,
}: {
  payload: string
  variety: TreeVariety | 'auto'
  onChange: (variety: TreeVariety) => void
}) {
  const selected = selectedVariety(payload, variety)
  return (
    <div className="variety-bar" role="radiogroup" aria-label="Tree">
      {OPTIONS.map((option) => {
        const on = option.id === selected
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={on}
            className={on ? 'season-btn is-selected' : 'season-btn'}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
