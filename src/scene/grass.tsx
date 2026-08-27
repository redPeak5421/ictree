import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, Object3D } from 'three'
import type { ModuleGrid } from '../qr/types'
import { mulberry32 } from './hash'
import { bladeTexture } from './leafTexture'
import { mixHex } from './palettes'
import type { SceneRef } from './sceneState'
import { islandExtent } from './tree'
import { BLADE_W } from './TreeFoliage'
import { sceneryOpacity } from './view'

const dummy = new Object3D()
dummy.rotation.order = 'YXZ'
const tint = new Color()

interface Blade {
  x: number
  z: number
  h: number
  /** Fixed heading; the blade leans about its own axis after it. */
  heading: number
  lean: number
  shade: number
  phase: number
}

/**
 * Rim grass: clumps of blades on the ring outside the code, each with its own
 * heading and lean, the same blades that stand in the corner turf. They lean
 * outward from the island and sway. From above the ring is the quiet zone,
 * so on the way there they thin out.
 */
export function Grass({ grid, scene, reduced }: { grid: ModuleGrid; scene: SceneRef; reduced: boolean }) {
  const mesh = useRef<InstancedMesh>(null)
  const island = islandExtent(grid.size)
  const origin = -(island - 1) / 2
  const key = useRef('')
  const map = useMemo(() => bladeTexture(), [])

  const blades = useMemo(() => {
    const rng = mulberry32(grid.size * 997 + 41)
    const list: Blade[] = []
    for (let gy = 0; gy < island; gy++) {
      for (let gx = 0; gx < island; gx++) {
        if (gx !== 0 && gy !== 0 && gx !== island - 1 && gy !== island - 1) continue
        if (rng() < 0.3) continue // clumps, not a continuous hedge
        const cx = origin + gx
        const cz = origin + gy
        const count = 8 + Math.floor(rng() * 6)
        for (let k = 0; k < count; k++) {
          const x = cx + (rng() - 0.5) * 0.8
          const z = cz + (rng() - 0.5) * 0.8
          const outward = Math.atan2(x, z)
          list.push({
            x,
            z,
            h: 0.6 + rng() * 0.6,
            // Heading is where the blade leans toward: mostly outward.
            heading: outward + (rng() - 0.5) * 1.6,
            lean: 0.15 + rng() * 0.45,
            shade: rng(),
            phase: rng() * Math.PI * 2,
          })
        }
      }
    }
    return list
  }, [grid.size, island, origin])

  useFrame(({ clock }) => {
    const inst = mesh.current
    if (!inst) return
    const { colors, pitch } = scene.current
    const opacity = sceneryOpacity(pitch)
    const mat = inst.material
    if (!Array.isArray(mat)) {
      mat.opacity = opacity
      mat.transparent = true
      mat.visible = opacity > 0.01
    }
    if (opacity <= 0.01) return

    const t = reduced ? 0 : clock.elapsedTime
    blades.forEach((blade, i) => {
      const sway = reduced ? 0 : Math.sin(t * 1.4 + blade.phase) * 0.07
      const lean = blade.lean + sway
      // Pivot at the root: the centre sits half a length up the leaning axis.
      const ux = Math.sin(lean) * Math.sin(blade.heading)
      const uy = Math.cos(lean)
      const uz = Math.sin(lean) * Math.cos(blade.heading)
      dummy.position.set(blade.x + (ux * blade.h) / 2, (uy * blade.h) / 2, blade.z + (uz * blade.h) / 2)
      dummy.rotation.set(lean, blade.heading, 0)
      dummy.scale.set(blade.h, blade.h, 1)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    })
    inst.instanceMatrix.needsUpdate = true

    const next = `${colors.grass}|${colors.grassTip}`
    if (next !== key.current) {
      key.current = next
      blades.forEach((blade, i) => {
        tint.set(mixHex(colors.grass, colors.grassTip, blade.shade * 0.9))
        inst.setColorAt(i, tint)
      })
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true
    }
  })

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, blades.length]}
      key={blades.length}
      frustumCulled={false}
    >
      <planeGeometry args={[BLADE_W, 1]} />
      <meshBasicMaterial map={map} transparent alphaTest={0.45} side={2} />
    </instancedMesh>
  )
}
