import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, MeshBasicMaterial, Object3D } from 'three'
import type { ModuleGrid } from '../qr/types'
import {
  buildSceneryVegetation,
  type VegetationForm,
  type VegetationInstance,
} from './grassLayout'
import { hashString } from './hash'
import { vegetationTexture } from './leafTexture'
import { grassTones, groundCoverOf, mixHex, type SceneColors, type Season } from './palettes'
import type { SceneRef } from './sceneState'
import type { TreeSpecies } from './treeSpecies'
import { plantInkOpacity, sceneryOpacity } from './view'
import { windBend } from './wind'

function vegetationColor(form: VegetationForm, tone: number, colors: SceneColors): string {
  const meadow = grassTones(colors)
  if (form === 'broad') return mixHex(colors.accent, meadow[2]!, 0.22 + (tone / 3) * 0.3)
  if (form === 'seed') return mixHex(meadow[3]!, colors.accent, 0.1 + (tone / 3) * 0.2)
  return meadow[tone] ?? meadow[1]!
}

function SceneryGroup({
  form,
  items,
  scene,
  reduced,
}: {
  form: VegetationForm
  items: VegetationInstance[]
  scene: SceneRef
  reduced: boolean
}) {
  const mesh = useRef<InstancedMesh>(null)
  const material = useRef<MeshBasicMaterial>(null)
  const dummy = useRef(new Object3D())
  const color = useRef(new Color())
  const colorKey = useRef('')
  const map = useMemo(() => vegetationTexture(form, 'shaded'), [form])

  useFrame(({ clock }) => {
    const inst = mesh.current
    if (!inst) return
    const { colors, pitch, inkMix } = scene.current
    // Rim clumps sit on the island lip. Trunk rosettes can land on light
    // modules. Either way a pale tuft becomes ink to a decoder, so they fade
    // on the way overhead like the weather.
    const opacity = sceneryOpacity(pitch) * plantInkOpacity(inkMix)
    const mat = material.current
    if (mat) {
      mat.opacity = opacity
      mat.visible = opacity > 0.01
    }
    if (opacity <= 0.01) return

    const t = reduced ? 0 : clock.elapsedTime
    const swayScale = form === 'broad' ? 0.05 : form === 'seed' ? 0.13 : 0.1
    items.forEach((item, index) => {
      const gust = item.gust ?? (item.region === 'rim' ? 1.3 : 1)
      const bend = reduced ? 0 : windBend(t, item.root[0], item.root[2]).tilt
      const sway = reduced ? 0 : Math.sin(t * 1.55 + item.phase) * swayScale * gust + bend * 0.75 * gust
      const lean = item.lean + sway
      const ux = Math.sin(lean) * Math.sin(item.heading)
      const uy = Math.cos(lean)
      const uz = Math.sin(lean) * Math.cos(item.heading)
      dummy.current.position.set(
        item.root[0] + (ux * item.height) / 2,
        item.root[1] + (uy * item.height) / 2,
        item.root[2] + (uz * item.height) / 2,
      )
      dummy.current.rotation.set(lean, item.heading, 0, 'YXZ')
      dummy.current.scale.set(item.width, item.height, 1)
      dummy.current.updateMatrix()
      inst.setMatrixAt(index, dummy.current.matrix)
    })
    inst.instanceMatrix.needsUpdate = true

    const next = `${colors.grass}|${colors.grassTip}|${colors.accent}`
    if (next !== colorKey.current) {
      colorKey.current = next
      items.forEach((item, index) => {
        color.current.set(vegetationColor(form, item.tone, colors))
        inst.setColorAt(index, color.current)
      })
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true
    }
  })

  if (items.length === 0) return null

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, items.length]}
      key={`${form}:${items.length}`}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial ref={material} map={map} transparent alphaTest={0.42} side={2} />
    </instancedMesh>
  )
}

/**
 * Decorative rim clumps and trunk-base rosettes. The pure generator supplies
 * the gaps, height bands and plant forms; this component only animates them.
 */
export function Grass({
  grid,
  scene,
  reduced,
  season,
  tree,
}: {
  grid: ModuleGrid
  scene: SceneRef
  reduced: boolean
  season: Season
  tree: TreeSpecies
}) {
  const cover = groundCoverOf(season, tree)
  const vegetation = useMemo(
    () => buildSceneryVegetation(grid, hashString(grid.payload), cover),
    [grid, cover],
  )
  const groups = useMemo(() => ({
    blade: vegetation.filter((item) => item.form === 'blade'),
    broad: vegetation.filter((item) => item.form === 'broad'),
    seed: vegetation.filter((item) => item.form === 'seed'),
  }), [vegetation])

  return (
    <group>
      <SceneryGroup form="blade" items={groups.blade} scene={scene} reduced={reduced} />
      <SceneryGroup form="broad" items={groups.broad} scene={scene} reduced={reduced} />
      <SceneryGroup form="seed" items={groups.seed} scene={scene} reduced={reduced} />
    </group>
  )
}
