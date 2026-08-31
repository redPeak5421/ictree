import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, type Texture } from 'three'
import { lumaOfHex, toLumaHex } from '../qr/contrast'
import type { FinderCarpetInstance, FinderVegetationInstance } from './grassLayout'
import { barkTexture, carpetTexture, fruitTexture, leafTexture, petalTexture, vegetationTexture } from './leafTexture'
import { LEAF_SHAPES, type LeafShape } from './leafShape'
import {
  finderInkTones,
  foliageTones,
  grassTones,
  mixHex,
  ornamentOf,
  type Season,
} from './palettes'
import type { SceneRef } from './sceneState'
import { pickFruitOrnaments } from './scatter'
import type { FillerInstance, LeafInstance, TreeRig } from './tree'
import { branchTones, leafLuma } from './treeAppearance'
import { PINE_ENABLED, type TreeSpecies } from './treeSpecies'

const dummy = new Object3D()
const tint = new Color()
const PINE_SHAPES: readonly LeafShape[] = ['pine', 'pineTwig', 'pineCanopy']
const LIVE_SHAPES: readonly LeafShape[] = PINE_ENABLED
  ? LEAF_SHAPES
  : LEAF_SHAPES.filter((shape) => !PINE_SHAPES.includes(shape))

function byShape<T>(): Record<LeafShape, T[]> {
  return Object.fromEntries(LIVE_SHAPES.map((shape) => [shape, [] as T[]])) as Record<LeafShape, T[]>
}

/** Anything a blossom or fruit can hang from. */
type OrnamentHost = Pick<FillerInstance, 'position' | 'euler' | 'scale' | 'ink'>

interface Groups {
  leaves: Record<LeafShape, LeafInstance[]>
  finder: {
    blade: FinderVegetationInstance[]
    broad: FinderVegetationInstance[]
    carpet: FinderCarpetInstance[]
  }
  filler: Record<LeafShape, FillerInstance[]>
  ornaments: OrnamentHost[]
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
  tree,
  season,
  shed = false,
}: {
  rig: TreeRig
  scene: SceneRef
  tree: TreeSpecies
  season: Season
  shed?: boolean
}) {
  const trunkRef = useRef<Mesh>(null)
  const limbRef = useRef<InstancedMesh>(null)
  const leafRefs = useRef<Partial<Record<LeafShape, InstancedMesh | null>>>({})
  const finderBladeRef = useRef<InstancedMesh>(null)
  const finderBroadRef = useRef<InstancedMesh>(null)
  const finderCarpetRef = useRef<InstancedMesh>(null)
  const fillerRefs = useRef<Partial<Record<LeafShape, InstancedMesh | null>>>({})
  const ornamentRef = useRef<InstancedMesh>(null)
  const leafMaps = useMemo(() => {
    const maps = {} as Record<LeafShape, Texture>
    for (const shape of LIVE_SHAPES) maps[shape] = leafTexture(shape)
    return maps
  }, [])
  const finderBladeMap = useMemo(() => vegetationTexture('blade', 'flat'), [])
  const finderBroadMap = useMemo(() => vegetationTexture('broad', 'flat'), [])
  const carpetMap = useMemo(() => carpetTexture(), [])
  const blossomMap = useMemo(() => petalTexture(), [])
  const fruitMap = useMemo(() => fruitTexture('round'), [])
  const barkMap = useMemo(() => barkTexture(), [])
  const colorKey = useRef('')
  const ornamentKind = ornamentOf(season, tree)
  // In spring the cherry's single leaves are drawn as blossoms. The blossom
  // outline sits inside the cherry leaf box, so the layout's bounds still hold.
  // Fruit modules are apples only while the tree fruits; otherwise they are
  // ordinary apple-leaf clusters on the same footprint.
  const fruiting = ornamentKind === 'fruit'
  const leafMap = (shape: LeafShape): Texture =>
    shape === 'appleHeap' && !fruiting ? leafMaps.appleCanopy : leafMaps[shape]
  const fillerMap = (shape: LeafShape): Texture =>
    shape === 'cherry' && tree === 'cherry' && season === 'spring' ? leafMaps.blossom : leafMap(shape)

  const groups = useMemo<Groups>(() => {
    const leaves = byShape<LeafInstance>()
    for (const leaf of rig.leaves) leaves[leaf.shape]?.push(leaf)
    const filler = byShape<FillerInstance>()
    // An apple tree in fruit thins its crown so the apples show.
    const thin = ornamentKind === 'fruit'
    rig.filler.forEach((leaf, index) => {
      if (thin && index % 3 === 0) return
      filler[leaf.shape]?.push(leaf)
    })
    // Blossoms hang on the outer half of the crown. Apples are a fixed
    // handful of single fruits, shuffled across the modules.
    let ornaments: OrnamentHost[] = []
    if (ornamentKind === 'fruit') {
      ornaments = pickFruitOrnaments(rig.filler)
    } else if (ornamentKind !== 'none') {
      const outer = rig.filler
        .map((leaf, index) => ({ leaf, index, radius: Math.hypot(leaf.position[0], leaf.position[2]) }))
        .sort((a, b) => b.radius - a.radius)
        .slice(0, Math.ceil(rig.filler.length * 0.5))
      ornaments = outer.filter((_, order) => order % 2 === 0).map((item) => item.leaf)
    }
    return {
      leaves,
      finder: {
        blade: rig.finderGrass.filter((item) => item.form === 'blade'),
        broad: rig.finderGrass.filter((item) => item.form === 'broad'),
        carpet: rig.finderCarpet,
      },
      filler,
      ornaments,
    }
  }, [rig, ornamentKind])

  const limbs = useMemo(() => rig.branches.filter((branch) => branch.shade === 1), [rig.branches])
  const bole = useMemo(() => {
    const parts = rig.branches.filter((branch) => branch.shade === 0)
    if (parts.length === 0) return null
    let y0 = Infinity
    let y1 = -Infinity
    let rBase = 0
    let rTop = Infinity
    for (const part of parts) {
      const half = part.scale[1] / 2
      const lo = part.position[1] - half
      const hi = part.position[1] + half
      if (lo < y0) y0 = lo
      if (hi > y1) y1 = hi
      rBase = Math.max(rBase, part.scale[0])
      rTop = Math.min(rTop, part.scale[0])
    }
    return {
      y: (y0 + y1) / 2,
      h: Math.max(0.2, y1 - y0),
      rBase,
      rTop: Math.min(Number.isFinite(rTop) ? rTop : rBase * 0.72, rBase * 0.82),
    }
  }, [rig.branches])

  useLayoutEffect(() => {
    const branches = limbRef.current
    if (branches) {
      limbs.forEach((branch, index) => {
        dummy.position.set(...branch.position)
        dummy.quaternion.set(...branch.quaternion)
        dummy.scale.set(...branch.scale)
        dummy.updateMatrix()
        branches.setMatrixAt(index, dummy.matrix)
      })
      branches.instanceMatrix.needsUpdate = true
    }

    for (const shape of LIVE_SHAPES) {
      const mesh = leafRefs.current[shape]
      const items = groups.leaves[shape]
      if (!mesh || !items) continue
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

    for (const shape of LIVE_SHAPES) {
      const mesh = fillerRefs.current[shape]
      const items = groups.filler[shape]
      if (!mesh || !items) continue
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
        // Fruit hangs a little below its leaf; blossoms sit on it.
        // Fruit hangs a little below its leaf; blossoms sit on it. Big enough
        // to read as an apple, but never past its own module's edge: the
        // apple texture spans 0.64 of its plane, so half-extent is 0.32·scale.
        const ox = leaf.position[0] - Math.round(leaf.position[0])
        const oz = leaf.position[2] - Math.round(leaf.position[2])
        const room = (0.5 - Math.max(Math.abs(ox), Math.abs(oz))) / 0.32
        const size = fruit
          ? Math.min(room, Math.max(0.75, Math.min(leaf.scale, 1.6) * 0.75) * 1.1)
          : Math.min(leaf.scale, 1.2) * 0.42
        dummy.position.set(leaf.position[0], leaf.position[1] + (fruit ? -0.14 : 0.05), leaf.position[2])
        dummy.rotation.set(fruit ? -0.25 : leaf.euler[0], leaf.euler[1], 0, 'YXZ')
        dummy.scale.setScalar(size)
        dummy.updateMatrix()
        ornaments.setMatrixAt(index, dummy.matrix)
      })
      ornaments.instanceMatrix.needsUpdate = true
    }
    colorKey.current = ''
  }, [rig, groups, ornamentKind, limbs])

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

    const lift = colors.inkLift
    const next = `${colors.foliage}|${colors.foliageVar}|${colors.accent}|${colors.fruit}|${colors.trunk}|${colors.grass}|${colors.grassTip}|${lift.toFixed(3)}|${pitch.toFixed(3)}|${tree}|${fruiting}`
    if (next === colorKey.current) return
    colorKey.current = next

    const [bark, limb] = branchTones(colors, pitch)
    const trunk = trunkRef.current
    if (trunk?.material instanceof MeshBasicMaterial) trunk.material.color.set(bark)
    const branches = limbRef.current
    if (branches) {
      limbs.forEach((_branch, index) => {
        tint.set(limb)
        branches.setColorAt(index, tint)
      })
      if (branches.instanceColor) branches.instanceColor.needsUpdate = true
    }

    const tones = foliageTones(colors)
    const inkCache = new Map<string, Color>()
    for (const shape of LIVE_SHAPES) {
      const mesh = leafRefs.current[shape]
      const items = groups.leaves[shape]
      if (!mesh) continue
      items.forEach((leaf, index) => {
        const red = shape === 'appleHeap' && fruiting
        const key = `${red ? 'r' : leaf.tone}|${leaf.ink}`
        let color = inkCache.get(key)
        if (!color) {
          const hex = red ? colors.fruit : tones[leaf.tone]!
          color = new Color(toLumaHex(hex, leafLuma(hex, leaf.ink + lift, pitch)))
          inkCache.set(key, color)
        }
        mesh.setColorAt(index, color)
      })
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }

    const finderTones = finderInkTones(colors)
    const meadowTones = grassTones(colors)
    const finderCache = new Map<string, Color>()
    for (const [mesh, items] of finderMeshes) {
      if (!mesh) continue
      items.forEach((item, index) => {
        const meadow = item.kind === 'meadow'
        const key = `${meadow ? 'm' : 'f'}|${item.tone}|${item.ink}`
        let color = finderCache.get(key)
        if (!color) {
          const source = meadow ? meadowTones[item.tone]! : finderTones[item.tone]!
          color = new Color(meadow ? source : toLumaHex(source, lumaOfHex(colors.finder)))
          finderCache.set(key, color)
        }
        mesh.setColorAt(index, color)
      })
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }

    const carpetMesh = finderCarpetRef.current
    if (carpetMesh) {
      groups.finder.carpet.forEach((leaf, index) => {
        const meadow = leaf.kind === 'meadow'
        const key = `${meadow ? 'mc' : 'c'}|${leaf.tone}|${leaf.ink}`
        let color = finderCache.get(key)
        if (!color) {
          const source = meadow ? meadowTones[leaf.tone]! : finderTones[leaf.tone]!
          color = new Color(meadow ? source : toLumaHex(source, lumaOfHex(colors.finder)))
          finderCache.set(key, color)
        }
        carpetMesh.setColorAt(index, color)
      })
      if (carpetMesh.instanceColor) carpetMesh.instanceColor.needsUpdate = true
    }

    const fillerCache = new Map<string, Color>()
    for (const shape of LEAF_SHAPES) {
      const mesh = fillerRefs.current[shape]
      const items = groups.filler[shape]
      if (!mesh) continue
      const red = shape === 'appleHeap' && fruiting
      items.forEach((leaf, index) => {
        const key = `${red ? 'r' : leaf.tone}|${leaf.ink}|${leaf.shade.toFixed(2)}`
        let color = fillerCache.get(key)
        if (!color) {
          // Luma is pinned afterwards, so shade can only move hue and
          // saturation: the shaded underside leans to the species' deep tone,
          // the sunlit top to its pale variant. Never toward brown.
          const base = red ? colors.fruit : tones[leaf.tone]!
          const shaded = red
            ? base
            : leaf.shade >= 1
            ? mixHex(base, colors.foliageVar, Math.min(0.5, (leaf.shade - 1) * 1.6))
            : mixHex(base, colors.finder, Math.min(0.28, (1 - leaf.shade) * 0.9))
          color = new Color(toLumaHex(shaded, leafLuma(shaded, leaf.ink + lift, pitch)))
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
          const hex = ornamentKind === 'fruit' ? colors.fruit : colors.accent
          color = new Color(toLumaHex(hex, leafLuma(hex, leaf.ink + lift, pitch)))
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
      {bole && (
        <mesh ref={trunkRef} position={[0, bole.y, 0]}>
          <cylinderGeometry args={[bole.rTop, bole.rBase, bole.h, 24]} />
          <meshBasicMaterial map={barkMap} />
        </mesh>
      )}
      {limbs.length > 0 && (
        <instancedMesh ref={limbRef} args={[undefined, undefined, limbs.length]} key={`l${limbs.length}`} frustumCulled={false}>
          <cylinderGeometry args={[0.88, 1, 1, 10]} />
          <meshBasicMaterial map={barkMap} />
        </instancedMesh>
      )}
      {!shed && LIVE_SHAPES.map((shape) => (
        <instancedMesh
          key={`${shape}${groups.leaves[shape].length}`}
          ref={(mesh) => {
            leafRefs.current[shape] = mesh
          }}
          args={[undefined, undefined, Math.max(1, groups.leaves[shape].length)]}
          frustumCulled={false}
        >
          <planeGeometry args={[1, 1]} />
          {cutout(leafMap(shape))}
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
      {!shed && LIVE_SHAPES.filter((shape) => groups.filler[shape]?.length).map((shape) => (
        <instancedMesh
          key={`f${shape}${groups.filler[shape].length}`}
          ref={(mesh) => {
            fillerRefs.current[shape] = mesh
          }}
          args={[undefined, undefined, groups.filler[shape].length]}
          frustumCulled={false}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={fillerMap(shape)} transparent alphaTest={0.42} side={2} />
        </instancedMesh>
      ))}
      {!shed && groups.ornaments.length > 0 && (
        <instancedMesh ref={ornamentRef} args={[undefined, undefined, groups.ornaments.length]} key={`or${groups.ornaments.length}${ornamentKind}`} frustumCulled={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={ornamentKind === 'fruit' ? fruitMap : blossomMap} transparent alphaTest={0.42} side={2} />
        </instancedMesh>
      )}
    </group>
  )
}
