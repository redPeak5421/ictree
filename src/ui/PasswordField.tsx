import { useT } from '../i18n/useLocale'
import { LockIcon } from './icons'

export function PasswordField({
  value,
  onChange,
  unlock = false,
}: {
  value: string
  onChange: (value: string) => void
  unlock?: boolean
}) {
  const t = useT()
  return (
    <label className="field-row is-secondary">
      <LockIcon />
      <input
        className="url-field"
        type="password"
        autoComplete={unlock ? 'current-password' : 'new-password'}
        spellCheck={false}
        aria-label={unlock ? t.unlockPassword : t.password}
        placeholder={unlock ? t.unlockPassword : t.passwordOptional}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
