import { useT } from '../i18n/useLocale'
import { RainIcon } from './icons'

export function WeatherButton({ rain, onToggle }: { rain: boolean; onToggle: () => void }) {
  const t = useT()
  return (
    <button
      type="button"
      className={rain ? 'icon-btn is-on' : 'icon-btn'}
      aria-label={rain ? t.rainOff : t.rainOn}
      aria-pressed={rain}
      onClick={onToggle}
    >
      <RainIcon />
    </button>
  )
}
