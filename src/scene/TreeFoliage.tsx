import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, Object3D, type Texture } from 'three'
import { toLumaHex } from '../qr/contrast'
import type { FinderCarpetInstance, FinderVegetationInstance } from './grassLayout'
import { carpetTexture, leafTexture, vegetationTexture } from './leafTexture'
import type { LeafShape } from './leafShape'
import { foliageTones, mixHex, type SceneColors } from './palettes'
import type { SceneRef } from './sceneState'
import type { FillerInstance, LeafInstance, TreeRig } from './tree'
import { branchTones } from './treeAppearance'

const dummy = new Object3D()
const tint = new Color()

interface Groups {
  leaves: Record<LeafShape, LeafInstance[]>
  finder: {
    blade: FinderVegetationInstance[]
    broad: FinderVegetationInstance[]
    carpet: FinderCarpetInstance[]
  }
  filler: {
    ovate: FillerInstance[]
    detail: FillerInstance[]
  }
}

function grassTones(colors: SceneColors): string[] {
  return [
    colors.grass,
    mixHex(colors.grass, colors.grassTip, 0.35),
    mixHex(colors.grass, colors.grassTip, 0.7),
    colors.grassTip,
  ]
}

/** Static canopy and QR-critical corner vegetation. Nothing faces the camera. */
export function TreeFoliage({ rig, scene }: { rig: TreeRig; scene: SceneRef }) {
  const branchRef = useRef<InstancedMesh>(null)
  const ovateRef = useRef<InstancedMesh>(null)
  const oakRef = useRef<InstancedMesh>(null)
  const mapleRef = useRef<InstancedMesh>(null)
  const cherryRef = useRef<InstancedMesh>(null)
  const finderBladeRef = useRef<InstancedMesh>(null)
  const finderBroadRef = useRef<InstancedMesh>(null)
  const finderCarpetRef = useRef<InstancedMesh>(null)
  const fillerOvateRef = useRef<InstancedMesh>(null)
  const fillerDetailRef = useRef<InstancedMesh>(null)
  const ovateMap = useMemo(() => leafTexture('ovate'), [])
  const oakMap = useMemo(() => leafTexture('oak'), [])
  const mapleMap = useMemo(() => leafTexture('maple'), [])
  const cherryMap = useMemo(() => leafTexture('cherry'), [])
  const finderBladeMap = useMemo(() => vegetationTexture('blade', 'flat'), [])
  const finderBroadMap = useMemo(() => vegetationTexture('broad', 'flat'), [])
  const carpetMap = useMemo(() => carpetTexture(), [])
  const detailMap = rig.species === 'oak' ? oakMap : rig.species === 'cherry' ? cherryMap : mapleMap
  const colorKey = useRef('')

  const groups = useMemo<Groups>(() => ({
    leaves: {
      ovate: rig.leaves.filter((leaf) => leaf.shape === 'ovate'),
      oak: rig.leaves.filter((leaf) => leaf.shape === 'oak'),
      maple: rig.leaves.filter((leaf) => leaf.shape === 'maple'),
      cherry: rig.leaves.filter((leaf) => leaf.shape === 'cherry'),
    },
    finder: {
      blade: rig.finderGrass.filter((item) => item.form === 'blade'),
      broad: rig.finderGrass.filter((item) => item.form === 'broad'),
      carpet: rig.finderCarpet,
    },
    filler: {
      ovate: rig.filler.filter((leaf) => leaf.shape === 'ovate'),
      detail: rig.filler.filter((leaf) => leaf.shape !== 'ovate'),
    },
  }), [rig])

  useLayoutEffect(() => {
    const branches = branchRef.current
    if (branches) {
      rig.branches.forEach((branch, index) => {
        dummy.position.set(...branch.position)
        dummy.quaternion.set(...branch.quaternion)
        dummy.scale.set(...branch.scale)
        dummy.updateMatrix()
        branches.setMatrixAt(index, dummy.matrix)
      })
      branches.instanceMatrix.needsUpdate = true
    }

    const leafMeshes: readonly [InstancedMesh | null, LeafInstance[]][] = [
      [ovateRef.current, groups.leaves.ovate],
      [oakRef.current, groups.leaves.oak],
      [mapleRef.current, groups.leaves.maple],
      [cherryRef.current, groups.leaves.cherry],
    ]
    for (const [mesh, items] of leafMeshes) {
      if (!mesh) continue
      items.forEach((leaf, index) => {
        dummy.position.set(...leaf.position)
        dummy.rotation.set(...leaf.euler, 'YXZ')
        dummy.scale.setScalar(leaf.scale)
        dummy.updateMatrix()
        mesh.setMatrixAt(index, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }

    const finderMeshes: readonly [InstancedMesh | null, FinderVegetationInstance[]][] = [
      [finderBladeRef.current, groups.finder.blade],
      [finderBroadRef.current, groups.finder.broad],
    ]
    for (const [mesh, items] of finderMeshes) {
      if (!mesh) continue
      items.forEach((item, index) => {
        const ux = Math.sin(item.lean) * Math.sin(item.heading)
        const uy = Math.cos(item.lean)
        const uz = Math.sin(item.lean) * Math.cos(item.heading)
        dummy.position.set(
          item.root[0] + (ux * item.height) / 2,
          item.root[1] + (uy * item.height) / 2,
          item.root[2] + (uz * item.height) / 2,
        )
        dummy.rotation.set(item.lean, item.heading, 0, 'YXZ')
        dummy.scale.set(item.width, item.height, 1)
        dummy.updateMatrix()
        mesh.setMatrixAt(index, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }

    const carpet = finderCarpetRef.current
    if (carpet) {
      groups.finder.carpet.forEach((leaf, index) => {
        dummy.position.set(...leaf.position)
        dummy.rotation.set(...leaf.euler, 'YXZ')
        dummy.scale.setScalar(leaf.scale)
        dummy.updateMatrix()
        carpet.setMatrixAt(index, dummy.matrix)
      })
      carpet.instanceMatrix.needsUpdate = true
    }

    const fillerMeshes: readonly [InstancedMesh | null, FillerInstance[]][] = [
      [fillerOvateRef.current, groups.filler.ovate],
      [fillerDetailRef.current, groups.filler.detail],
    ]
    for (const [mesh, items] of fillerMeshes) {
      if (!mesh) continue
      items.forEach((leaf, index) => {
        dummy.position.set(...leaf.position)
        dummy.rotation.set(...leaf.euler, 'YXZ')
        dummy.scale.setScalar(leaf.scale)
        dummy.updateMatrix()
        mesh.setMatrixAt(index, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }
    colorKey.current = ''
  }, [rig, groups])

  useFrame(() => {
    const { colors, pitch } = scene.current
    // One scene at every pitch. Wood recedes toward the pale QR-safe trunk
    // colour; grass and leaves stay put, so the code appears by angle alone.
    const next = `${colors.foliage}|${colors.foliageVar}|${colors.accent}|${colors.trunk}|${colors.grass}|${colors.grassTip}|${pitch.toFixed(3)}`
    if (next === colorKey.current) return
    colorKey.current = next

    const branches = branchRef.current
    if (branches) {
      const [bark, limb] = branchTones(colors, pitch)
      rig.branches.forEach((branch, index) => {
        tint.set(branch.shade === 0 ? bark : limb)
        branches.setColorAt(index, tint)
      })
      if (branches.instanceColor) branches.instanceColor.needsUpdate = true
    }

    // Hue varies by leaf while luminance remains pinned to its QR module.
    const tones = foliageTones(colors)
    const inkCache = new Map<string, Color>()
    const leafMeshes: readonly [InstancedMesh | null, LeafInstance[]][] = [
      [ovateRef.current, groups.leaves.ovate],
      [oakRef.current, groups.leaves.oak],
      [mapleRef.current, groups.leaves.maple],
      [cherryRef.current, groups.leaves.cherry],
    ]
    for (const [mesh, items] of leafMeshes) {
      if (!mesh) continue
      items.forEach((leaf, index) => {
        const key = `${leaf.tone}|${leaf.ink}`
        let color = inkCache.get(key)
        if (!color) {
          color = new Color(toLumaHex(tones[leaf.tone]!, leaf.ink))
          inkCache.set(key, color)
        }
        mesh.setColorAt(index, color)
      })
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }

    const finderTones = grassTones(colors)
    const finderCache = new Map<string, Color>()
    const finderMeshes: readonly [InstancedMesh | null, FinderVegetationInstance[]][] = [
      [finderBladeRef.current, groups.finder.blade],
      [finderBroadRef.current, groups.finder.broad],
    ]
    for (const [mesh, items] of finderMeshes) {
      if (!mesh) continue
      items.forEach((item, index) => {
        const key = `tuft|${item.tone}|${item.ink}`
        let color = finderCache.get(key)
        if (!color) {
          color = new Color(toLumaHex(finderTones[item.tone]!, item.ink + 0.02))
          finderCache.set(key, color)
        }
        mesh.setColorAt(index, color)
      })
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }

    const carpetMesh = finderCarpetRef.current
    if (carpetMesh) {
      groups.finder.carpet.forEach((leaf, index) => {
        const key = `c|${leaf.tone}|${leaf.ink}`
        let color = finderCache.get(key)
        if (!color) {
          color = new Color(toLumaHex(finderTones[leaf.tone]!, leaf.ink))
          finderCache.set(key, color)
        }
        carpetMesh.setColorAt(index, color)
      })
      if (carpetMesh.instanceColor) carpetMesh.instanceColor.needsUpdate = true
    }

    // Filler carries no ink, so its brightness is free to model real light:
    // sunlit tips above, shaded depths inside the crown.
    const fillerCache = new Map<string, Color>()
    const fillerMeshes: readonly [InstancedMesh | null, FillerInstance[]][] = [
      [fillerOvateRef.current, groups.filler.ovate],
      [fillerDetailRef.current, groups.filler.detail],
    ]
    for (const [mesh, items] of fillerMeshes) {
      if (!mesh) continue
      items.forEach((leaf, index) => {
        const key = `${leaf.tone}|${leaf.ink}|${leaf.shade.toFixed(2)}`
        let color = fillerCache.get(key)
        if (!color) {
          const base = tones[leaf.tone]!
          const shaded = leaf.shade >= 1
            ? mixHex(base, '#fff3d8', Math.min(0.18, (leaf.shade - 1) * 0.8))
            : mixHex(base, '#4a3414', Math.min(0.18, (1 - leaf.shade) * 0.7))
          color = new Color(toLumaHex(shaded, leaf.ink))
          fillerCache.set(key, color)
        }
        mesh.setColorAt(index, color)
      })
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  })

  const cutout = (map: Texture) => (
    <meshBasicMaterial map={map} alphaTest={0.42} side={2} />
  )

  return (
    <group>
      <instancedMesh ref={branchRef} args={[undefined, undefined, rig.branches.length]} key={`b${rig.branches.length}`} frustumCulled={false}>
        <cylinderGeometry args={[0.9, 1, 1, 8]} />
        <meshBasicMaterial />
      </instancedMesh>
      <instancedMesh ref={ovateRef} args={[undefined, undefined, groups.leaves.ovate.length]} key={`o${groups.leaves.ovate.length}`} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        {cutout(ovateMap)}
      </instancedMesh>
      <instancedMesh ref={oakRef} args={[undefined, undefined, groups.leaves.oak.length]} key={`k${groups.leaves.oak.length}`} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        {cutout(oakMap)}
      </instancedMesh>
      <instancedMesh ref={mapleRef} args={[undefined, undefined, groups.leaves.maple.length]} key={`m${groups.leaves.maple.length}`} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        {cutout(mapleMap)}
      </instancedMesh>
      <instancedMesh ref={cherryRef} args={[undefined, undefined, groups.leaves.cherry.length]} key={`c${groups.leaves.cherry.length}`} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        {cutout(cherryMap)}
      </instancedMesh>
      <instancedMesh ref={finderBladeRef} args={[undefined, undefined, groups.finder.blade.length]} key={`fb${groups.finder.blade.length}`} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={finderBladeMap} transparent alphaTest={0.42} side={2} />
      </instancedMesh>
      <instancedMesh ref={finderBroadRef} args={[undefined, undefined, groups.finder.broad.length]} key={`fr${groups.finder.broad.length}`} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={finderBroadMap} transparent alphaTest={0.42} side={2} />
      </instancedMesh>
      <instancedMesh ref={finderCarpetRef} args={[undefined, undefined, groups.finder.carpet.length]} key={`fc${groups.finder.carpet.length}`} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={carpetMap} transparent alphaTest={0.42} side={2} />
      </instancedMesh>
      <instancedMesh ref={fillerOvateRef} args={[undefined, undefined, groups.filler.ovate.length]} key={`lo${groups.filler.ovate.length}`} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={ovateMap} transparent alphaTest={0.42} side={2} />
      </instancedMesh>
      <instancedMesh ref={fillerDetailRef} args={[undefined, undefined, groups.filler.detail.length]} key={`ld${groups.filler.detail.length}`} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={detailMap} transparent alphaTest={0.42} side={2} />
      </instancedMesh>
    </group>
  )
}
