import { MuteIcon } from './icons'

export function MuteButton({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={muted ? 'Unmute' : 'Mute'}
      aria-pressed={!muted}
      onClick={onToggle}
    >
      <MuteIcon muted={muted} />
    </button>
  )
}
