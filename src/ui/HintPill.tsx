import { useT } from '../i18n/useLocale'

export function HintPill({ overhead, onToggle }: { overhead: boolean; onToggle: () => void }) {
  const t = useT()
  return (
    <button type="button" className="hint-pill" onClick={onToggle}>
      {overhead ? t.hintOverhead : t.hintOblique}
    </button>
  )
}
