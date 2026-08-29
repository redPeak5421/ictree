import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, Object3D, type Texture } from 'three'
import { toLumaHex } from '../qr/contrast'
import type { FinderCarpetInstance, FinderVegetationInstance } from './grassLayout'
import { carpetTexture, fruitTexture, leafTexture, petalTexture, vegetationTexture } from './leafTexture'
import { LEAF_SHAPES, type LeafShape } from './leafShape'
import {
  finderInkTones,
  foliageTones,
  mixHex,
  ornamentOf,
  type PaletteId,
  type Season,
} from './palettes'
import type { SceneRef } from './sceneState'
import type { FillerInstance, LeafInstance, TreeRig } from './tree'
import { branchTones } from './treeAppearance'

const dummy = new Object3D()
const tint = new Color()

function emptyLeaves(): Record<LeafShape, LeafInstance[]> {
  return {
    ovate: [],
    oak: [],
    maple: [],
    cherry: [],
    willow: [],
    pine: [],
    apple: [],
    banana: [],
  }
}

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
  ornaments: LeafInstance[]
}

function poseFinder(item: FinderVegetationInstance, lean: number) {
  const ux = Math.sin(lean) * Math.sin(item.heading)
  const uy = Math.cos(lean)
  const uz = Math.sin(lean) * Math.cos(item.heading)
  dummy.position.set(
    item.root[0] + (ux * item.height) / 2,
    item.root[1] + (uy * item.height) / 2,
    item.root[2] + (uz * item.height) / 2,
  )
  dummy.rotation.set(lean, item.heading, 0, 'YXZ')
  dummy.scale.set(item.width, item.height, 1)
  dummy.updateMatrix()
}

/** Static canopy and QR-critical corner vegetation. Nothing faces the camera. */
export function TreeFoliage({
  rig,
  scene,
  palette,
  season,
}: {
  rig: TreeRig
  scene: SceneRef
  palette: PaletteId
  season: Season
}) {
  const branchRef = useRef<InstancedMesh>(null)
  const leafRefs = useRef<Partial<Record<LeafShape, InstancedMesh | null>>>({})
  const finderBladeRef = useRef<InstancedMesh>(null)
  const finderBroadRef = useRef<InstancedMesh>(null)
  const finderCarpetRef = useRef<InstancedMesh>(null)
  const fillerOvateRef = useRef<InstancedMesh>(null)
  const fillerDetailRef = useRef<InstancedMesh>(null)
  const ornamentRef = useRef<InstancedMesh>(null)
  const leafMaps = useMemo(() => {
    const maps = {} as Record<LeafShape, Texture>
    for (const shape of LEAF_SHAPES) maps[shape] = leafTexture(shape)
    return maps
  }, [])
  const finderBladeMap = useMemo(() => vegetationTexture('blade', 'flat'), [])
  const finderBroadMap = useMemo(() => vegetationTexture('broad', 'flat'), [])
  const carpetMap = useMemo(() => carpetTexture(), [])
  const blossomMap = useMemo(() => petalTexture(), [])
  const fruitMap = useMemo(() => fruitTexture(palette === 'sky' ? 'long' : 'round'), [palette])
  const detailMap = leafMaps[rig.species]
  const colorKey = useRef('')
  const ornamentKind = ornamentOf(season, palette)

  const groups = useMemo<Groups>(() => {
    const leaves = emptyLeaves()
    for (const leaf of rig.leaves) leaves[leaf.shape].push(leaf)
    const ornaments = ornamentKind === 'none' ? [] : rig.leaves.filter((_, index) => index % 8 === 0)
    return {
      leaves,
      finder: {
        blade: rig.finderGrass.filter((item) => item.form === 'blade'),
        broad: rig.finderGrass.filter((item) => item.form === 'broad'),
        carpet: rig.finderCarpet,
      },
      filler: {
        ovate: rig.filler.filter((leaf) => leaf.shape === 'ovate'),
        detail: rig.filler.filter((leaf) => leaf.shape !== 'ovate'),
      },
      ornaments,
    }
  }, [rig, ornamentKind])

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

    for (const shape of LEAF_SHAPES) {
      const mesh = leafRefs.current[shape]
      const items = groups.leaves[shape]
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

    const ornaments = ornamentRef.current
    if (ornaments) {
      const fruit = ornamentKind === 'fruit'
      groups.ornaments.forEach((leaf, index) => {
        dummy.position.set(leaf.position[0], leaf.position[1] + 0.05, leaf.position[2])
        dummy.rotation.set(...leaf.euler, 'YXZ')
        dummy.scale.setScalar(leaf.scale * (fruit ? 0.42 : 0.36))
        dummy.updateMatrix()
        ornaments.setMatrixAt(index, dummy.matrix)
      })
      ornaments.instanceMatrix.needsUpdate = true
    }
    colorKey.current = ''
  }, [rig, groups, ornamentKind])

  useFrame(({ clock }) => {
    const { colors, pitch } = scene.current
    const t = clock.elapsedTime
    const sway = pitch > 1.45 ? 0 : 1
    const finderMeshes: readonly [InstancedMesh | null, FinderVegetationInstance[]][] = [
      [finderBladeRef.current, groups.finder.blade],
      [finderBroadRef.current, groups.finder.broad],
    ]
    for (const [mesh, items] of finderMeshes) {
      if (!mesh) continue
      items.forEach((item, index) => {
        poseFinder(item, item.lean + Math.sin(t * 1.35 + item.phase) * 0.03 * sway)
        mesh.setMatrixAt(index, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }

    const next = `${colors.foliage}|${colors.foliageVar}|${colors.accent}|${colors.trunk}|${colors.grass}|${colors.grassTip}|${pitch.toFixed(3)}|${palette}`
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

    const tones = foliageTones(colors)
    const inkCache = new Map<string, Color>()
    for (const shape of LEAF_SHAPES) {
      const mesh = leafRefs.current[shape]
      const items = groups.leaves[shape]
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

    const finderTones = finderInkTones(colors)
    const finderCache = new Map<string, Color>()
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

    const ornaments = ornamentRef.current
    if (ornaments) {
      groups.ornaments.forEach((leaf, index) => {
        const key = `o|${leaf.ink}`
        let color = inkCache.get(key)
        if (!color) {
          color = new Color(toLumaHex(colors.accent, leaf.ink))
          inkCache.set(key, color)
        }
        ornaments.setColorAt(index, color)
      })
      if (ornaments.instanceColor) ornaments.instanceColor.needsUpdate = true
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
      {LEAF_SHAPES.map((shape) => (
        <instancedMesh
          key={`${shape}${groups.leaves[shape].length}`}
          ref={(mesh) => {
            leafRefs.current[shape] = mesh
          }}
          args={[undefined, undefined, Math.max(1, groups.leaves[shape].length)]}
          frustumCulled={false}
        >
          <planeGeometry args={[1, 1]} />
          {cutout(leafMaps[shape])}
        </instancedMesh>
      ))}
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
        <meshBasicMaterial map={leafMaps.ovate} transparent alphaTest={0.42} side={2} />
      </instancedMesh>
      <instancedMesh ref={fillerDetailRef} args={[undefined, undefined, groups.filler.detail.length]} key={`ld${groups.filler.detail.length}`} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={detailMap} transparent alphaTest={0.42} side={2} />
      </instancedMesh>
      {groups.ornaments.length > 0 && (
        <instancedMesh ref={ornamentRef} args={[undefined, undefined, groups.ornaments.length]} key={`or${groups.ornaments.length}${ornamentKind}`} frustumCulled={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={ornamentKind === 'fruit' ? fruitMap : blossomMap} transparent alphaTest={0.42} side={2} />
        </instancedMesh>
      )}
    </group>
  )
}
