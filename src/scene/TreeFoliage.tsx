import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, Object3D, type Texture } from 'three'
import { toLumaHex } from '../qr/contrast'
import { bladeTexture, leafTexture, mapleTexture } from './leafTexture'
import { foliageTones, mixHex, type SceneColors } from './palettes'
import type { SceneRef } from './sceneState'
import type { LeafInstance, TreeRig } from './tree'

const dummy = new Object3D()
const tint = new Color()

/** Width of a grass blade at scale 1, in modules. */
export const BLADE_W = 0.22

interface Groups {
  ovate: LeafInstance[]
  maple: LeafInstance[]
  blade: LeafInstance[]
}

function grassTones(colors: SceneColors): string[] {
  return [
    colors.grass,
    mixHex(colors.grass, colors.grassTip, 0.35),
    mixHex(colors.grass, colors.grassTip, 0.7),
    colors.grassTip,
  ]
}

/**
 * The canopy and the corner grass are static geometry: every matrix is
 * written once per rig and every colour once per palette. Nothing here faces
 * the camera — it is one object, seen from wherever the camera is.
 */
export function TreeFoliage({ rig, scene }: { rig: TreeRig; scene: SceneRef }) {
  const branchRef = useRef<InstancedMesh>(null)
  const ovateRef = useRef<InstancedMesh>(null)
  const mapleRef = useRef<InstancedMesh>(null)
  const bladeRef = useRef<InstancedMesh>(null)
  const leafMap = useMemo(() => leafTexture(), [])
  const mapleMap = useMemo(() => mapleTexture(), [])
  const bladeMap = useMemo(() => bladeTexture('flat'), [])
  const colorKey = useRef('')

  const groups = useMemo<Groups>(
    () => ({
      ovate: rig.leaves.filter((l) => l.kind === 'leaf' && l.shape === 'ovate'),
      maple: rig.leaves.filter((l) => l.kind === 'leaf' && l.shape === 'maple'),
      blade: rig.leaves.filter((l) => l.kind === 'blade'),
    }),
    [rig],
  )

  useLayoutEffect(() => {
    const branches = branchRef.current
    if (branches) {
      rig.branches.forEach((branch, i) => {
        dummy.position.set(branch.position[0], branch.position[1], branch.position[2])
        dummy.quaternion.set(
          branch.quaternion[0],
          branch.quaternion[1],
          branch.quaternion[2],
          branch.quaternion[3],
        )
        dummy.scale.set(branch.scale[0], branch.scale[1], branch.scale[2])
        dummy.updateMatrix()
        branches.setMatrixAt(i, dummy.matrix)
      })
      branches.instanceMatrix.needsUpdate = true
    }
    for (const [mesh, items] of [
      [ovateRef.current, groups.ovate],
      [mapleRef.current, groups.maple],
      [bladeRef.current, groups.blade],
    ] as const) {
      if (!mesh) continue
      items.forEach((leaf, i) => {
        dummy.position.set(leaf.position[0], leaf.position[1], leaf.position[2])
        dummy.rotation.set(leaf.euler[0], leaf.euler[1], leaf.euler[2], 'YXZ')
        dummy.scale.setScalar(leaf.scale)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }
    colorKey.current = ''
  }, [rig, groups])

  useFrame(() => {
    const { colors } = scene.current

    const next = `${colors.foliage}|${colors.foliageVar}|${colors.accent}|${colors.trunk}|${colors.grass}|${colors.grassTip}`
    if (next !== colorKey.current) {
      colorKey.current = next
      const branches = branchRef.current
      if (branches) {
        const bark = colors.trunk
        const limb = mixHex(bark, '#8a6f55', 0.35)
        rig.branches.forEach((branch, i) => {
          tint.set(branch.shade === 0 ? bark : limb)
          branches.setColorAt(i, tint)
        })
        if (branches.instanceColor) branches.instanceColor.needsUpdate = true
      }
      // Every leaf sits at its module's ink luma, differing from its
      // neighbours only in hue: that is what makes a module one flat block
      // to a decoder and a leaf mosaic to a person.
      const tones = foliageTones(colors)
      const inkCache = new Map<string, Color>()
      for (const [mesh, items] of [
        [ovateRef.current, groups.ovate],
        [mapleRef.current, groups.maple],
      ] as const) {
        if (!mesh) continue
        items.forEach((leaf, i) => {
          const key = `${leaf.tone}|${leaf.ink}`
          let ink = inkCache.get(key)
          if (!ink) {
            ink = new Color(toLumaHex(tones[leaf.tone]!, leaf.ink))
            inkCache.set(key, ink)
          }
          mesh.setColorAt(i, ink)
        })
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      }
      const blades = bladeRef.current
      if (blades) {
        // Blades are ink from above, like the turf they stand in: pinned to
        // the module's luma, greener than the turf only in hue. Anything
        // brighter reads as a hole in the finder to a block binarizer.
        const grass = grassTones(colors)
        const bladeCache = new Map<string, Color>()
        groups.blade.forEach((leaf, i) => {
          const key = `${leaf.tone}|${leaf.ink}`
          let tint = bladeCache.get(key)
          if (!tint) {
            tint = new Color(toLumaHex(grass[leaf.tone]!, leaf.ink + 0.02))
            bladeCache.set(key, tint)
          }
          blades.setColorAt(i, tint)
        })
        if (blades.instanceColor) blades.instanceColor.needsUpdate = true
      }
    }
  })

  const cutout = (map: Texture) => (
    // alphaTest without transparency keeps depth writes, so instances occlude
    // each other correctly instead of sorting by draw order.
    <meshBasicMaterial map={map} alphaTest={0.42} side={2} />
  )

  return (
    <group>
      <instancedMesh
        ref={branchRef}
        args={[undefined, undefined, rig.branches.length]}
        key={`b${rig.branches.length}`}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.9, 1, 1, 8]} />
        {/* Unlit on purpose: a lit cylinder shades dark along its sides, and
            from overhead those two dark lines along every twig would cut
            through the light modules. Flat pale wood reads as light
            everywhere a decoder looks. */}
        <meshBasicMaterial />
      </instancedMesh>
      <instancedMesh
        ref={ovateRef}
        args={[undefined, undefined, groups.ovate.length]}
        key={`o${groups.ovate.length}`}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        {cutout(leafMap)}
      </instancedMesh>
      <instancedMesh
        ref={mapleRef}
        args={[undefined, undefined, groups.maple.length]}
        key={`m${groups.maple.length}`}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        {cutout(mapleMap)}
      </instancedMesh>
      <instancedMesh
        ref={bladeRef}
        args={[undefined, undefined, groups.blade.length]}
        key={`t${groups.blade.length}`}
        frustumCulled={false}
      >
        <planeGeometry args={[BLADE_W, 1]} />
        {cutout(bladeMap)}
      </instancedMesh>
    </group>
  )
}
