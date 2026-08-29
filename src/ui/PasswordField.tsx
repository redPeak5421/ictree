import { useT } from '../i18n/useLocale'
import { LockIcon } from './icons'

export function PasswordField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const t = useT()
  return (
    <label className="field-row is-secondary">
      <LockIcon />
      <input
        className="url-field"
        type="password"
        autoComplete="new-password"
        spellCheck={false}
        aria-label={t.password}
        placeholder={t.passwordOptional}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
