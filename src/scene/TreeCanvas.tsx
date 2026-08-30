import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Group, MeshBasicMaterial, NoToneMapping } from 'three'
import type { ModuleGrid } from '../qr/types'
import { OrbitCamera } from './camera'
import { Grass } from './grass'
import { Ground } from './ground'
import { applyDrag, applyZoom, SNAP_PITCH, TAP_SLOP, wheelZoomFactor } from './orbit'
import { Particles } from './particles/Particles'
import { QrTiles } from './QrTiles'
import type { SceneRef } from './sceneState'
import { TreeFoliage } from './TreeFoliage'
import { hashString } from './hash'
import type { Season } from './palettes'
import { buildTree, islandExtent } from './tree'
import { resolveTreeChoice, type TreeSpecies } from './treeSpecies'
import { OVERHEAD, blockInkOpacity, inkMixTarget, plantInkOpacity, stepInkMix, squareYaw } from './view'
import type { InkStyle } from '../share/params'

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

function fadeGroup(group: Group | null, opacity: number, flatten: number) {
  if (!group) return
  group.visible = opacity > 0.012
  const settle = flatten > 0 ? 1 - (1 - opacity) * flatten : 1
  group.scale.set(1, settle, 1)
  group.traverse((obj) => {
    const mat = (obj as { material?: MeshBasicMaterial | MeshBasicMaterial[] }).material
    if (!mat) return
    const list = Array.isArray(mat) ? mat : [mat]
    for (const item of list) {
      if (!('opacity' in item)) continue
      item.transparent = true
      item.opacity = opacity
      item.depthWrite = opacity > 0.88
      if ('alphaTest' in item) {
        const cut = (item.userData.cut as number | undefined) ?? item.alphaTest
        if (cut > 0) {
          item.userData.cut = cut
          item.alphaTest = cut * (0.25 + 0.75 * opacity)
        }
      }
    }
  })
}

/**
 * Same camera-led conversion as the plant grove: mix follows pitch, so a
 * tap to overhead does not swap the tree for tiles before the view turns.
 */
function InkDissolve({
  scene,
  ink,
  reduced,
  plants,
  tiles,
}: {
  scene: SceneRef
  ink: InkStyle
  reduced: boolean
  plants: ReactNode
  tiles: ReactNode
}) {
  const plantRef = useRef<Group>(null)
  const tileRef = useRef<Group>(null)
  useEffect(() => () => {
    scene.current.inkMix = 0
  }, [scene])
  useFrame((_, dt) => {
    const state = scene.current
    const target = inkMixTarget(ink === 'blocks', state.pitch)
    state.inkMix = stepInkMix(state.inkMix, target, Math.min(dt, 0.05), reduced)
    fadeGroup(plantRef.current, plantInkOpacity(state.inkMix), 0)
    fadeGroup(tileRef.current, blockInkOpacity(state.inkMix), 0)
  })
  return (
    <>
      <group ref={plantRef}>{plants}</group>
      <group ref={tileRef}>{tiles}</group>
    </>
  )
}


export function TreeCanvas({
  grid,
  tree,
  season,
  scene,
  reduced,
  rain,
  ink,
  onToggle,
  onOverhead,
}: {
  grid: ModuleGrid
  tree: TreeSpecies
  rain: boolean
  season: Season
  scene: SceneRef
  reduced: boolean
  ink: InkStyle
  onToggle: () => void
  onOverhead: (overhead: boolean) => void
}) {
  const island = islandExtent(grid.size)
  const choice = resolveTreeChoice(grid.payload, tree)
  const rig = useMemo(
    () => buildTree(grid, hashString(grid.payload), choice),
    [grid, choice.species, choice.habit],
  )
  const bg = scene.current.colors.bg
  const pointer = useRef<Pointer | null>(null)
  /** Every pointer currently down, for pinch-to-zoom. */
  const touches = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)
  const [grabbing, setGrabbing] = useState(false)
  const host = useRef<HTMLCanvasElement | null>(null)

  // Wheel zoom must be a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const el = host.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const state = scene.current
      state.zoomTarget = null
      state.zoom = applyZoom(state.zoom, wheelZoomFactor(e.deltaY))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [scene])

  const pinchDistance = () => {
    const [a, b] = [...touches.current.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }

  // One pointer at a time: a drag turns the island, a tap glides the camera
  // overhead and back. Touch is the same path — the canvas has touch-action:
  // none.
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (touches.current.size === 2) {
      // Two fingers: the drag ends and a pinch begins.
      pointer.current = null
      scene.current.dragging = false
      scene.current.spinYaw = 0
      scene.current.spinPitch = 0
      scene.current.zoomTarget = null
      pinch.current = { dist: pinchDistance(), zoom: scene.current.zoom }
      setGrabbing(false)
      return
    }
    if (pointer.current || touches.current.size > 2) return
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
    if (touches.current.has(e.pointerId)) touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pinching = pinch.current
    if (pinching && touches.current.size >= 2) {
      const dist = pinchDistance()
      if (pinching.dist > 1) scene.current.zoom = applyZoom(pinching.zoom, dist / pinching.dist)
      return
    }
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
    touches.current.delete(e.pointerId)
    if (pinch.current) {
      if (touches.current.size < 2) pinch.current = null
      return
    }
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
      ref={host}
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
      {ink === 'blocks' ? (
        <InkDissolve
          scene={scene}
          ink={ink}
          reduced={reduced}
          plants={
            <>
              <Grass grid={grid} scene={scene} reduced={reduced} season={season} tree={tree} />
              <TreeFoliage rig={rig} scene={scene} tree={tree} season={season} />
            </>
          }
          tiles={<QrTiles grid={grid} scene={scene} rig={rig} />}
        />
      ) : (
        <>
          <Grass grid={grid} scene={scene} reduced={reduced} season={season} tree={tree} />
          <TreeFoliage rig={rig} scene={scene} tree={tree} season={season} />
        </>
      )}
      <Particles grid={grid} scene={scene} reduced={reduced} species={rig.species} raining={rain} />
    </Canvas>
  )
}
