import { useState } from 'react'
import { useT } from '../i18n/useLocale'
import type { ModuleGrid } from '../qr/types'
import type { SceneColors } from '../scene/palettes'
import { scanGrovePayload } from '../share/scanGrove'
import { isWrapped, unwrapSecret } from '../share/secret'

export function RevealPanel({
  grid,
  colors,
  locked,
}: {
  grid: ModuleGrid
  colors: SceneColors
  locked: boolean
}) {
  const t = useT()
  const [password, setPassword] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const scan = async () => {
    setBusy(true)
    setNote(null)
    try {
      const payload = scanGrovePayload(grid, colors)
      if (!payload) {
        setNote(t.holdOverhead)
        return
      }
      if (!isWrapped(payload) && !locked) {
        setRevealed(payload)
        return
      }
      if (!password) {
        setNote(t.enterPassword)
        return
      }
      const url = await unwrapSecret(isWrapped(payload) ? payload : grid.payload, password)
      if (!url) {
        setNote(t.wrongPassword)
        return
      }
      setRevealed(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="reveal-panel">
      {locked && (
        <input
          className="url-field"
          type="password"
          autoComplete="current-password"
          aria-label={t.unlockPassword}
          placeholder={t.password}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      )}
      <button type="button" className="action-btn" onClick={() => void scan()} disabled={busy}>
        {busy ? t.scanning : t.scanGrove}
      </button>
      {revealed && (
        <a className="reveal-link" href={revealed} target="_blank" rel="noopener noreferrer">
          {revealed}
        </a>
      )}
      {note && <p className="error">{note}</p>}
    </div>
  )
}
