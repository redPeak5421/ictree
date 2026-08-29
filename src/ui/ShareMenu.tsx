import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n/useLocale'
import { translateMessage } from '../i18n/messages'
import type { ModuleGrid } from '../qr/types'
import type { SceneColors } from '../scene/palettes'
import type { SceneRef } from '../scene/sceneState'
import { downloadLoopGif } from '../share/exportLoop'
import { downloadQrPng } from '../share/exportPng'
import { downloadStillPng, STILL_NO_CANVAS } from '../share/exportStill'
import { readStillFile, STILL_ERROR } from '../share/importStill'
import { shareUrl, type ShareState } from '../share/params'
import { ShareIcon } from './icons'

export function ShareMenu({
  state,
  grid,
  colors,
  scene,
  onApplyStill,
}: {
  state: ShareState
  grid: ModuleGrid
  colors: SceneColors
  scene: SceneRef
  onApplyStill: (state: ShareState) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [stillNote, setStillNote] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setStillNote(null)
      return
    }
    const onDoc = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const link = shareUrl(window.location.origin, window.location.pathname, state)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      window.prompt(t.copyLinkPrompt, link)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  const failStill = (err: unknown) => {
    setStillNote(translateMessage(t, err instanceof Error ? err.message : STILL_NO_CANVAS))
  }

  const openStill = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    try {
      onApplyStill(await readStillFile(file))
      setOpen(false)
    } catch (err) {
      setStillNote(translateMessage(t, err instanceof Error ? err.message : STILL_ERROR))
      setOpen(true)
    }
  }

  return (
    <div className="share" ref={root}>
      <button
        type="button"
        className="share-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.share}
        onClick={() => setOpen((value) => !value)}
      >
        <ShareIcon />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/gif,image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) => void openStill(event.target.files?.[0])}
      />
      {open && (
        <div className="share-menu" role="menu">
          <div className="share-group" role="group" aria-label={t.shareGroup}>
            <p className="share-group-title">{t.shareGroup}</p>
            <button type="button" role="menuitem" onClick={() => void copy()}>
              {copied ? t.copied : t.copyLink}
            </button>
            <a
              role="menuitem"
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('grove')}&url=${encodeURIComponent(link)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.shareOnX}
            </a>
            <a
              role="menuitem"
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.facebook}
            </a>
            <a
              role="menuitem"
              href={`https://wa.me/?text=${encodeURIComponent(link)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.whatsapp}
            </a>
          </div>
          <div className="share-group" role="group" aria-label={t.exportGroup}>
            <p className="share-group-title">{t.exportGroup}</p>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                downloadQrPng(grid, colors)
                setOpen(false)
              }}
            >
              {t.downloadQr}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                void downloadStillPng(state).then(() => setOpen(false)).catch(failStill)
              }}
            >
              {t.saveStill}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                void downloadLoopGif(state, scene).then(() => setOpen(false)).catch(failStill)
              }}
            >
              {t.saveLoop}
            </button>
          </div>
          <div className="share-group" role="group" aria-label={t.importGroup}>
            <p className="share-group-title">{t.importGroup}</p>
            <button type="button" role="menuitem" onClick={() => fileRef.current?.click()}>
              {t.openStill}
            </button>
          </div>
          {stillNote && <p className="error">{stillNote}</p>}
        </div>
      )}
    </div>
  )
}
