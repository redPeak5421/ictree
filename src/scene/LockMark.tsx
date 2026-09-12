import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Group, MeshBasicMaterial } from 'three'
import { vegetationTexture } from './leafTexture'
import { mixHex } from './palettes'
import type { SceneRef } from './sceneState'
import { growScaleY, plantInkOpacity, sceneryOpacity } from './view'

const VINE_COUNT = 4
const LOCK_HEX = '#c4783a'
const tint = new Color()
const lockTint = new Color()

/**
 * Side-view lock on the bole. Fades with scenery so it never becomes
 * overhead ink, and rides the same grow scale as the living crown.
 */
export function LockMark({
  scene,
  locked,
  height,
}: {
  scene: SceneRef
  locked: boolean
  height: number
}) {
  const root = useRef<Group>(null)
  const vineMats = useRef<MeshBasicMaterial[]>([])
  const lockMats = useRef<MeshBasicMaterial[]>([])
  const vineMap = useMemo(() => vegetationTexture('blade', 'shaded'), [])
  const vines = useMemo(() => {
    return Array.from({ length: VINE_COUNT }, (_, index) => {
      const turn = (index / VINE_COUNT) * Math.PI * 2 + 0.4
      const lift = 0.28 + (index / Math.max(1, VINE_COUNT - 1)) * 0.7
      return {
        position: [Math.sin(turn) * 0.28, lift, Math.cos(turn) * 0.28] as const,
        rotation: [0.35, turn, 0.2] as const,
        scale: [0.16, 0.85 + (index % 2) * 0.18, 1] as const,
      }
    })
  }, [])

  useLayoutEffect(() => {
    vineMats.current = []
    lockMats.current = []
  }, [height, locked])

  useFrame(() => {
    const group = root.current
    if (!group) return
    const { pitch, inkMix, yaw, colors, grow } = scene.current
    const opacity = sceneryOpacity(pitch) * plantInkOpacity(inkMix)
    group.visible = locked && opacity > 0.02
    if (!group.visible) return
    group.scale.set(1, growScaleY(grow), 1)
    group.rotation.y = yaw
    tint.set(mixHex(colors.finder, colors.grass, 0.35))
    lockTint.set(mixHex(LOCK_HEX, colors.accent, 0.22))
    for (const mat of vineMats.current) {
      mat.color.copy(tint)
      mat.opacity = opacity * 0.85
      mat.transparent = true
      mat.depthWrite = false
    }
    for (const mat of lockMats.current) {
      mat.color.copy(lockTint)
      mat.opacity = opacity
      mat.transparent = true
      mat.depthWrite = false
    }
  })

  if (!locked) return null

  const bindVine = (mat: MeshBasicMaterial | null) => {
    if (!mat || vineMats.current.includes(mat)) return
    vineMats.current.push(mat)
  }
  const bindLock = (mat: MeshBasicMaterial | null) => {
    if (!mat || lockMats.current.includes(mat)) return
    lockMats.current.push(mat)
  }

  // Sit on the pale bole, below hanging canopy, so a side view can see it.
  const lockY = Math.min(0.78, Math.max(0.58, height * 0.22))

  return (
    <group ref={root}>
      {vines.map((vine, index) => (
        <mesh key={index} position={[...vine.position]} rotation={[...vine.rotation]} scale={[...vine.scale]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            ref={bindVine}
            map={vineMap}
            color="#5a7a3a"
            transparent
            alphaTest={0.35}
            depthWrite={false}
            side={2}
          />
        </mesh>
      ))}
      <group position={[0, lockY, 0.62]} scale={1.55}>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.38, 0.3, 0.14]} />
          <meshBasicMaterial ref={bindLock} color={LOCK_HEX} transparent depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.12, 0.035, 8, 18, Math.PI]} />
          <meshBasicMaterial ref={bindLock} color={LOCK_HEX} transparent depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}
