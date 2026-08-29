import { useT } from '../i18n/useLocale'
import { MuteIcon } from './icons'

export function MuteButton({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  const t = useT()
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={muted ? t.unmute : t.mute}
      aria-pressed={!muted}
      onClick={onToggle}
    >
      <MuteIcon muted={muted} />
    </button>
  )
}
