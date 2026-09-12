import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Group, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, type Texture } from 'three'
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
import { growScaleY } from './view'
import { canopyWindFade, windBend, windShift, type WindBend } from './wind'

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

const REST_WIND: WindBend = { tilt: 0, twist: 0, lean: 0 }

function poseWindItem(
  position: [number, number, number],
  euler: [number, number, number],
  scale: number,
  time: number,
  fade: number,
  gust: number,
  yOffset = 0,
) {
  const bend = fade === 0 ? REST_WIND : windBend(time, position[0], position[2])
  const [dx, dz] = windShift(bend.lean * gust, position[1])
  dummy.position.set(position[0] + dx, position[1] + yOffset, position[2] + dz)
  dummy.rotation.set(euler[0] + bend.tilt * gust, euler[1] + bend.twist * gust, euler[2], 'YXZ')
  dummy.scale.setScalar(scale)
  dummy.updateMatrix()
}

function poseWindGroup(
  refs: Partial<Record<LeafShape, InstancedMesh | null>>,
  grouped: Record<LeafShape, { position: [number, number, number]; euler: [number, number, number]; scale: number }[]>,
  time: number,
  fade: number,
  gust: number,
) {
  for (const shape of LIVE_SHAPES) {
    const mesh = refs[shape]
    const items = grouped[shape]
    if (!mesh || !items) continue
    items.forEach((leaf, index) => {
      poseWindItem(leaf.position, leaf.euler, leaf.scale, time, fade, gust)
      mesh.setMatrixAt(index, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }
}

/** Fruit hangs below the leaf; blossoms sit on it. Size stays inside the module. */
function ornamentScale(leaf: OrnamentHost, fruit: boolean): number {
  const ox = leaf.position[0] - Math.round(leaf.position[0])
  const oz = leaf.position[2] - Math.round(leaf.position[2])
  const room = (0.5 - Math.max(Math.abs(ox), Math.abs(oz))) / 0.32
  return fruit
    ? Math.min(room, Math.max(0.75, Math.min(leaf.scale, 1.6) * 0.75) * 1.1)
    : Math.min(leaf.scale, 1.2) * 0.42
}

/** Canopy and QR-critical corner vegetation. Leaves rustle in side-view wind. */
export function TreeFoliage({
  rig,
  scene,
  tree,
  season,
  shed = false,
  reduced = false,
}: {
  rig: TreeRig
  scene: SceneRef
  tree: TreeSpecies
  season: Season
  shed?: boolean
  reduced?: boolean
}) {
  const growRef = useRef<Group>(null)
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
        dummy.position.set(leaf.position[0], leaf.position[1] + (fruit ? -0.14 : 0.05), leaf.position[2])
        dummy.rotation.set(fruit ? -0.25 : leaf.euler[0], leaf.euler[1], 0, 'YXZ')
        dummy.scale.setScalar(ornamentScale(leaf, fruit))
        dummy.updateMatrix()
        ornaments.setMatrixAt(index, dummy.matrix)
      })
      ornaments.instanceMatrix.needsUpdate = true
    }
    colorKey.current = ''
  }, [rig, groups, ornamentKind, limbs, shed])

  useFrame(({ clock }) => {
    const { colors, pitch, grow } = scene.current
    const grown = growRef.current
    if (grown) grown.scale.set(1, growScaleY(grow), 1)
    const t = clock.elapsedTime
    const fade = reduced || shed ? 0 : canopyWindFade(pitch)
    const gust = tree === 'willow' ? 1.45 : 1
    const finderMeshes: readonly [InstancedMesh | null, FinderVegetationInstance[]][] = [
      [finderBladeRef.current, groups.finder.blade],
      [finderBroadRef.current, groups.finder.broad],
    ]
    for (const [mesh, items] of finderMeshes) {
      if (!mesh) continue
      items.forEach((item, index) => {
        poseFinder(item, item.lean + Math.sin(t * 1.35 + item.phase) * 0.03 * fade)
        mesh.setMatrixAt(index, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }

    poseWindGroup(leafRefs.current, groups.leaves, t, fade, gust)
    poseWindGroup(fillerRefs.current, groups.filler, t, fade, gust)

    const ornaments = ornamentRef.current
    if (ornaments) {
      const fruit = ornamentKind === 'fruit'
      groups.ornaments.forEach((leaf, index) => {
        const bend = fade === 0 ? REST_WIND : windBend(t, leaf.position[0], leaf.position[2])
        const [dx, dz] = windShift(bend.lean * gust, leaf.position[1])
        dummy.position.set(leaf.position[0] + dx, leaf.position[1] + (fruit ? -0.14 : 0.05), leaf.position[2] + dz)
        dummy.rotation.set(
          (fruit ? -0.25 : leaf.euler[0]) + bend.tilt * gust,
          leaf.euler[1] + bend.twist * gust,
          0,
          'YXZ',
        )
        dummy.scale.setScalar(ornamentScale(leaf, fruit))
        dummy.updateMatrix()
        ornaments.setMatrixAt(index, dummy.matrix)
      })
      ornaments.instanceMatrix.needsUpdate = true
    }

    const root = fade === 0 ? REST_WIND : windBend(t, 0, 0)
    const branches = limbRef.current
    if (branches) {
      limbs.forEach((branch, index) => {
        const [dx, dz] = windShift(root.lean * gust * 0.55, branch.position[1])
        dummy.position.set(branch.position[0] + dx, branch.position[1], branch.position[2] + dz)
        dummy.quaternion.set(...branch.quaternion)
        dummy.scale.set(...branch.scale)
        dummy.updateMatrix()
        branches.setMatrixAt(index, dummy.matrix)
      })
      branches.instanceMatrix.needsUpdate = true
    }
    const trunk = trunkRef.current
    if (trunk && bole) {
      const [dx, dz] = windShift(root.lean * gust * 0.35, bole.y)
      trunk.position.set(dx, bole.y, dz)
      trunk.rotation.z = root.tilt * 0.22 * gust
      trunk.rotation.x = root.twist * 0.16 * gust
    }

    const lift = colors.inkLift
    const next = `${colors.foliage}|${colors.foliageVar}|${colors.accent}|${colors.fruit}|${colors.trunk}|${colors.grass}|${colors.grassTip}|${lift.toFixed(3)}|${pitch.toFixed(3)}|${tree}|${fruiting}`
    if (next === colorKey.current) return
    colorKey.current = next

    const [bark, limb] = branchTones(colors, pitch)
    const trunkMesh = trunkRef.current
    if (trunkMesh?.material instanceof MeshBasicMaterial) trunkMesh.material.color.set(bark)
    const limbMesh = limbRef.current
    if (limbMesh) {
      limbs.forEach((_branch, index) => {
        tint.set(limb)
        limbMesh.setColorAt(index, tint)
      })
      if (limbMesh.instanceColor) limbMesh.instanceColor.needsUpdate = true
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

    const ornamentMesh = ornamentRef.current
    if (ornamentMesh) {
      groups.ornaments.forEach((leaf, index) => {
        const key = `o|${leaf.ink}`
        let color = inkCache.get(key)
        if (!color) {
          const hex = ornamentKind === 'fruit' ? colors.fruit : colors.accent
          color = new Color(toLumaHex(hex, leafLuma(hex, leaf.ink + lift, pitch)))
          inkCache.set(key, color)
        }
        ornamentMesh.setColorAt(index, color)
      })
      if (ornamentMesh.instanceColor) ornamentMesh.instanceColor.needsUpdate = true
    }
  })

  const cutout = (map: Texture) => (
    <meshBasicMaterial map={map} alphaTest={0.42} side={2} />
  )

  return (
    <group>
      <group ref={growRef}>
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
        {/* Hide — do not unmount — while LeafGather flies the same instances. */}
        <group visible={!shed}>
          {LIVE_SHAPES.map((shape) => (
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
        </group>
        <group visible={!shed}>
          {LIVE_SHAPES.filter((shape) => groups.filler[shape]?.length).map((shape) => (
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
          {groups.ornaments.length > 0 && (
            <instancedMesh ref={ornamentRef} args={[undefined, undefined, groups.ornaments.length]} key={`or${groups.ornaments.length}${ornamentKind}`} frustumCulled={false}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial map={ornamentKind === 'fruit' ? fruitMap : blossomMap} transparent alphaTest={0.42} side={2} />
            </instancedMesh>
          )}
        </group>
      </group>
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
    </group>
  )
}
