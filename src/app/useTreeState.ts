import { useCallback, useEffect, useRef, useState } from 'react'
import { setAmbienceMuted, setAmbienceSeason } from '../audio/ambience'
import { encodeGrid } from '../qr/encode'
import { DEFAULT_PAYLOAD, normalizePayload, payloadError } from '../qr/payload'
import type { ModuleGrid } from '../qr/types'
import {
  colorsOf,
  lerpColors,
  type PaletteId,
  type SceneColors,
  type Season,
} from '../scene/palettes'
import { easeInOutCubic, isOverhead, OVERHEAD, SEASON_MS, squareYaw } from '../scene/view'
import type { SceneState } from '../scene/sceneState'
import { VIEW_PITCH, VIEW_YAW } from '../scene/tree'
import { buildShareSearch, parseShareParams } from '../share/params'
import type { TreeVariety } from '../scene/treeSpecies'

function detectWebgl(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useTreeState() {
  const initial = parseShareParams(window.location.search)
  const startUrl = initial.url || DEFAULT_PAYLOAD
  const [url, setUrl] = useState(startUrl)
  const [season, setSeason] = useState<Season>(initial.season)
  const [palette, setPalette] = useState<PaletteId>(initial.palette)
  const [variety, setVariety] = useState<TreeVariety | 'auto'>(initial.variety)
  const [muted, setMuted] = useState(true)
  /** The camera is straight down: the canopy reads as the code. */
  const [overhead, setOverhead] = useState(false)
  const [error, setError] = useState<string | null>(payloadError(startUrl))
  const [grid, setGrid] = useState<ModuleGrid>(() => encodeGrid(normalizePayload(startUrl)))
  const [webgl] = useState(detectWebgl)
  const [reduced, setReduced] = useState(prefersReducedMotion)

  // Settled colours: what the UI, the PNG export and the fallback canvas use.
  // Mid-transition values must never leak into an exported code.
  const [colors, setColors] = useState<SceneColors>(() => colorsOf(initial.season, initial.palette))

  // Animated channel read by the R3F scene inside useFrame, so a camera glide
  // or a season fade does not re-render React every frame.
  const scene = useRef<SceneState>({
    colors: colorsOf(initial.season, initial.palette),
    season: initial.season,
    yaw: VIEW_YAW,
    pitch: VIEW_PITCH,
    spinYaw: 0,
    spinPitch: 0,
    dragging: false,
    pitchTarget: null,
    yawTarget: null,
  })

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const message = payloadError(url)
    setError(message)
    if (message) return
    const handle = window.setTimeout(() => {
      setGrid(encodeGrid(normalizePayload(url)))
    }, 200)
    return () => window.clearTimeout(handle)
  }, [url])

  useEffect(() => {
    const search = buildShareSearch({ url, season, palette, variety })
    const next = `${window.location.pathname}${search}`
    if (`${window.location.pathname}${window.location.search}` !== next) {
      history.replaceState(null, '', next)
    }
  }, [url, season, palette, variety])

  useEffect(() => {
    const target = colorsOf(season, palette)
    setColors(target)
    scene.current.season = season
    const from = scene.current.colors
    const duration = reduced ? 1 : SEASON_MS
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      scene.current.colors = lerpColors(from, target, easeInOutCubic(p))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [season, palette, reduced])

  useEffect(() => {
    setAmbienceSeason(season)
  }, [season])

  /**
   * A tap glides the camera straight down, where the leaves are the code, or
   * back to the isometric view. It only moves the camera: the tree is the same
   * object either way.
   */
  const toggleView = useCallback(() => {
    const state = scene.current
    const heading = state.pitchTarget !== null ? state.pitchTarget : state.pitch
    const up = state.pitchTarget === OVERHEAD || (state.pitchTarget === null && isOverhead(heading))
    state.pitchTarget = up ? VIEW_PITCH : OVERHEAD
    state.yawTarget = up ? null : squareYaw(state.yaw)
    state.spinYaw = 0
    state.spinPitch = 0
  }, [])

  const toggleMuted = useCallback(() => {
    setMuted((value) => {
      const next = !value
      setAmbienceMuted(next)
      return next
    })
  }, [])

  return {
    url,
    setUrl,
    season,
    setSeason,
    palette,
    setPalette,
    variety,
    setVariety,
    muted,
    toggleMuted,
    overhead,
    setOverhead,
    toggleView,
    error,
    grid,
    colors,
    scene,
    webgl,
    reduced,
  }
}
