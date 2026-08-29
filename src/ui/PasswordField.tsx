export function PasswordField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <input
      className="url-field"
      type="password"
      autoComplete="new-password"
      spellCheck={false}
      aria-label="Password"
      placeholder="Password (optional)"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
