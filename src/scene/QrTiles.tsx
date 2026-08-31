import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, Object3D } from 'three'
import { moduleViewHex } from '../qr/contrast'
import type { ModuleGrid } from '../qr/types'
import type { SceneRef } from './sceneState'
import type { TreeRig } from './tree'
import { isGrassCell } from './treeSpecies'
import { easeInOutCubic } from './view'

const dummy = new Object3D()
const tint = new Color()

function spinOf(x: number, y: number): number {
  return (((x * 73 + y * 37) % 20) / 20) * 0.7
}

/**
 * One solid tile per dark module. Finder corners wear the tree's ink,
 * meadow tiles wear grass, canopy tiles wear leaves. During the camera-led
 * conversion they start in the crown as loose, tilted blocks and settle
 * into the flat mosaic.
 */
export function QrTiles({ grid, scene, rig }: { grid: ModuleGrid; scene: SceneRef; rig: TreeRig }) {
  const mesh = useRef<InstancedMesh>(null)
  const key = useRef('')
  const dark = useMemo(() => grid.cells.filter((cell) => cell.dark), [grid])
  const half = (grid.size - 1) / 2
  const heights = useMemo(() => {
    const sum = new Float64Array(grid.size * grid.size)
    const n = new Uint16Array(grid.size * grid.size)
    for (const leaf of rig.leaves) {
      const x = Math.round(leaf.cell[0] + half)
      const y = Math.round(leaf.cell[1] + half)
      const i = y * grid.size + x
      if (i >= 0 && i < sum.length) {
        sum[i] += leaf.position[1]
        n[i]++
      }
    }
    const out = new Float32Array(sum.length)
    for (let i = 0; i < out.length; i++) out[i] = n[i] ? sum[i] / n[i] : 0.12
    return out
  }, [rig.leaves, grid.size, half])

  useFrame(() => {
    const inst = mesh.current
    if (!inst) return
    const t = easeInOutCubic(scene.current.inkMix)
    dark.forEach((cell, index) => {
      const grass = isGrassCell(cell.x, cell.y, grid.size)
      const startY = grass ? 0.1 : heights[cell.y * grid.size + cell.x]!
      const y = grass ? 0.1 : startY * (1 - 0.08 * t)
      const spin = spinOf(cell.x, cell.y)
      dummy.position.set(cell.x - half, y, cell.y - half)
      dummy.rotation.set((1 - t) * 0.42, (1 - t) * spin, (1 - t) * 0.18)
      const sx = 0.36 + 0.6 * t
      const sy = grass ? 0.12 : 0.7 - 0.58 * t
      dummy.scale.set(sx, Math.max(0.08, sy), sx)
      dummy.updateMatrix()
      inst.setMatrixAt(index, dummy.matrix)
    })
    inst.instanceMatrix.needsUpdate = true

    const colors = scene.current.colors
    const next = `${colors.foliage}|${colors.foliageVar}|${colors.finder}|${colors.grass}|${colors.grassTip}|${grid.size}`
    if (next === key.current) return
    key.current = next
    dark.forEach((cell, index) => {
      tint.set(moduleViewHex(cell, colors, grid.size))
      inst.setColorAt(index, tint)
    })
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, dark.length]} key={dark.length} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </instancedMesh>
  )
}
