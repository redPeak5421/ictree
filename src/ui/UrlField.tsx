export function UrlField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      className="url-field"
      type="text"
      inputMode="text"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      aria-label="Text or URL"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
