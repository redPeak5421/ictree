import { useT } from '../i18n/useLocale'

export function UrlField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useT()
  return (
    <input
      className="url-field"
      type="text"
      inputMode="text"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      aria-label={t.textOrUrl}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
