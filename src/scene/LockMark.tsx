import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Group, MeshBasicMaterial } from 'three'
import { vegetationTexture } from './leafTexture'
import { mixHex } from './palettes'
import type { SceneRef } from './sceneState'
import { growScaleY, plantInkOpacity, sceneryOpacity } from './view'

const VINE_COUNT = 5
const tint = new Color()

/**
 * Side-view lock charm on the bole. Fades with scenery so it never becomes
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
  const mats = useRef<MeshBasicMaterial[]>([])
  const vineMap = useMemo(() => vegetationTexture('blade', 'shaded'), [])
  const vines = useMemo(() => {
    return Array.from({ length: VINE_COUNT }, (_, index) => {
      const turn = (index / VINE_COUNT) * Math.PI * 2
      const lift = 0.22 + (index / (VINE_COUNT - 1)) * Math.max(0.4, height * 0.55)
      return {
        position: [Math.sin(turn) * 0.22, lift, Math.cos(turn) * 0.22] as const,
        rotation: [0.18, turn, 0.35] as const,
        scale: [0.09, 0.55 + (index % 2) * 0.12, 1] as const,
      }
    })
  }, [height])

  useLayoutEffect(() => {
    mats.current = []
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
    tint.set(mixHex(colors.finder, colors.grass, 0.28))
    for (const mat of mats.current) {
      mat.color.copy(tint)
      mat.opacity = opacity * 0.9
      mat.transparent = true
      mat.depthWrite = false
    }
  })

  if (!locked) return null

  const bind = (mat: MeshBasicMaterial | null) => {
    if (!mat || mats.current.includes(mat)) return
    mats.current.push(mat)
  }

  const lockY = Math.max(0.55, height * 0.42)

  return (
    <group ref={root}>
      {vines.map((vine, index) => (
        <mesh key={index} position={[...vine.position]} rotation={[...vine.rotation]} scale={[...vine.scale]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            ref={bind}
            map={vineMap}
            color="#5a7a3a"
            transparent
            alphaTest={0.35}
            depthWrite={false}
            side={2}
          />
        </mesh>
      ))}
      <group position={[0, lockY, 0.34]} scale={0.42}>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.34, 0.28, 0.12]} />
          <meshBasicMaterial ref={bind} color="#4a6a32" transparent depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.11, 0.03, 8, 18, Math.PI]} />
          <meshBasicMaterial ref={bind} color="#4a6a32" transparent depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}
