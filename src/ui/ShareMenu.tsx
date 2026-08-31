import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n/useLocale'
import { translateMessage } from '../i18n/messages'
import type { ModuleGrid } from '../qr/types'
import type { SceneColors } from '../scene/palettes'
import type { SceneRef } from '../scene/sceneState'
import { downloadLoopGif, preserveCurrentCameraAbortReason } from '../share/exportLoop'
import { downloadQrPng } from '../share/exportPng'
import { downloadStillPng, STILL_NO_CANVAS } from '../share/exportStill'
import { readStillFile, STILL_ERROR } from '../share/importStill'
import { shareUrl, type ShareState } from '../share/params'
import { ShareIcon } from './icons'

export function isShareActionCurrent(
  actionEpoch: number,
  currentEpoch: number,
  disabled: boolean,
  mounted: boolean,
): boolean {
  return actionEpoch === currentEpoch && !disabled && mounted
}

export function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
}

export function ShareMenu({
  state,
  grid,
  colors,
  scene,
  onApplyStill,
  disabled = false,
}: {
  state: ShareState
  grid: ModuleGrid
  colors: SceneColors
  scene: SceneRef
  onApplyStill: (state: ShareState) => void
  disabled?: boolean
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [stillNote, setStillNote] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  const disabledRef = useRef(disabled)
  const actionEpoch = useRef(0)
  const loopController = useRef<AbortController | null>(null)
  const copiedTimer = useRef<number | null>(null)
  disabledRef.current = disabled

  const invalidateActions = (preserveCurrentCamera = false) => {
    actionEpoch.current += 1
    if (loopController.current) {
      if (preserveCurrentCamera) {
        loopController.current.abort(preserveCurrentCameraAbortReason())
      } else {
        loopController.current.abort()
      }
    }
    loopController.current = null
    if (copiedTimer.current !== null) {
      window.clearTimeout(copiedTimer.current)
      copiedTimer.current = null
    }
  }

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      invalidateActions()
    }
  }, [])

  useLayoutEffect(() => {
    if (!disabled) return
    invalidateActions(true)
    setOpen(false)
    setCopied(false)
    setStillNote(null)
  }, [disabled])

  useEffect(() => {
    if (!open) {
      setStillNote(null)
      return
    }
    const onDoc = (event: MouseEvent) => {
      const node = event.target as Node
      if (root.current?.contains(node) || menu.current?.contains(node)) return
      setOpen(false)
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

  useLayoutEffect(() => {
    if (!open || disabled) return
    const place = () => {
      const btn = button.current
      const panel = menu.current
      if (!btn || !panel) return
      const box = btn.getBoundingClientRect()
      const height = panel.offsetHeight
      const gap = 8
      const spaceBelow = window.innerHeight - box.bottom - gap
      const spaceAbove = box.top - gap
      const below = spaceBelow >= height || spaceBelow >= spaceAbove
      const top = below ? box.bottom + gap : Math.max(gap, box.top - height - gap)
      const right = Math.max(gap, window.innerWidth - box.right)
      panel.style.top = `${top}px`
      panel.style.right = `${right}px`
      panel.style.left = 'auto'
      panel.style.bottom = 'auto'
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [disabled, open, stillNote])

  const link = shareUrl(window.location.origin, window.location.pathname, state)

  const isCurrent = (epoch: number) => isShareActionCurrent(
    epoch,
    actionEpoch.current,
    disabledRef.current,
    mounted.current,
  )

  const beginAction = (controller?: AbortController) => {
    actionEpoch.current += 1
    loopController.current?.abort()
    loopController.current = controller ?? null
    if (copiedTimer.current !== null) {
      window.clearTimeout(copiedTimer.current)
      copiedTimer.current = null
    }
    return actionEpoch.current
  }

  const copy = async () => {
    if (disabledRef.current) return
    const epoch = beginAction()
    try {
      await navigator.clipboard.writeText(link)
    } catch (err) {
      if (!isCurrent(epoch) || isAbortError(err)) return
      window.prompt(t.copyLinkPrompt, link)
    }
    if (!isCurrent(epoch)) return
    setCopied(true)
    copiedTimer.current = window.setTimeout(() => {
      if (isCurrent(epoch)) setCopied(false)
      copiedTimer.current = null
    }, 1200)
  }

  const failStill = (err: unknown, epoch: number) => {
    if (!isCurrent(epoch) || isAbortError(err)) return
    setStillNote(translateMessage(t, err instanceof Error ? err.message : STILL_NO_CANVAS))
  }

  const openStill = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file || disabledRef.current) return
    const epoch = beginAction()
    try {
      const nextState = await readStillFile(file)
      if (!isCurrent(epoch)) return
      onApplyStill(nextState)
      setOpen(false)
    } catch (err) {
      if (!isCurrent(epoch) || isAbortError(err)) return
      setStillNote(translateMessage(t, err instanceof Error ? err.message : STILL_ERROR))
      setOpen(true)
    }
  }

  const saveStill = async () => {
    if (disabledRef.current) return
    const epoch = beginAction()
    try {
      await downloadStillPng(state)
      if (isCurrent(epoch)) setOpen(false)
    } catch (err) {
      failStill(err, epoch)
    }
  }

  const saveLoop = async () => {
    if (disabledRef.current) return
    const controller = new AbortController()
    const epoch = beginAction(controller)
    try {
      await downloadLoopGif(state, scene, controller.signal)
      if (isCurrent(epoch)) setOpen(false)
    } catch (err) {
      failStill(err, epoch)
    } finally {
      if (loopController.current === controller) loopController.current = null
    }
  }

  const panel = open && !disabled ? (
    <div className="share-menu" role="menu" ref={menu}>
      <div className="share-group" role="group" aria-label={t.shareGroup}>
        <p className="share-group-title">{t.shareGroup}</p>
        <button type="button" role="menuitem" disabled={disabled} onClick={() => void copy()}>
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
          disabled={disabled}
          onClick={() => {
            if (disabledRef.current) return
            downloadQrPng(grid, colors)
            setOpen(false)
          }}
        >
          {t.downloadQr}
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={disabled}
          onClick={() => void saveStill()}
        >
          {t.saveStill}
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={disabled}
          onClick={() => void saveLoop()}
        >
          {t.saveLoop}
        </button>
      </div>
      <div className="share-group" role="group" aria-label={t.importGroup}>
        <p className="share-group-title">{t.importGroup}</p>
        <button
          type="button"
          role="menuitem"
          disabled={disabled}
          onClick={() => {
            if (!disabledRef.current) fileRef.current?.click()
          }}
        >
          {t.openStill}
        </button>
      </div>
      {stillNote && <p className="error">{stillNote}</p>}
    </div>
  ) : null

  return (
    <div className="share" ref={root}>
      <button
        ref={button}
        type="button"
        className="share-btn"
        aria-haspopup="menu"
        aria-expanded={open && !disabled}
        aria-label={t.share}
        disabled={disabled}
        onClick={() => {
          if (!disabledRef.current) setOpen((value) => !value)
        }}
      >
        <ShareIcon />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/gif,image/png,image/jpeg,image/webp"
        hidden
        disabled={disabled}
        onChange={(event) => void openStill(event.target.files?.[0])}
      />
      {panel && createPortal(panel, document.body)}
    </div>
  )
}
