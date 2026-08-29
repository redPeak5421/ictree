import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, Object3D } from 'three'
import type { ModuleGrid } from '../qr/types'
import {
  buildSceneryVegetation,
  type VegetationForm,
  type VegetationInstance,
} from './grassLayout'
import { hashString } from './hash'
import { vegetationTexture } from './leafTexture'
import { groundCoverOf, mixHex, type PaletteId, type SceneColors, type Season } from './palettes'
import type { SceneRef } from './sceneState'

function vegetationColor(form: VegetationForm, tone: number, colors: SceneColors): string {
  const amount = tone / 3
  if (form === 'broad') return mixHex(colors.accent, colors.grassTip, 0.18 + amount * 0.35)
  if (form === 'seed') return mixHex(colors.grassTip, colors.accent, 0.08 + amount * 0.22)
  return mixHex(colors.grass, colors.grassTip, amount * 0.9)
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
  const dummy = useRef(new Object3D())
  const color = useRef(new Color())
  const colorKey = useRef('')
  const map = useMemo(() => vegetationTexture(form, 'shaded'), [form])

  useFrame(({ clock }) => {
    const inst = mesh.current
    if (!inst) return
    const { colors } = scene.current

    const t = reduced ? 0 : clock.elapsedTime
    const swayScale = form === 'broad' ? 0.05 : form === 'seed' ? 0.13 : 0.1
    items.forEach((item, index) => {
      const gust = item.gust ?? (item.region === 'rim' ? 1.3 : 1)
      const sway = reduced ? 0 : Math.sin(t * 1.55 + item.phase) * swayScale * gust
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

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, items.length]}
      key={`${form}:${items.length}`}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={map} transparent alphaTest={0.42} side={2} />
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
  palette,
}: {
  grid: ModuleGrid
  scene: SceneRef
  reduced: boolean
  season: Season
  palette: PaletteId
}) {
  const cover = groundCoverOf(season, palette)
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
