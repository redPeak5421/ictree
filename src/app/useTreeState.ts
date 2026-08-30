import { useCallback, useEffect, useRef, useState } from 'react'
import { setAmbienceMuted, setAmbienceRain, setAmbienceSeason } from '../audio/ambience'
import { encodeGrid } from '../qr/encode'
import { defaultPayload, normalizePayload, payloadError } from '../qr/payload'
import type { ModuleGrid } from '../qr/types'
import {
  colorsOf,
  lerpColors,
  type SceneColors,
  type Season,
} from '../scene/palettes'
import { easeInOutCubic, isOverhead, OVERHEAD, SEASON_MS, squareYaw } from '../scene/view'
import type { SceneState } from '../scene/sceneState'
import { VIEW_PITCH, VIEW_YAW } from '../scene/tree'
import type { TreeSpecies } from '../scene/treeSpecies'
import { buildShareSearch, parseShareParams, type AppMode, type InkStyle, type ShareState } from '../share/params'
import { isWrapped, wrapSecret } from '../share/secret'

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

function bootPayload(initial: ShareState): string {
  return initial.url || defaultPayload()
}

export function useTreeState() {
  const initial = parseShareParams(window.location.search)
  const startPayload = bootPayload(initial)
  const startLocked = initial.locked || isWrapped(startPayload)
  const startMode: AppMode = initial.mode === 'reveal' || startLocked ? 'reveal' : 'create'
  const [mode, setMode] = useState<AppMode>(startMode)
  const [url, setUrl] = useState(startLocked ? defaultPayload() : startPayload)
  const [password, setPassword] = useState('')
  const [payload, setPayload] = useState(startPayload)
  const [locked, setLocked] = useState(startLocked)
  const [season, setSeason] = useState<Season>(initial.season)
  const [tree, setTree] = useState<TreeSpecies>(initial.tree)
  const [ink, setInk] = useState<InkStyle>(initial.ink)
  const [muted, setMuted] = useState(true)
  const [rain, setRain] = useState(false)
  const [overhead, setOverhead] = useState(false)
  const [error, setError] = useState<string | null>(payloadError(startLocked ? defaultPayload() : startPayload))
  const [grid, setGrid] = useState<ModuleGrid>(() => encodeGrid(startPayload))
  const [webgl] = useState(detectWebgl)
  const [reduced, setReduced] = useState(prefersReducedMotion)
  const [colors, setColors] = useState<SceneColors>(() => colorsOf(initial.season, initial.tree))

  const scene = useRef<SceneState>({
    colors: colorsOf(initial.season, initial.tree),
    season: initial.season,
    yaw: VIEW_YAW,
    pitch: VIEW_PITCH,
    spinYaw: 0,
    spinPitch: 0,
    dragging: false,
    pitchTarget: null,
    yawTarget: null,
    zoom: 1,
    zoomTarget: null,
    inkMix: 0,
  })

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (mode !== 'create') return
    const message = payloadError(url)
    setError(message)
    if (message) return
    let cancelled = false
    const handle = window.setTimeout(() => {
      void (async () => {
        const plain = normalizePayload(url)
        try {
          const next = password.trim() ? await wrapSecret(plain, password) : plain
          if (cancelled) return
          setPayload(next)
          setLocked(isWrapped(next))
          setGrid(encodeGrid(next))
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Could not lock the URL')
        }
      })()
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [url, password, mode])

  useEffect(() => {
    if (mode !== 'reveal') return
    setError(null)
    setGrid(encodeGrid(payload || defaultPayload()))
  }, [mode, payload])

  useEffect(() => {
    const search = buildShareSearch({ url: payload, season, tree, locked, mode, ink })
    const next = `${window.location.pathname}${search}`
    if (`${window.location.pathname}${window.location.search}` !== next) {
      history.replaceState(null, '', next)
    }
  }, [payload, season, tree, locked, mode, ink])

  useEffect(() => {
    const target = colorsOf(season, tree)
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
  }, [season, tree, reduced])

  useEffect(() => {
    setAmbienceSeason(season)
  }, [season])

  useEffect(() => {
    setAmbienceRain(rain)
  }, [rain])

  const toggleView = useCallback(() => {
    const state = scene.current
    const heading = state.pitchTarget !== null ? state.pitchTarget : state.pitch
    const up = state.pitchTarget === OVERHEAD || (state.pitchTarget === null && isOverhead(heading))
    state.pitchTarget = up ? VIEW_PITCH : OVERHEAD
    state.yawTarget = up ? null : squareYaw(state.yaw)
    if (!up) state.zoomTarget = 1
    state.spinYaw = 0
    state.spinPitch = 0
  }, [])

  const toggleRain = useCallback(() => setRain((value) => !value), [])

  const toggleMuted = useCallback(() => {
    setMuted((value) => {
      const next = !value
      setAmbienceMuted(next)
      return next
    })
  }, [])

  const applyShareState = useCallback((next: ShareState) => {
    const nextPayload = next.url || defaultPayload()
    const nextLocked = next.locked || isWrapped(next.url)
    setMode('reveal')
    setPayload(nextPayload)
    setLocked(nextLocked)
    setPassword('')
    setUrl(nextLocked ? defaultPayload() : nextPayload)
    setSeason(next.season)
    setTree(next.tree)
    setInk(next.ink)
    const cam = scene.current
    cam.pitch = VIEW_PITCH
    cam.yaw = VIEW_YAW
    cam.pitchTarget = null
    cam.yawTarget = null
    cam.spinYaw = 0
    cam.spinPitch = 0
    cam.zoom = 1
    cam.zoomTarget = null
    setOverhead(false)
  }, [])

  const changeMode = useCallback((next: AppMode) => {
    setMode(next)
    if (next === 'create' && isWrapped(payload)) {
      setUrl(defaultPayload())
      setPassword('')
      setLocked(false)
    }
  }, [payload])

  return {
    mode,
    setMode: changeMode,
    url,
    setUrl,
    password,
    setPassword,
    payload,
    locked,
    season,
    setSeason,
    tree,
    setTree,
    ink,
    setInk,
    muted,
    toggleMuted,
    rain,
    toggleRain,
    overhead,
    setOverhead,
    toggleView,
    error,
    grid,
    colors,
    scene,
    webgl,
    reduced,
    applyShareState,
  }
}
