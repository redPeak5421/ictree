import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from '../i18n/useLocale'
import type { ModuleGrid } from '../qr/types'
import type { SceneColors } from '../scene/palettes'
import { scanTreePayload } from '../share/scanTree'
import { isWrapped, unwrapSecret } from '../share/secret'
import { PasswordField } from './PasswordField'

export function RevealPanel({
  grid,
  colors,
  locked,
  shareMenu,
  disabled,
  onRevealed,
}: {
  grid: ModuleGrid
  colors: SceneColors
  locked: boolean
  shareMenu: ReactNode
  disabled: boolean
  onRevealed: (text: string) => void
}) {
  const t = useT()
  const [password, setPassword] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const requestEpoch = useRef(0)

  useEffect(() => () => {
    requestEpoch.current += 1
  }, [])

  useEffect(() => {
    if (disabled) requestEpoch.current += 1
  }, [disabled])

  const scan = async () => {
    if (disabled || busy) return
    const epoch = ++requestEpoch.current
    const isCurrent = () => requestEpoch.current === epoch
    setBusy(true)
    setNote(null)
    try {
      const payload = scanTreePayload(grid, colors)
      if (!payload) {
        setNote(t.holdOverhead)
        return
      }
      if (!isWrapped(payload) && !locked) {
        onRevealed(payload)
        return
      }
      if (!password) {
        setNote(t.enterPassword)
        return
      }
      const url = await unwrapSecret(isWrapped(payload) ? payload : grid.payload, password)
      if (!isCurrent()) return
      if (!url) {
        setNote(t.wrongPassword)
        return
      }
      onRevealed(url)
    } finally {
      if (isCurrent()) setBusy(false)
    }
  }

  return (
    <>
      {locked && (
        <div className="field-card">
          <PasswordField value={password} onChange={setPassword} unlock />
        </div>
      )}
      <div className="reveal-actions">
        <button type="button" className="scan-btn" onClick={() => void scan()} disabled={busy || disabled}>
          {busy ? t.scanning : t.scanTree}
        </button>
        {shareMenu}
      </div>
      {note && <p className="error reveal-error">{note}</p>}
    </>
  )
}
