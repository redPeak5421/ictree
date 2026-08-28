import { useEffect, useRef, useState } from 'react'
import type { ModuleGrid } from '../qr/types'
import type { PaletteId, SceneColors, Season } from '../scene/palettes'
import type { TreeVariety } from '../scene/treeSpecies'
import { downloadQrPng } from '../share/exportPng'
import { shareUrl } from '../share/params'
import { ShareIcon } from './icons'

export function ShareMenu({
  url,
  season,
  palette,
  variety,
  grid,
  colors,
}: {
  url: string
  season: Season
  palette: PaletteId
  variety: TreeVariety | 'auto'
  grid: ModuleGrid
  colors: SceneColors
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
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

  const link = shareUrl(window.location.origin, window.location.pathname, { url, season, palette, variety })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      window.prompt('Copy link', link)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="share" ref={root}>
      <button
        type="button"
        className="share-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Share"
        onClick={() => setOpen((value) => !value)}
      >
        <ShareIcon />
      </button>
      {open && (
        <div className="share-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy Link'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              downloadQrPng(grid, colors)
              setOpen(false)
            }}
          >
            Download QR
          </button>
          <a
            role="menuitem"
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('grove')}&url=${encodeURIComponent(link)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Share on X
          </a>
          <a
            role="menuitem"
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Facebook
          </a>
          <a
            role="menuitem"
            href={`https://wa.me/?text=${encodeURIComponent(link)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
        </div>
      )}
    </div>
  )
}
