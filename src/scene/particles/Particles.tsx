import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, MeshBasicMaterial, Object3D } from 'three'
import { sceneryOpacity } from '../view'
import type { SceneRef } from '../sceneState'
import { islandExtent } from '../tree'
import { leafTexture } from '../leafTexture'
import { leafShapeFor, type TreeSpecies } from '../treeSpecies'
import type { ModuleGrid } from '../../qr/types'
import { createFallingLeaves, stepFallingLeaves } from './leaves'
import { createPetals, stepPetals } from './petals'
import { createRain, stepRain } from './rain'
import { createSummerMotes, stepSummerMotes, summerMotePulse } from './summer'

const dummy = new Object3D()
const tint = new Color()
const fireflyWarm = new Color('#f6e7a2')

export function Particles({
  grid,
  scene,
  reduced,
  species,
  raining,
}: {
  grid: ModuleGrid
  scene: SceneRef
  reduced: boolean
  species: TreeSpecies
  /** Rain is weather, chosen by the person, not by the season. */
  raining: boolean
}) {
  const island = islandExtent(grid.size)
  const rainRef = useRef<InstancedMesh>(null)
  const petalRef = useRef<InstancedMesh>(null)
  const leafRef = useRef<InstancedMesh>(null)
  const summerRef = useRef<InstancedMesh>(null)
  const rainMat = useRef<MeshBasicMaterial>(null)
  const petalMat = useRef<MeshBasicMaterial>(null)
  const leafMat = useRef<MeshBasicMaterial>(null)
  const summerMat = useRef<MeshBasicMaterial>(null)
  const map = useMemo(() => leafTexture(leafShapeFor(species)), [species])
  // What drifts down in spring is the tree's own thing: cherry blossoms, else its young leaf.
  const petalMap = useMemo(() => leafTexture(species === 'cherry' ? 'blossom' : leafShapeFor(species)), [species])
  const fluff = species === 'willow'
  const rain = useMemo(() => createRain(380, island, 11), [island])
  const petals = useMemo(() => createPetals(120, island, 22), [island])
  const falling = useMemo(() => createFallingLeaves(44, island, 33), [island])
  const summer = useMemo(() => createSummerMotes(fluff ? 88 : 64, island, 44), [fluff, island])

  useFrame((_, dt) => {
    const { colors, season, pitch } = scene.current
    const opacity = sceneryOpacity(pitch)
    const time = performance.now() / 1000
    const clamped = Math.min(dt, 0.05)
    const rainMesh = rainRef.current
    const petalMesh = petalRef.current
    const leafMesh = leafRef.current
    const summerMesh = summerRef.current

    if (rainMesh) {
      const on = raining && opacity > 0.01
      const mat = rainMat.current
      if (mat) {
        mat.opacity = raining ? opacity * 0.5 : 0
        mat.visible = on
      }
      if (on && !reduced) {
        stepRain(rain, clamped, island)
        rain.forEach((drop, i) => {
          dummy.position.set(drop.x, drop.y, drop.z)
          dummy.rotation.set(0, 0, 0.06)
          dummy.scale.set(0.045, drop.len, 0.045)
          dummy.updateMatrix()
          rainMesh.setMatrixAt(i, dummy.matrix)
        })
        rainMesh.instanceMatrix.needsUpdate = true
      }
    }

    if (petalMesh) {
      const on = season === 'spring' && opacity > 0.01
      const mat = petalMat.current
      if (mat) {
        mat.color.set(species === 'cherry' ? colors.accent : colors.foliageVar)
        mat.opacity = season === 'spring' ? opacity : 0
        mat.visible = on
      }
      if (on && !reduced) {
        stepPetals(petals, clamped, island, time)
        petals.forEach((petal, i) => {
          dummy.position.set(petal.x, petal.y, petal.z)
          dummy.rotation.set(petal.spin, petal.phase, petal.spin * 0.4)
          dummy.scale.setScalar(species === 'cherry' ? 0.55 : 0.6)
          dummy.updateMatrix()
          petalMesh.setMatrixAt(i, dummy.matrix)
        })
        petalMesh.instanceMatrix.needsUpdate = true
      }
    }

    if (leafMesh) {
      const on = season === 'autumn' && opacity > 0.01
      const mat = leafMat.current
      if (mat) {
        mat.color.set(colors.foliage)
        mat.opacity = season === 'autumn' ? opacity : 0
        mat.visible = on
      }
      if (on && !reduced) {
        stepFallingLeaves(falling, clamped, island, time)
        falling.forEach((leaf, i) => {
          dummy.position.set(leaf.x, leaf.y, leaf.z)
          dummy.rotation.set(leaf.spin, leaf.phase, leaf.spin)
          dummy.scale.setScalar(0.6)
          dummy.updateMatrix()
          leafMesh.setMatrixAt(i, dummy.matrix)
        })
        leafMesh.instanceMatrix.needsUpdate = true
      }
    }

    if (summerMesh) {
      const on = season === 'summer' && opacity > 0.01
      const mat = summerMat.current
      if (mat) {
        mat.color.set(fluff ? colors.foliageVar : '#f2d27a')
        mat.opacity = on ? opacity * (fluff ? 0.72 : 0.85) : 0
        mat.visible = on
      }
      if (on && !reduced) {
        stepSummerMotes(summer, clamped, island, time)
        summer.forEach((mote, i) => {
          const pulse = summerMotePulse(mote, time)
          dummy.position.set(mote.x, mote.y, mote.z)
          dummy.rotation.set(mote.spin * 0.3, mote.phase, mote.spin)
          dummy.scale.setScalar(fluff ? 0.42 : 0.055 + pulse * 0.04)
          dummy.updateMatrix()
          summerMesh.setMatrixAt(i, dummy.matrix)
          if (!fluff) {
            tint.set(colors.accent).lerp(fireflyWarm, pulse)
            summerMesh.setColorAt(i, tint)
          }
        })
        summerMesh.instanceMatrix.needsUpdate = true
        if (!fluff && summerMesh.instanceColor) summerMesh.instanceColor.needsUpdate = true
      }
    }
  })

  return (
    <group>
      <instancedMesh ref={rainRef} args={[undefined, undefined, rain.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial ref={rainMat} color="#b9c6d0" transparent depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={petalRef} args={[undefined, undefined, petals.length]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={petalMat} map={petalMap} transparent alphaTest={0.4} depthWrite={false} side={2} />
      </instancedMesh>
      <instancedMesh ref={leafRef} args={[undefined, undefined, falling.length]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={leafMat} map={map} transparent alphaTest={0.4} depthWrite={false} side={2} />
      </instancedMesh>
      <instancedMesh
        ref={summerRef}
        args={[undefined, undefined, summer.length]}
        key={fluff ? `fluff${summer.length}` : `glow${summer.length}`}
        frustumCulled={false}
      >
        {fluff ? <planeGeometry args={[1, 1]} /> : <sphereGeometry args={[1, 6, 6]} />}
        <meshBasicMaterial
          ref={summerMat}
          map={fluff ? map : undefined}
          transparent
          alphaTest={fluff ? 0.4 : 0}
          depthWrite={false}
          side={2}
        />
      </instancedMesh>
    </group>
  )
}
