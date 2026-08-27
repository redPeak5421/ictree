import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, MeshBasicMaterial, Object3D } from 'three'
import { toLumaHex } from '../qr/contrast'
import type { ModuleGrid } from '../qr/types'
import { mixHex } from './palettes'
import type { SceneRef } from './sceneState'
import { BLOCK_H, isCornerModule, islandExtent, SLAB_H, type TreeRig } from './tree'
import { leafTexture } from './leafTexture'
import { mulberry32 } from './hash'
import { sceneryOpacity } from './view'

const dummy = new Object3D()
const tint = new Color()

const LITTER = 38
const CREAM = '#f2efe6'

/**
 * A paved island with the code cut into it as a relief: every dark module is a
 * raised block whose side faces show the pattern from any oblique view, the
 * way the reference's tiles do. Under the tree the blocks are stone, their
 * tops a touch lighter than the paving, so from above the stone carries no
 * ink — the canopy is the code. In the four corners they are turf, and their
 * tops are the ink of the finder patterns, with grass standing on them.
 */
export function Ground({ grid, rig, scene }: { grid: ModuleGrid; rig: TreeRig; scene: SceneRef }) {
  const topMat = useRef<MeshBasicMaterial>(null)
  const sideMat = useRef<MeshBasicMaterial>(null)
  const litter = useRef<InstancedMesh>(null)
  const litterMat = useRef<MeshBasicMaterial>(null)
  const blocks = useRef<InstancedMesh>(null)
  const lawns = useRef<InstancedMesh>(null)
  const island = islandExtent(grid.size)
  const half = (grid.size - 1) / 2
  const key = useRef('')
  const map = useMemo(() => leafTexture(), [])

  const stoneCells = useMemo(
    () => grid.cells.filter((cell) => cell.dark && !isCornerModule(cell.x, cell.y, grid.size)),
    [grid],
  )

  // BoxGeometry groups run +x, -x, +y, -y, +z, -z. The island can be turned
  // to any heading, so both x faces take one shade and both z faces another:
  // from every corner one visible face is lit and the other in shadow.
  const stoneMats = useMemo(() => {
    const east = new MeshBasicMaterial()
    const south = new MeshBasicMaterial()
    const top = new MeshBasicMaterial()
    return [east, east, top, top, south, south]
  }, [])
  // Turf takes its colour per instance; the side faces darken it.
  const lawnMats = useMemo(() => {
    const side = new MeshBasicMaterial({ color: '#a8a8a8' })
    const shade = new MeshBasicMaterial({ color: '#8c8c8c' })
    const top = new MeshBasicMaterial({ color: '#ffffff' })
    return [side, side, top, top, shade, shade]
  }, [])

  const fallen = useMemo(() => {
    const rng = mulberry32(grid.size * 7919 + 13)
    const isDark = (x: number, z: number) => {
      const mx = Math.round(x + half)
      const mz = Math.round(z + half)
      return mx >= 0 && mz >= 0 && mx < grid.size && mz < grid.size && grid.cells[mz * grid.size + mx]!.dark
    }
    return Array.from({ length: LITTER }, () => {
      const x = (rng() * 2 - 1) * (grid.size / 2)
      const z = (rng() * 2 - 1) * (grid.size / 2)
      return {
        x,
        z,
        // Leaves that fall on a block lie on top of it, not inside it.
        y: (isDark(x, z) ? BLOCK_H : 0) + 0.03,
        rot: rng() * Math.PI * 2,
        scale: 0.4 + rng() * 0.3,
      }
    })
  }, [grid, half])

  useLayoutEffect(() => {
    const inst = litter.current
    if (!inst) return
    fallen.forEach((leaf, i) => {
      dummy.position.set(leaf.x, leaf.y, leaf.z)
      dummy.rotation.set(-Math.PI / 2, 0, leaf.rot)
      dummy.scale.setScalar(leaf.scale)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    })
    inst.instanceMatrix.needsUpdate = true
  }, [fallen])

  useLayoutEffect(() => {
    dummy.rotation.set(0, 0, 0)
    dummy.scale.setScalar(1)
    const stone = blocks.current
    if (stone) {
      stoneCells.forEach((cell, i) => {
        dummy.position.set(cell.x - half, BLOCK_H / 2, cell.y - half)
        dummy.updateMatrix()
        stone.setMatrixAt(i, dummy.matrix)
      })
      stone.instanceMatrix.needsUpdate = true
    }
    const turf = lawns.current
    if (turf) {
      rig.lawns.forEach((lawn, i) => {
        dummy.position.set(lawn.cell[0], BLOCK_H / 2, lawn.cell[1])
        dummy.updateMatrix()
        turf.setMatrixAt(i, dummy.matrix)
      })
      turf.instanceMatrix.needsUpdate = true
    }
    key.current = ''
  }, [stoneCells, rig, half])

  useFrame(() => {
    const { colors, season, pitch } = scene.current
    const next = `${colors.pathLight}|${colors.pathDark}|${colors.pathEdge}|${colors.grass}|${colors.grassTip}`
    if (next !== key.current) {
      key.current = next
      // Paving and stone tops sit well above any ink, so from overhead they
      // are the code's light modules whatever the season.
      const floor = mixHex(colors.pathLight, CREAM, 0.55)
      topMat.current?.color.set(floor)
      sideMat.current?.color.set(mixHex(colors.pathEdge, '#8d8a83', 0.45))
      const [east, , top, , south] = stoneMats
      // Lit along x: the x faces are the stone's own shade, the z faces a
      // step darker, so the relief reads without a light from any side.
      east!.color.set(colors.pathDark)
      south!.color.set(mixHex(colors.pathDark, '#000000', 0.18))
      top!.color.set(mixHex(floor, '#ffffff', 0.3))
      const turf = lawns.current
      if (turf) {
        // Turf lands khaki, as in the reference, so the code's corners read
        // as grass rather than as more leaves; luma is pinned per module.
        const tones = [
          colors.grass,
          mixHex(colors.grass, colors.grassTip, 0.35),
          mixHex(colors.grass, colors.grassTip, 0.7),
          colors.grassTip,
        ]
        rig.lawns.forEach((lawn, i) => {
          tint.set(toLumaHex(mixHex(tones[lawn.tone]!, '#c9ad4a', 0.55), lawn.ink))
          turf.setColorAt(i, tint)
        })
        if (turf.instanceColor) turf.instanceColor.needsUpdate = true
      }
    }
    const mat = litterMat.current
    if (mat) {
      mat.color.set(season === 'spring' ? colors.accent : colors.foliage)
      const opacity = sceneryOpacity(pitch)
      mat.opacity = opacity
      mat.visible = opacity > 0.01
    }
  })

  return (
    <group>
      <mesh position={[0, -SLAB_H / 2 - 0.01, 0]}>
        <boxGeometry args={[island, SLAB_H, island]} />
        <meshBasicMaterial ref={sideMat} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[island, island]} />
        <meshBasicMaterial ref={topMat} />
      </mesh>
      <instancedMesh
        ref={blocks}
        args={[undefined, undefined, stoneCells.length]}
        key={`k${stoneCells.length}`}
        material={stoneMats}
        frustumCulled={false}
      >
        <boxGeometry args={[1, BLOCK_H, 1]} />
      </instancedMesh>
      <instancedMesh
        ref={lawns}
        args={[undefined, undefined, rig.lawns.length]}
        key={`g${rig.lawns.length}`}
        material={lawnMats}
        frustumCulled={false}
      >
        <boxGeometry args={[1, BLOCK_H, 1]} />
      </instancedMesh>
      <instancedMesh ref={litter} args={[undefined, undefined, LITTER]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={litterMat}
          map={map}
          transparent
          alphaTest={0.4}
          depthWrite={false}
          side={2}
        />
      </instancedMesh>
    </group>
  )
}
