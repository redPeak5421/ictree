import { LOCALES, type Locale } from '../i18n/messages'
import { useLocale } from '../i18n/useLocale'

/** A native select: it opens as a sheet on phones and needs no custom popover. */
export function LanguageSelect() {
  const { locale, setLocale, t } = useLocale()
  return (
    <select
      className="lang-select"
      aria-label={t.language}
      value={locale}
      onChange={(event) => setLocale(event.target.value as Locale)}
    >
      {LOCALES.map((option) => (
        <option key={option.id} value={option.id} lang={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  )
}
