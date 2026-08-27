import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, Object3D } from 'three'
import type { ModuleGrid } from '../qr/types'
import { mulberry32 } from './hash'
import { tuftTexture } from './leafTexture'
import { sceneryOpacity } from './view'
import { rightOf } from './orbit'
import { mixHex } from './palettes'
import type { SceneRef } from './sceneState'
import { islandExtent } from './tree'

const dummy = new Object3D()
dummy.rotation.order = 'YXZ'
const tint = new Color()

interface Blade {
  x: number
  z: number
  w: number
  h: number
  /** Heading offset from the camera's, so no blade goes edge-on. */
  yaw: number
  /** Unit outward direction from the island centre. */
  ox: number
  oz: number
  /** How far it leans outward, and its own scatter. */
  leanOut: number
  leanJitter: number
  shade: number
  phase: number
}

/**
 * Rim grass: the ring outside the code, which is the quiet zone from above and
 * so thins out on the way there. Same tuft silhouette as the grass standing on
 * the code's corners (see tree.ts), turned toward the camera.
 */
export function Grass({ grid, scene, reduced }: { grid: ModuleGrid; scene: SceneRef; reduced: boolean }) {
  const mesh = useRef<InstancedMesh>(null)
  const island = islandExtent(grid.size)
  const origin = -(island - 1) / 2
  const key = useRef('')
  const map = useMemo(() => tuftTexture(), [])

  const blades = useMemo(() => {
    const rng = mulberry32(grid.size * 997 + 41)
    const list: Blade[] = []
    for (let gy = 0; gy < island; gy++) {
      for (let gx = 0; gx < island; gx++) {
        if (gx !== 0 && gy !== 0 && gx !== island - 1 && gy !== island - 1) continue
        if (rng() < 0.3) continue // clumps, not a continuous hedge
        const cx = origin + gx
        const cz = origin + gy
        const tuft = 2 + Math.floor(rng() * 2)
        for (let k = 0; k < tuft; k++) {
          const x = cx + (rng() - 0.5) * 0.9
          const z = cz + (rng() - 0.5) * 0.9
          const r = Math.hypot(x, z) || 1
          list.push({
            x,
            z,
            w: 0.75 + rng() * 0.35,
            h: 0.7 + rng() * 0.5,
            yaw: (rng() - 0.5) * 1.1,
            ox: x / r,
            oz: z / r,
            leanOut: 0.18 + rng() * 0.3,
            leanJitter: (rng() - 0.5) * 0.16,
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
    const { colors, yaw, pitch } = scene.current
    const opacity = sceneryOpacity(pitch)
    const mat = inst.material
    if (!Array.isArray(mat)) {
      mat.opacity = opacity
      mat.transparent = true
      mat.visible = opacity > 0.01
    }
    if (opacity <= 0.01) return

    const t = reduced ? 0 : clock.elapsedTime
    const [rx, rz] = rightOf(yaw)
    blades.forEach((blade, i) => {
      const sway = reduced ? 0 : Math.sin(t * 1.4 + blade.phase) * 0.08
      // Screen-space lean away from the island centre: the outward direction
      // projected onto the camera's right axis, wherever the camera is now.
      const outward = blade.ox * rx + blade.oz * rz
      const lean = -outward * blade.leanOut + blade.leanJitter
      dummy.position.set(blade.x, blade.h / 2, blade.z)
      dummy.rotation.set(0, blade.yaw + yaw, lean + sway)
      dummy.scale.set(blade.w, blade.h, 1)
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
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={map} transparent alphaTest={0.45} side={2} />
    </instancedMesh>
  )
}
