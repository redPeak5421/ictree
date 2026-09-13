import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  Color,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  OrthographicCamera,
  Quaternion,
  StaticDrawUsage,
  Vector3,
  type Texture,
} from 'three'
import { toLumaHex } from '../qr/contrast'
import {
  canAdvanceLeafGather,
  initialLeafGatherProgress,
  leafGatherColorCacheKey,
  leafGatherEndpointTransition,
  leafGatherTargetPixelSize,
  leafGatherTextRevealTransition,
  leafGatherVariation,
  packLeafGatherAttributes,
  stepLeafGatherProgress,
  type LeafGatherEndpointState,
  type LeafGatherFrame,
  type LeafGatherTransform,
  type LeafGatherTextRevealState,
  type LeafGatherVariation,
  type LeafGatherVector,
} from './leafGather'
import { LEAF_ALPHA_THRESHOLD, revealBlend, sampleLeafTargets } from './leafReveal'
import { createLeafTextRaster } from './leafTextRaster'
import { fruitTexture, leafTexture, petalTexture } from './leafTexture'
import { LEAF_SHAPES, type LeafShape } from './leafShape'
import { hashString } from './hash'
import { foliageTones, mixHex, ornamentOf, type Season } from './palettes'
import type { SceneRef } from './sceneState'
import { FRUIT_HANG, ornamentScale, pickFruitOrnaments } from './scatter'
import type { FillerInstance, LeafInstance, TreeRig } from './tree'
import { leafLuma } from './treeAppearance'
import { PINE_ENABLED, type TreeSpecies } from './treeSpecies'

const dummy = new Object3D()
const PINE_SHAPES: readonly LeafShape[] = ['pine', 'pineTwig', 'pineCanopy']
const LIVE_SHAPES: readonly LeafShape[] = PINE_ENABLED
  ? LEAF_SHAPES
  : LEAF_SHAPES.filter((shape) => !PINE_SHAPES.includes(shape))

function byShape<T>(): Record<LeafShape, T[]> {
  return Object.fromEntries(LIVE_SHAPES.map((shape) => [shape, [] as T[]])) as Record<LeafShape, T[]>
}

/** Anything a blossom or fruit can hang from. */
type OrnamentHost = Pick<FillerInstance, 'position' | 'euler' | 'scale' | 'ink'>

interface SourceGroups {
  leaves: Record<LeafShape, LeafInstance[]>
  filler: Record<LeafShape, FillerInstance[]>
  ornaments: OrnamentHost[]
}

interface Motion<T> {
  source: T
  from: LeafGatherTransform
  to: LeafGatherTransform
  variation: LeafGatherVariation
}

interface MotionGroups {
  leaves: Record<LeafShape, Motion<LeafInstance>[]>
  filler: Record<LeafShape, Motion<FillerInstance>[]>
  ornaments: Motion<OrnamentHost>[]
}

interface FrozenCamera {
  frame: LeafGatherFrame
  planeCenter: LeafGatherVector
  quaternion: readonly [number, number, number, number]
  stageWidth: number
  stageHeight: number
  worldUnitsPerPixelX: number
  worldUnitsPerPixelY: number
}

function tuple3(vector: Vector3): LeafGatherVector {
  return [vector.x, vector.y, vector.z]
}

function tuple4(quaternion: Quaternion): readonly [number, number, number, number] {
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w]
}

function transformOf(
  position: readonly [number, number, number],
  euler: readonly [number, number, number],
  scale: number,
): LeafGatherTransform {
  const quaternion = new Quaternion().setFromEuler(new Euler(euler[0], euler[1], euler[2], 'YXZ'))
  return {
    position: [position[0], position[1], position[2]],
    quaternion: tuple4(quaternion),
    scale: [scale, scale, scale],
  }
}

function ornamentTransform(host: OrnamentHost, fruit: boolean): LeafGatherTransform {
  return transformOf(
    [host.position[0], host.position[1] + (fruit ? -FRUIT_HANG : 0.05), host.position[2]],
    [fruit ? -0.25 : host.euler[0], host.euler[1], 0],
    ornamentScale(host, fruit),
  )
}

function captureCamera(
  camera: OrthographicCamera,
  stageWidth: number,
  stageHeight: number,
  rig: TreeRig,
): FrozenCamera {
  camera.updateMatrixWorld()
  const frozenStageWidth = Math.max(1, Math.round(stageWidth))
  const frozenStageHeight = Math.max(1, Math.round(stageHeight))
  const cameraQuaternion = camera.getWorldQuaternion(new Quaternion())
  const right = new Vector3(1, 0, 0).applyQuaternion(cameraQuaternion).normalize()
  const up = new Vector3(0, 1, 0).applyQuaternion(cameraQuaternion).normalize()
  const depth = camera.getWorldDirection(new Vector3()).normalize()
  const treeCenter = new Vector3(0, rig.crownTop * 0.5, 0)
  const distanceToTree = Math.max(1, treeCenter.clone().sub(camera.position).dot(depth))
  const planeCenter = camera.position.clone().addScaledVector(depth, distanceToTree * 0.62)
  const zoom = Math.max(Number.EPSILON, camera.zoom)
  return {
    frame: { right: tuple3(right), up: tuple3(up), depth: tuple3(depth) },
    planeCenter: tuple3(planeCenter),
    quaternion: tuple4(cameraQuaternion),
    stageWidth: frozenStageWidth,
    stageHeight: frozenStageHeight,
    worldUnitsPerPixelX: (camera.right - camera.left) / zoom / frozenStageWidth,
    worldUnitsPerPixelY: (camera.top - camera.bottom) / zoom / frozenStageHeight,
  }
}

function targetTransform(
  x: number,
  y: number,
  pixelDiameter: number,
  variation: LeafGatherVariation,
  frozen: FrozenCamera,
): LeafGatherTransform {
  const horizontal = (x - frozen.stageWidth / 2) * frozen.worldUnitsPerPixelX
  const vertical = (frozen.stageHeight / 2 - y) * frozen.worldUnitsPerPixelY
  const position = [0, 1, 2].map((axis) => frozen.planeCenter[axis]!
    + frozen.frame.right[axis]! * horizontal
    + frozen.frame.up[axis]! * vertical) as [number, number, number]
  const cameraQuaternion = new Quaternion(...frozen.quaternion)
  const spin = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), variation.side * 0.42)
  const quaternion = tuple4(cameraQuaternion.multiply(spin))
  return {
    position,
    quaternion,
    scale: [
      pixelDiameter * frozen.worldUnitsPerPixelX,
      pixelDiameter * frozen.worldUnitsPerPixelY,
      1,
    ],
  }
}

const GATHER_VERTEX_PARAMETERS = /* glsl */ `
attribute vec3 gatherTargetPosition;
attribute vec4 gatherTargetQuaternion;
attribute vec3 gatherTargetScale;
attribute vec4 gatherMotion;
attribute vec2 gatherSpin;
uniform float gatherProgress;
uniform vec3 gatherRight;
uniform vec3 gatherUp;
uniform vec3 gatherDepth;

vec4 gatherQuaternionFromRotation( mat3 matrix ) {
  float trace = matrix[ 0 ][ 0 ] + matrix[ 1 ][ 1 ] + matrix[ 2 ][ 2 ];
  vec4 quaternion;
  if ( trace > 0.0 ) {
    float scale = sqrt( trace + 1.0 ) * 2.0;
    quaternion = vec4(
      ( matrix[ 1 ][ 2 ] - matrix[ 2 ][ 1 ] ) / scale,
      ( matrix[ 2 ][ 0 ] - matrix[ 0 ][ 2 ] ) / scale,
      ( matrix[ 0 ][ 1 ] - matrix[ 1 ][ 0 ] ) / scale,
      0.25 * scale
    );
  } else if ( matrix[ 0 ][ 0 ] > matrix[ 1 ][ 1 ] && matrix[ 0 ][ 0 ] > matrix[ 2 ][ 2 ] ) {
    float scale = sqrt( 1.0 + matrix[ 0 ][ 0 ] - matrix[ 1 ][ 1 ] - matrix[ 2 ][ 2 ] ) * 2.0;
    quaternion = vec4(
      0.25 * scale,
      ( matrix[ 1 ][ 0 ] + matrix[ 0 ][ 1 ] ) / scale,
      ( matrix[ 2 ][ 0 ] + matrix[ 0 ][ 2 ] ) / scale,
      ( matrix[ 1 ][ 2 ] - matrix[ 2 ][ 1 ] ) / scale
    );
  } else if ( matrix[ 1 ][ 1 ] > matrix[ 2 ][ 2 ] ) {
    float scale = sqrt( 1.0 + matrix[ 1 ][ 1 ] - matrix[ 0 ][ 0 ] - matrix[ 2 ][ 2 ] ) * 2.0;
    quaternion = vec4(
      ( matrix[ 1 ][ 0 ] + matrix[ 0 ][ 1 ] ) / scale,
      0.25 * scale,
      ( matrix[ 2 ][ 1 ] + matrix[ 1 ][ 2 ] ) / scale,
      ( matrix[ 2 ][ 0 ] - matrix[ 0 ][ 2 ] ) / scale
    );
  } else {
    float scale = sqrt( 1.0 + matrix[ 2 ][ 2 ] - matrix[ 0 ][ 0 ] - matrix[ 1 ][ 1 ] ) * 2.0;
    quaternion = vec4(
      ( matrix[ 2 ][ 0 ] + matrix[ 0 ][ 2 ] ) / scale,
      ( matrix[ 2 ][ 1 ] + matrix[ 1 ][ 2 ] ) / scale,
      0.25 * scale,
      ( matrix[ 0 ][ 1 ] - matrix[ 1 ][ 0 ] ) / scale
    );
  }
  return normalize( quaternion );
}

vec4 gatherQuaternionSlerp( vec4 fromValue, vec4 toValue, float amount ) {
  vec4 fromQuaternion = normalize( fromValue );
  vec4 toQuaternion = normalize( toValue );
  float cosine = dot( fromQuaternion, toQuaternion );
  if ( cosine < 0.0 ) {
    cosine = -cosine;
    toQuaternion = -toQuaternion;
  }
  if ( cosine > 0.9995 ) return normalize( mix( fromQuaternion, toQuaternion, amount ) );
  float angle = acos( clamp( cosine, -1.0, 1.0 ) );
  float sine = sin( angle );
  return (
    fromQuaternion * sin( ( 1.0 - amount ) * angle )
    + toQuaternion * sin( amount * angle )
  ) / sine;
}

vec4 gatherQuaternionMultiply( vec4 left, vec4 right ) {
  return normalize( vec4(
    left.w * right.xyz + right.w * left.xyz + cross( left.xyz, right.xyz ),
    left.w * right.w - dot( left.xyz, right.xyz )
  ) );
}

vec3 gatherQuaternionRotate( vec4 quaternion, vec3 value ) {
  return value + 2.0 * cross(
    quaternion.xyz,
    cross( quaternion.xyz, value ) + quaternion.w * value
  );
}
`

const GATHER_BEGIN_VERTEX = /* glsl */ `
#ifdef USE_INSTANCING
  float gatherLocal = clamp(
    ( gatherProgress - gatherMotion.x ) / max( 0.000001, 1.0 - gatherMotion.x ),
    0.0,
    1.0
  );
  if ( gatherProgress <= 0.0 || gatherLocal <= 0.0 ) {
    transformed = ( instanceMatrix * vec4( position, 1.0 ) ).xyz;
  } else if ( gatherProgress >= 1.0 ) {
    transformed = gatherTargetPosition
      + gatherQuaternionRotate( gatherTargetQuaternion, position * gatherTargetScale );
  } else {
    float gatherEased = gatherLocal * gatherLocal * ( 3.0 - 2.0 * gatherLocal );
    float gatherFlight = sin( PI * gatherLocal );
    vec3 gatherSourcePosition = instanceMatrix[ 3 ].xyz;
    vec3 gatherSourceScale = vec3(
      length( instanceMatrix[ 0 ].xyz ),
      length( instanceMatrix[ 1 ].xyz ),
      length( instanceMatrix[ 2 ].xyz )
    );
    mat3 gatherSourceRotation = mat3(
      instanceMatrix[ 0 ].xyz / gatherSourceScale.x,
      instanceMatrix[ 1 ].xyz / gatherSourceScale.y,
      instanceMatrix[ 2 ].xyz / gatherSourceScale.z
    );
    vec4 gatherSourceQuaternion = gatherQuaternionFromRotation( gatherSourceRotation );
    vec3 gatherCenter = mix( gatherSourcePosition, gatherTargetPosition, gatherEased )
      + gatherUp * gatherMotion.y * gatherFlight
      + gatherDepth * gatherMotion.z * gatherFlight
      + gatherRight * gatherMotion.w * gatherFlight;
    vec4 gatherBaseQuaternion = gatherQuaternionSlerp(
      gatherSourceQuaternion,
      gatherTargetQuaternion,
      gatherEased
    );
    vec3 gatherTwistAxis = normalize( gatherUp + gatherDepth * 0.35 + gatherRight * 0.2 );
    float gatherHalfTwist = gatherSpin.x * gatherFlight * 0.5;
    vec4 gatherTwistQuaternion = vec4(
      gatherTwistAxis * sin( gatherHalfTwist ),
      cos( gatherHalfTwist )
    );
    vec4 gatherQuaternion = gatherQuaternionMultiply(
      gatherBaseQuaternion,
      gatherTwistQuaternion
    );
    vec3 gatherScale = mix( gatherSourceScale, gatherTargetScale, gatherEased )
      * ( 1.0 + gatherSpin.y * gatherFlight );
    transformed = gatherCenter + gatherQuaternionRotate(
      gatherQuaternion,
      position * gatherScale
    );
  }
#endif
`

const GATHER_PROJECT_VERTEX = /* glsl */ `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  mvPosition = batchingMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`

function injectGatherVertexShader(source: string): string {
  const withParameters = source.replace(
    '#include <common>',
    `#include <common>\n${GATHER_VERTEX_PARAMETERS}`,
  )
  const withMotion = withParameters.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>\n${GATHER_BEGIN_VERTEX}`,
  )
  const complete = withMotion.replace('#include <project_vertex>', GATHER_PROJECT_VERTEX)
  if (complete === source || complete.includes('#include <project_vertex>')) {
    throw new Error('Leaf-gather shader could not find the expected Three.js vertex chunks.')
  }
  return complete
}

interface GatherUniforms {
  progress: { value: number }
  right: { value: Vector3 }
  up: { value: Vector3 }
  depth: { value: Vector3 }
}

interface GatherMaterialState {
  progress: number
  frame: LeafGatherFrame
  uniforms?: GatherUniforms
}

const GATHER_MATERIAL_STATE = 'leafGatherMaterialState'

function gatherMaterialState(material: MeshBasicMaterial): GatherMaterialState | undefined {
  return material.userData[GATHER_MATERIAL_STATE] as GatherMaterialState | undefined
}

function configureGatherMaterial(
  material: MeshBasicMaterial,
  frame: LeafGatherFrame,
  progress: number,
) {
  const found = gatherMaterialState(material)
  if (found) {
    found.frame = frame
    found.progress = progress
    found.uniforms?.right.value.set(...frame.right)
    found.uniforms?.up.value.set(...frame.up)
    found.uniforms?.depth.value.set(...frame.depth)
    return
  }
  const state: GatherMaterialState = { frame, progress }
  material.userData[GATHER_MATERIAL_STATE] = state
  material.onBeforeCompile = (shader) => {
    const current = gatherMaterialState(material) ?? state
    const uniforms: GatherUniforms = {
      progress: { value: current.progress },
      right: { value: new Vector3(...current.frame.right) },
      up: { value: new Vector3(...current.frame.up) },
      depth: { value: new Vector3(...current.frame.depth) },
    }
    shader.uniforms.gatherProgress = uniforms.progress
    shader.uniforms.gatherRight = uniforms.right
    shader.uniforms.gatherUp = uniforms.up
    shader.uniforms.gatherDepth = uniforms.depth
    shader.vertexShader = injectGatherVertexShader(shader.vertexShader)
    current.uniforms = uniforms
  }
  material.customProgramCacheKey = () => 'ictree-leaf-gather-gpu-v1'
  material.needsUpdate = true
}

function initializeGatherMesh<T>(
  mesh: InstancedMesh | null | undefined,
  items: readonly Motion<T>[],
  frame: LeafGatherFrame,
  progress: number,
  initialized: WeakSet<InstancedMesh>,
) {
  if (!mesh || !(mesh.material instanceof MeshBasicMaterial)) return
  if (!initialized.has(mesh)) {
    items.forEach((item, index) => {
      dummy.position.set(...item.from.position)
      dummy.quaternion.set(...item.from.quaternion)
      dummy.scale.set(...item.from.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })
    mesh.instanceMatrix.setUsage(StaticDrawUsage)
    mesh.instanceMatrix.needsUpdate = true
    initialized.add(mesh)
  }
  const packed = packLeafGatherAttributes(items.map((item) => ({
    target: item.to,
    variation: item.variation,
  })))
  mesh.geometry.setAttribute(
    'gatherTargetPosition',
    new InstancedBufferAttribute(packed.targetPosition, 3).setUsage(StaticDrawUsage),
  )
  mesh.geometry.setAttribute(
    'gatherTargetQuaternion',
    new InstancedBufferAttribute(packed.targetQuaternion, 4).setUsage(StaticDrawUsage),
  )
  mesh.geometry.setAttribute(
    'gatherTargetScale',
    new InstancedBufferAttribute(packed.targetScale, 3).setUsage(StaticDrawUsage),
  )
  mesh.geometry.setAttribute(
    'gatherMotion',
    new InstancedBufferAttribute(packed.motion, 4).setUsage(StaticDrawUsage),
  )
  mesh.geometry.setAttribute(
    'gatherSpin',
    new InstancedBufferAttribute(packed.spin, 2).setUsage(StaticDrawUsage),
  )
  configureGatherMaterial(mesh.material, frame, progress)
}

function setGatherOpacity(
  mesh: InstancedMesh | null | undefined,
  opacity: number,
  sourceTransparent: boolean,
) {
  if (!mesh || !(mesh.material instanceof MeshBasicMaterial)) return
  const transparent = sourceTransparent || opacity < 1
  if (mesh.material.transparent !== transparent) {
    mesh.material.transparent = transparent
    mesh.material.needsUpdate = true
  }
  mesh.material.opacity = opacity
  mesh.material.depthWrite = opacity > 0.88
  mesh.material.alphaTest = 0.42 * (0.25 + 0.75 * opacity)
}

function setGatherProgress(mesh: InstancedMesh | null | undefined, progress: number) {
  if (!mesh || !(mesh.material instanceof MeshBasicMaterial)) return
  const state = gatherMaterialState(mesh.material)
  if (!state) return
  state.progress = progress
  if (state.uniforms) state.uniforms.progress.value = progress
}

export interface LeafGatherProps {
  rig: TreeRig
  scene: SceneRef
  tree: TreeSpecies
  season: Season
  text: string
  closing: boolean
  reduced: boolean
  waitForPlants?: boolean
  onTextReveal: () => void
  onSettled: () => void
  onClosed: () => void
}

/** A source-faithful canopy that gathers into a frozen camera-facing text mask. */
export function LeafGather({
  rig,
  scene,
  tree,
  season,
  text,
  closing,
  reduced,
  waitForPlants = false,
  onTextReveal,
  onSettled,
  onClosed,
}: LeafGatherProps) {
  const { camera, size } = useThree()
  if (!(camera instanceof OrthographicCamera)) {
    throw new Error('LeafGather requires the scene OrthographicCamera.')
  }

  const leafRefs = useRef<Partial<Record<LeafShape, InstancedMesh | null>>>({})
  const fillerRefs = useRef<Partial<Record<LeafShape, InstancedMesh | null>>>({})
  const ornamentRef = useRef<InstancedMesh>(null)
  const progressRef = useRef(initialLeafGatherProgress(closing))
  const initializedMeshesRef = useRef(new WeakSet<InstancedMesh>())
  const endpointStateRef = useRef<LeafGatherEndpointState>({
    direction: closing ? 'closing' : 'opening',
    notified: false,
  })
  const textRevealStateRef = useRef<LeafGatherTextRevealState>({ notified: false })
  const callbacksRef = useRef({ onTextReveal, onSettled, onClosed })
  callbacksRef.current = { onTextReveal, onSettled, onClosed }

  const leafMaps = useMemo(() => {
    const maps = {} as Record<LeafShape, Texture>
    for (const shape of LIVE_SHAPES) maps[shape] = leafTexture(shape)
    return maps
  }, [])
  const blossomMap = useMemo(() => petalTexture(), [])
  const fruitMap = useMemo(() => fruitTexture('round'), [])
  const colorKey = useRef('')
  const ornamentKind = ornamentOf(season, tree)
  const fruiting = ornamentKind === 'fruit'
  const leafMap = (shape: LeafShape): Texture =>
    shape === 'appleHeap' && !fruiting ? leafMaps.appleCanopy : leafMaps[shape]
  const fillerMap = (shape: LeafShape): Texture =>
    shape === 'cherry' && tree === 'cherry' && season === 'spring' ? leafMaps.blossom : leafMap(shape)

  const sources = useMemo<SourceGroups>(() => {
    const leaves = byShape<LeafInstance>()
    for (const leaf of rig.leaves) leaves[leaf.shape]?.push(leaf)
    const filler = byShape<FillerInstance>()
    const thin = ornamentKind === 'fruit'
    rig.filler.forEach((leaf, index) => {
      if (thin && index % 3 === 0) return
      filler[leaf.shape]?.push(leaf)
    })
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
    return { leaves, filler, ornaments }
  }, [rig, ornamentKind])

  const frozenCameraRef = useRef<FrozenCamera | null>(null)
  if (!frozenCameraRef.current) {
    frozenCameraRef.current = captureCamera(camera, size.width, size.height, rig)
  }
  const frozenCamera = frozenCameraRef.current
  const raster = useMemo(
    () => createLeafTextRaster(text, frozenCamera.stageWidth, frozenCamera.stageHeight),
    [frozenCamera, text],
  )
  const sourceCount = useMemo(() => LIVE_SHAPES.reduce(
    (count, shape) => count + sources.leaves[shape].length + sources.filler[shape].length,
    sources.ornaments.length,
  ), [sources])
  const activePixelCount = useMemo(() => {
    let count = 0
    for (const alpha of raster.alphaMask) {
      if (alpha > LEAF_ALPHA_THRESHOLD) count += 1
    }
    return count
  }, [raster])
  const targetPixelDiameter = leafGatherTargetPixelSize(
    raster.layout.fontSize,
    activePixelCount,
    sourceCount,
  )

  const motions = useMemo<MotionGroups>(() => {
    const seed = hashString(`${text}\u0000${tree}\u0000${season}\u0000${sourceCount}`)
    const targets = sampleLeafTargets(
      raster.alphaMask,
      raster.stageWidth,
      raster.stageHeight,
      sourceCount,
      seed,
    )
    let globalIndex = 0
    const makeMotion = <T,>(
      source: T,
      from: LeafGatherTransform,
      targetScale = 1,
    ): Motion<T> => {
      const target = targets[globalIndex]!
      const variation = leafGatherVariation(globalIndex, seed)
      const to = targetTransform(
        target.x,
        target.y,
        targetPixelDiameter * targetScale,
        variation,
        frozenCamera,
      )
      globalIndex += 1
      return { source, from, to, variation }
    }
    const leaves = byShape<Motion<LeafInstance>>()
    const filler = byShape<Motion<FillerInstance>>()
    for (const shape of LIVE_SHAPES) {
      leaves[shape] = sources.leaves[shape].map((leaf) => makeMotion(
        leaf,
        transformOf(leaf.position, leaf.euler, leaf.scale),
      ))
      filler[shape] = sources.filler[shape].map((leaf) => makeMotion(
        leaf,
        transformOf(leaf.position, leaf.euler, leaf.scale),
      ))
    }
    const ornaments = sources.ornaments.map((host) => makeMotion(
      host,
      ornamentTransform(host, fruiting),
      1.12,
    ))
    return { leaves, filler, ornaments }
  }, [frozenCamera, fruiting, raster, season, sourceCount, sources, targetPixelDiameter, text, tree])

  const initializeAllMeshes = (progress: number) => {
    for (const shape of LIVE_SHAPES) {
      initializeGatherMesh(
        leafRefs.current[shape],
        motions.leaves[shape],
        frozenCamera.frame,
        progress,
        initializedMeshesRef.current,
      )
      initializeGatherMesh(
        fillerRefs.current[shape],
        motions.filler[shape],
        frozenCamera.frame,
        progress,
        initializedMeshesRef.current,
      )
    }
    initializeGatherMesh(
      ornamentRef.current,
      motions.ornaments,
      frozenCamera.frame,
      progress,
      initializedMeshesRef.current,
    )
  }

  const applyAllMaterialState = (progress: number) => {
    const opacity = revealBlend(progress).leafOpacity
    for (const shape of LIVE_SHAPES) {
      setGatherProgress(leafRefs.current[shape], progress)
      setGatherProgress(fillerRefs.current[shape], progress)
      setGatherOpacity(leafRefs.current[shape], opacity, false)
      setGatherOpacity(fillerRefs.current[shape], opacity, true)
    }
    setGatherProgress(ornamentRef.current, progress)
    setGatherOpacity(ornamentRef.current, opacity, true)
  }

  useLayoutEffect(() => {
    initializeAllMeshes(progressRef.current)
    applyAllMaterialState(progressRef.current)
    colorKey.current = ''
  }, [motions])

  useFrame((_, deltaSeconds) => {
    const direction = closing ? 'closing' : 'opening'
    const waitingForPlants = direction === 'opening'
      && !canAdvanceLeafGather(waitForPlants, scene.current.inkMix)
    const step = waitingForPlants
      ? { progress: 0, done: false }
      : stepLeafGatherProgress(
        progressRef.current,
        Math.min(deltaSeconds, 0.05),
        direction,
        reduced,
      )
    progressRef.current = step.progress
    applyAllMaterialState(step.progress)

    const { colors, pitch } = scene.current
    const lift = colors.inkLift
    const nextColorKey = leafGatherColorCacheKey({
      foliage: colors.foliage,
      foliageVar: colors.foliageVar,
      finder: colors.finder,
      accent: colors.accent,
      fruit: colors.fruit,
      inkLift: lift,
      pitch,
      tree,
      fruiting,
    })
    if (nextColorKey !== colorKey.current) {
      colorKey.current = nextColorKey
      const tones = foliageTones(colors)
      const inkCache = new Map<string, Color>()
      for (const shape of LIVE_SHAPES) {
        const leafMesh = leafRefs.current[shape]
        if (leafMesh) {
          const red = shape === 'appleHeap' && fruiting
          motions.leaves[shape].forEach(({ source }, index) => {
            const key = `${red ? 'r' : source.tone}|${source.ink}`
            let color = inkCache.get(key)
            if (!color) {
              const hex = red ? colors.fruit : tones[source.tone]!
              color = new Color(toLumaHex(hex, leafLuma(hex, source.ink + lift, pitch)))
              inkCache.set(key, color)
            }
            leafMesh.setColorAt(index, color)
          })
          if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true
        }

        const fillerMesh = fillerRefs.current[shape]
        if (fillerMesh) {
          const red = shape === 'appleHeap' && fruiting
          const fillerCache = new Map<string, Color>()
          motions.filler[shape].forEach(({ source }, index) => {
            const key = `${red ? 'r' : source.tone}|${source.ink}|${source.shade.toFixed(2)}`
            let color = fillerCache.get(key)
            if (!color) {
              const base = red ? colors.fruit : tones[source.tone]!
              const shaded = red
                ? base
                : source.shade >= 1
                ? mixHex(base, colors.foliageVar, Math.min(0.5, (source.shade - 1) * 1.6))
                : mixHex(base, colors.finder, Math.min(0.28, (1 - source.shade) * 0.9))
              color = new Color(toLumaHex(shaded, leafLuma(shaded, source.ink + lift, pitch)))
              fillerCache.set(key, color)
            }
            fillerMesh.setColorAt(index, color)
          })
          if (fillerMesh.instanceColor) fillerMesh.instanceColor.needsUpdate = true
        }
      }

      const ornamentMesh = ornamentRef.current
      if (ornamentMesh) {
        motions.ornaments.forEach(({ source }, index) => {
          const key = `o|${source.ink}`
          let color = inkCache.get(key)
          if (!color) {
            const hex = ornamentKind === 'fruit' ? colors.fruit : colors.accent
            color = new Color(toLumaHex(hex, leafLuma(hex, source.ink + lift, pitch)))
            inkCache.set(key, color)
          }
          ornamentMesh.setColorAt(index, color)
        })
        if (ornamentMesh.instanceColor) ornamentMesh.instanceColor.needsUpdate = true
      }
    }

    const textReveal = leafGatherTextRevealTransition(
      textRevealStateRef.current,
      direction,
      step.progress,
    )
    textRevealStateRef.current = textReveal.state
    if (textReveal.reveal) callbacksRef.current.onTextReveal()

    const endpoint = leafGatherEndpointTransition(
      endpointStateRef.current,
      direction,
      step.done,
    )
    endpointStateRef.current = endpoint.state
    if (endpoint.event === 'closed') callbacksRef.current.onClosed()
    else if (endpoint.event === 'settled') callbacksRef.current.onSettled()
  })

  const cutout = (map: Texture, transparent: boolean) => (
    <meshBasicMaterial map={map} transparent={transparent} alphaTest={0.42} side={2} />
  )

  return (
    <group>
      {LIVE_SHAPES.filter((shape) => motions.leaves[shape].length > 0).map((shape) => (
        <instancedMesh
          key={`${shape}${motions.leaves[shape].length}`}
          ref={(mesh) => {
            leafRefs.current[shape] = mesh
          }}
          args={[undefined, undefined, motions.leaves[shape].length]}
          frustumCulled={false}
        >
          <planeGeometry args={[1, 1]} />
          {cutout(leafMap(shape), false)}
        </instancedMesh>
      ))}
      {LIVE_SHAPES.filter((shape) => motions.filler[shape].length > 0).map((shape) => (
        <instancedMesh
          key={`f${shape}${motions.filler[shape].length}`}
          ref={(mesh) => {
            fillerRefs.current[shape] = mesh
          }}
          args={[undefined, undefined, motions.filler[shape].length]}
          frustumCulled={false}
        >
          <planeGeometry args={[1, 1]} />
          {cutout(fillerMap(shape), true)}
        </instancedMesh>
      ))}
      {motions.ornaments.length > 0 && (
        <instancedMesh
          ref={ornamentRef}
          args={[undefined, undefined, motions.ornaments.length]}
          key={`or${motions.ornaments.length}${ornamentKind}`}
          frustumCulled={false}
        >
          <planeGeometry args={[1, 1]} />
          {cutout(ornamentKind === 'fruit' ? fruitMap : blossomMap, true)}
        </instancedMesh>
      )}
    </group>
  )
}
