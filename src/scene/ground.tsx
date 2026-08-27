import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, MeshBasicMaterial, Object3D } from 'three'
import { toLumaHex } from '../qr/contrast'
import type { ModuleGrid } from '../qr/types'
import { mixHex } from './palettes'
import type { SceneRef } from './sceneState'
import { islandExtent, MOUND_H, MOUND_R, SLAB_H, type TreeRig } from './tree'
import { leafTexture, moundTexture } from './leafTexture'
import { moundGeometry } from './moundGeometry'
import { mulberry32 } from './hash'
import { sceneryOpacity } from './view'

const dummy = new Object3D()
const tint = new Color()

const LITTER = 38
const CREAM = '#f2efe6'

/**
 * A plain paved island: one flat, uniform top and a darker slab side, with no
 * trace of the code in the stone — from the side there is a tree and four
 * patches of grass, nothing more. The grass is a turf mound on every dark
 * corner module; its top is the finder patterns' ink from straight above.
 */
export function Ground({ grid, rig, scene }: { grid: ModuleGrid; rig: TreeRig; scene: SceneRef }) {
  const topMat = useRef<MeshBasicMaterial>(null)
  const sideMat = useRef<MeshBasicMaterial>(null)
  const litter = useRef<InstancedMesh>(null)
  const litterMat = useRef<MeshBasicMaterial>(null)
  const mounds = useRef<InstancedMesh>(null)
  const island = islandExtent(grid.size)
  const key = useRef('')
  const map = useMemo(() => leafTexture(), [])
  const shade = useMemo(() => moundTexture(), [])
  const dome = useMemo(() => moundGeometry(), [])

  const fallen = useMemo(() => {
    const rng = mulberry32(grid.size * 7919 + 13)
    return Array.from({ length: LITTER }, () => ({
      x: (rng() * 2 - 1) * (grid.size / 2),
      z: (rng() * 2 - 1) * (grid.size / 2),
      rot: rng() * Math.PI * 2,
      scale: 0.4 + rng() * 0.3,
    }))
  }, [grid.size])

  useLayoutEffect(() => {
    const inst = litter.current
    if (!inst) return
    fallen.forEach((leaf, i) => {
      dummy.position.set(leaf.x, 0.03, leaf.z)
      dummy.rotation.set(-Math.PI / 2, 0, leaf.rot)
      dummy.scale.setScalar(leaf.scale)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    })
    inst.instanceMatrix.needsUpdate = true
  }, [fallen])

  useLayoutEffect(() => {
    const turf = mounds.current
    if (!turf) return
    dummy.rotation.set(0, 0, 0)
    // The rounded-square dome, squashed low, its equator at the paving.
    dummy.scale.set(MOUND_R, MOUND_H, MOUND_R)
    rig.lawns.forEach((lawn, i) => {
      dummy.position.set(lawn.cell[0], 0, lawn.cell[1])
      dummy.updateMatrix()
      turf.setMatrixAt(i, dummy.matrix)
    })
    turf.instanceMatrix.needsUpdate = true
    key.current = ''
  }, [rig])

  useFrame(() => {
    const { colors, season, pitch } = scene.current
    const next = `${colors.pathLight}|${colors.pathEdge}|${colors.grass}|${colors.grassTip}`
    if (next !== key.current) {
      key.current = next
      // Paving sits well above any ink, so from overhead it is the code's
      // light modules whatever the season.
      topMat.current?.color.set(mixHex(colors.pathLight, CREAM, 0.55))
      sideMat.current?.color.set(mixHex(colors.pathEdge, '#8d8a83', 0.45))
      const turf = mounds.current
      if (turf) {
        // Turf lands khaki, as in the reference, so the code's corners read
        // as grass rather than as more leaves; luma is pinned per module.
        const tones = [
          colors.grass,
          mixHex(colors.grass, colors.grassTip, 0.35),
          mixHex(colors.grass, colors.grassTip, 0.7),
          colors.grassTip,
        ]
        rig.lawns.forEach((lawn, i) => {
          tint.set(toLumaHex(mixHex(tones[lawn.tone]!, '#c9ad4a', 0.55), lawn.ink))
          turf.setColorAt(i, tint)
        })
        if (turf.instanceColor) turf.instanceColor.needsUpdate = true
      }
    }
    const mat = litterMat.current
    if (mat) {
      mat.color.set(season === 'spring' ? colors.accent : colors.foliage)
      const opacity = sceneryOpacity(pitch)
      mat.opacity = opacity
      mat.visible = opacity > 0.01
    }
  })

  return (
    <group>
      <mesh position={[0, -SLAB_H / 2 - 0.01, 0]}>
        <boxGeometry args={[island, SLAB_H, island]} />
        <meshBasicMaterial ref={sideMat} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[island, island]} />
        <meshBasicMaterial ref={topMat} />
      </mesh>
      <instancedMesh
        ref={mounds}
        args={[undefined, undefined, rig.lawns.length]}
        key={`g${rig.lawns.length}`}
        frustumCulled={false}
      >
        <primitive object={dome} attach="geometry" />
        <meshBasicMaterial map={shade} />
      </instancedMesh>
      <instancedMesh ref={litter} args={[undefined, undefined, LITTER]} frustumCulled={false}>
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
