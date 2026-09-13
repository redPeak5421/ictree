import { useT } from '../i18n/useLocale'
import { MuteIcon, SoundIcon } from './icons'

export function MuteButton({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  const t = useT()
  return (
    <button
      type="button"
      className={muted ? 'icon-btn' : 'icon-btn is-on'}
      aria-label={muted ? t.unmute : t.mute}
      aria-pressed={!muted}
      onClick={onToggle}
    >
      {muted ? <MuteIcon /> : <SoundIcon />}
    </button>
  )
}
