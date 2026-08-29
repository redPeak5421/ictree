import { useState } from 'react'
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
        setNote('Hold the tree from above, then scan.')
        return
      }
      if (!isWrapped(payload) && !locked) {
        setRevealed(payload)
        return
      }
      if (!password) {
        setNote('Enter the password, then scan.')
        return
      }
      const url = await unwrapSecret(isWrapped(payload) ? payload : grid.payload, password)
      if (!url) {
        setNote('Wrong password.')
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
          aria-label="Unlock password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      )}
      <button type="button" className="season-btn is-selected" onClick={() => void scan()} disabled={busy}>
        {busy ? 'Scanning…' : 'Scan grove'}
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
