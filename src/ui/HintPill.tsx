export function HintPill({ overhead, onToggle }: { overhead: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="hint-pill" onClick={onToggle}>
      {overhead ? 'Tap to come back down' : 'Drag to turn · Tap to see it from above'}
    </button>
  )
}
