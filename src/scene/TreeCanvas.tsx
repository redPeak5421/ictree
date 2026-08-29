import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { Canvas } from '@react-three/fiber'
import { NoToneMapping } from 'three'
import type { ModuleGrid } from '../qr/types'
import { OrbitCamera } from './camera'
import { Grass } from './grass'
import { Ground } from './ground'
import { applyDrag, SNAP_PITCH, TAP_SLOP } from './orbit'
import { Particles } from './particles/Particles'
import type { SceneRef } from './sceneState'
import { TreeFoliage } from './TreeFoliage'
import { hashString } from './hash'
import type { PaletteId, Season } from './palettes'
import { buildTree, islandExtent } from './tree'
import { resolveTreeChoice } from './treeSpecies'
import { OVERHEAD, squareYaw } from './view'

interface Pointer {
  id: number
  x: number
  y: number
  /** Time of the last movement, ms. */
  at: number
  /** When it went down, ms. */
  start: number
  moved: boolean
}

/** A pointer that lifts later than this after its last move leaves no spin. */
const FLICK_MS = 80
/** Longer than this between down and up is a hold, not a tap. */
const TAP_MS = 600

export function TreeCanvas({
  grid,
  palette,
  season,
  scene,
  reduced,
  onToggle,
  onOverhead,
}: {
  grid: ModuleGrid
  palette: PaletteId
  season: Season
  scene: SceneRef
  reduced: boolean
  onToggle: () => void
  onOverhead: (overhead: boolean) => void
}) {
  const island = islandExtent(grid.size)
  const choice = resolveTreeChoice(grid.payload, palette)
  const rig = useMemo(
    () => buildTree(grid, hashString(grid.payload), choice),
    [grid, choice.species, choice.habit],
  )
  const bg = scene.current.colors.bg
  const pointer = useRef<Pointer | null>(null)
  const [grabbing, setGrabbing] = useState(false)

  // One pointer at a time: a drag turns the island, a tap glides the camera
  // overhead and back. Touch is the same path — the canvas has touch-action:
  // none.
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (pointer.current) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const now = performance.now()
    pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, at: now, start: now, moved: false }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // A pointer that is already gone (or synthetic) cannot be captured; the
      // drag still works, it just ends if the pointer leaves the stage.
    }
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const p = pointer.current
    if (!p || p.id !== e.pointerId) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (!p.moved) {
      if (Math.hypot(dx, dy) < TAP_SLOP) return
      p.moved = true
      scene.current.dragging = true
      scene.current.pitchTarget = null
      scene.current.yawTarget = null
      setGrabbing(true)
    }
    const now = performance.now()
    applyDrag(scene.current, dx, dy, (now - p.at) / 1000)
    p.x = e.clientX
    p.y = e.clientY
    p.at = now
  }
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const p = pointer.current
    if (!p || p.id !== e.pointerId) return
    pointer.current = null
    const now = performance.now()
    if (p.moved) {
      // Holding still before letting go means "stop here", not "keep turning".
      if (now - p.at > FLICK_MS) {
        scene.current.spinYaw = 0
        scene.current.spinPitch = 0
      }
      // Nearly overhead is the one place "nearly" is not good enough: the
      // leaves only line up as the code from straight down, so settle there.
      if (scene.current.pitch > SNAP_PITCH) {
        scene.current.pitchTarget = OVERHEAD
        scene.current.yawTarget = squareYaw(scene.current.yaw)
        scene.current.spinPitch = 0
        scene.current.spinYaw = 0
      }
      scene.current.dragging = false
      setGrabbing(false)
    } else if (e.type !== 'pointercancel' && now - p.start < TAP_MS) {
      onToggle()
    }
  }

  return (
    <Canvas
      className={grabbing ? 'tree-canvas grabbing' : 'tree-canvas'}
      orthographic
      camera={{ position: [island, island, island], near: 0.1, far: 500 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.setClearColor(bg, 1)
        gl.toneMapping = NoToneMapping
        gl.domElement.setAttribute('data-grove-canvas', '')
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <color attach="background" args={[bg]} />
      <hemisphereLight args={['#fff6ea', '#a89f93', 1.25]} />
      <directionalLight position={[island, island * 1.4, island * 0.6]} intensity={0.55} />
      <OrbitCamera
        scene={scene}
        island={island}
        qrSpan={grid.size}
        crownTop={rig.crownTop}
        reduced={reduced}
        onOverhead={onOverhead}
      />
      <Ground grid={grid} rig={rig} scene={scene} />
      <Grass grid={grid} scene={scene} reduced={reduced} season={season} palette={palette} />
      <TreeFoliage rig={rig} scene={scene} palette={palette} season={season} />
      <Particles grid={grid} scene={scene} reduced={reduced} />
    </Canvas>
  )
}
