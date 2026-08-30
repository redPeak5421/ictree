import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, MeshBasicMaterial, Object3D } from 'three'
import type { ModuleGrid } from '../qr/types'
import { buildGroundLitter } from './grassLayout'
import { hashString } from './hash'
import { foliageTones, mixHex } from './palettes'
import type { SceneRef } from './sceneState'
import { islandExtent, SLAB_H, type TreeRig } from './tree'
import { leafTexture } from './leafTexture'
import { plantInkOpacity, sceneryOpacity } from './view'

const dummy = new Object3D()
const tint = new Color()

const CREAM = '#f2efe6'

/**
 * A paved island on a darker earth plinth. Finder ink lives in the grass,
 * not in the stone.
 */
export function Ground({ grid, rig, scene }: { grid: ModuleGrid; rig: TreeRig; scene: SceneRef }) {
  const topMat = useRef<MeshBasicMaterial>(null)
  const sideMat = useRef<MeshBasicMaterial>(null)
  const plinthMat = useRef<MeshBasicMaterial>(null)
  const litter = useRef<InstancedMesh>(null)
  const litterMat = useRef<MeshBasicMaterial>(null)
  const island = islandExtent(grid.size)
  const key = useRef('')
  const litterKey = useRef('')
  const map = useMemo(() => leafTexture(rig.species), [rig.species])

  const fallen = useMemo(() => {
    return buildGroundLitter(grid, hashString(grid.payload), rig.species)
  }, [grid, rig.species])

  useLayoutEffect(() => {
    const inst = litter.current
    if (!inst) return
    fallen.forEach((leaf, i) => {
      dummy.position.set(leaf.position[0], 0.03, leaf.position[1])
      dummy.rotation.set(-Math.PI / 2, 0, leaf.rotation)
      dummy.scale.setScalar(leaf.scale)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    })
    inst.instanceMatrix.needsUpdate = true
    litterKey.current = ''
  }, [fallen])

  useFrame(() => {
    const { colors, pitch, inkMix } = scene.current
    const next = `${colors.pathLight}|${colors.pathEdge}|${colors.grass}|${colors.grassTip}`
    if (next !== key.current) {
      key.current = next
      topMat.current?.color.set(mixHex(colors.pathLight, CREAM, 0.55))
      sideMat.current?.color.set(mixHex(colors.pathEdge, '#8d8a83', 0.45))
      plinthMat.current?.color.set(mixHex(colors.pathEdge, '#6f6a62', 0.62))
    }
    const nextLitter = `${colors.foliage}|${colors.foliageVar}|${colors.accent}`
    if (nextLitter !== litterKey.current) {
      litterKey.current = nextLitter
      const inst = litter.current
      if (inst) {
        const tones = foliageTones(colors)
        fallen.forEach((leaf, i) => {
          tint.set(tones[leaf.tone]!)
          inst.setColorAt(i, tint)
        })
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true
      }
    }
    const mat = litterMat.current
    if (mat) {
      mat.color.set('#ffffff')
      const opacity = sceneryOpacity(pitch) * plantInkOpacity(inkMix)
      mat.opacity = opacity
      mat.visible = opacity > 0.01
    }
  })

  return (
    <group>
      <mesh position={[0, -SLAB_H / 2 - 0.16, 0]}>
        <boxGeometry args={[island + 0.7, SLAB_H + 0.22, island + 0.7]} />
        <meshBasicMaterial ref={plinthMat} />
      </mesh>
      <mesh position={[0, -SLAB_H / 2 - 0.01, 0]}>
        <boxGeometry args={[island, SLAB_H, island]} />
        <meshBasicMaterial ref={sideMat} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[island, island]} />
        <meshBasicMaterial ref={topMat} />
      </mesh>
      <instancedMesh
        ref={litter}
        args={[undefined, undefined, fallen.length]}
        key={`l${rig.species}:${fallen.length}`}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={litterMat}
          map={map}
          transparent
          alphaTest={0.4}
          depthWrite={false}
          side={2}
        />
      </instancedMesh>
    </group>
  )
}
