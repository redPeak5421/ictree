import { ISLAND_RIM, type ModuleGrid } from '../qr/types'
import { hashString, mulberry32 } from './hash'
import { fitScale, qrSlots, type Bounds, type Point2 } from './leafShape'
import type { GroundCover } from './palettes'
import { isCornerCell, isEdgeCell, type TreeSpecies } from './treeSpecies'

export type VegetationRegion = 'rim' | 'turf' | 'trunk' | 'finder'
export type VegetationForm = 'blade' | 'broad' | 'seed'

export interface VegetationInstance {
  region: VegetationRegion
  form: VegetationForm
  /** Root-pivot in world x/y/z coordinates. */
  root: [number, number, number]
  /** Centre of the clump that owns this plant, in world x/z. */
  clump: [number, number]
  height: number
  width: number
  heading: number
  lean: number
  tone: number
  phase: number
  /** Side-view wind weight. Overhead footprint ignores this. */
  gust: number
}

export interface FinderVegetationInstance extends VegetationInstance {
  region: 'finder'
  form: 'blade' | 'broad'
  /** Centre of the dark finder module that owns this plant. */
  cell: [number, number]
  ink: number
}

/**
 * Nearly-flat grass clumps that compose each finder module from above.
 * Same transform contract as a canopy leaf so the overhead rasterizer can
 * share its path. These are grass, not reserved colour plates: thirteen
 * overlapping tufts stand in for the old khaki square.
 */
export interface FinderCarpetInstance {
  position: [number, number, number]
  euler: [number, number, number]
  scale: number
  cell: [number, number]
  ink: number
  tone: number
  slot: number
}

export interface GroundLitterInstance {
  position: [number, number]
  rotation: number
  scale: number
  tone: number
  cluster: number | null
  shape: TreeSpecies
}

export const FINDER_BLADE_HEIGHT = 1.75
export const FINDER_BLADE_LEAN = 0.42
export const FINDER_ROOT_RADIUS = 0.42
export const FINDER_CARPET_SLOTS = 13
/** Dark-neighbour bleed, matching the canopy's SEAM_OVERLAP. */
const FINDER_SEAM = 0.4
const FINDER_INK = 0.41

export type VegetationTextureKind = VegetationForm

export function textureKindForVegetation(form: VegetationForm): VegetationTextureKind {
  return form
}

export function widthRangeForVegetation(form: VegetationForm): readonly [number, number] {
  if (form === 'broad') return [0.16, 0.62]
  if (form === 'seed') return [0.1, 0.28]
  return [0.09, 0.28]
}

function superellipse(count: number, halfX: number, halfY: number, exponent: number): readonly Point2[] {
  const power = 2 / exponent
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2
    const sin = Math.sin(angle)
    const cos = Math.cos(angle)
    return [
      Math.sign(sin) * Math.abs(sin) ** power * halfX,
      Math.sign(cos) * Math.abs(cos) ** power * halfY,
    ] as const
  })
}

/**
 * One grass tuft. Squarer than an ovate leaf so finder corners stay solid,
 * still a tuft rather than a reserved plate. Half-extents match `ovate` so
 * `fitScale(..., 'ovate')` cannot let a clump spill into a light module.
 */
export function carpetOutline(): readonly Point2[] {
  // Same rounded-square occupancy the old turf plate used, so neighbouring
  // dark modules meet without a pinhole. The texture draws blades inside.
  return superellipse(64, 0.495, 0.495, 6)
}

export function vegetationOutline(form: Exclude<VegetationForm, 'seed'>): readonly Point2[] {
  if (form === 'broad') {
    return [
      [-0.1, -0.5],
      [-0.24, 0.02],
      [-0.02, 0.46],
      [0.3, 0.02],
      [0.08, -0.5],
    ]
  }
  return [
    [-0.135, -0.5],
    [-0.1, -0.02],
    [0.19, 0.47],
    [0.29, 0.04],
    [0.09, -0.5],
  ]
}

function rimForm(index: number, cover: GroundCover): VegetationForm {
  const turn = index % 10
  const base: VegetationForm = turn < 5 ? 'blade' : turn < 8 ? 'broad' : 'seed'
  if (cover === 'meadow') return base
  if (cover === 'flower') return base === 'blade' && turn % 2 === 0 ? 'broad' : base
  return base === 'blade' && turn % 2 === 0 ? 'seed' : base
}

function rimHeight(index: number, rng: () => number): number {
  switch (index % 3) {
    case 0:
      return 0.26 + rng() * 0.18
    case 1:
      return 0.48 + rng() * 0.34
    default:
      return 0.92 + rng() * 0.4
  }
}

function widthFor(form: VegetationForm, rng: () => number): number {
  if (form === 'broad') return 0.34 + rng() * 0.22
  if (form === 'seed') return 0.18 + rng() * 0.1
  return 0.09 + rng() * 0.08
}

function darkAt(grid: ModuleGrid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.size && y < grid.size && grid.cells[y * grid.size + x]!.dark
}

function moduleBounds(grid: ModuleGrid, x: number, y: number): Bounds {
  const reach = (nx: number, ny: number) => (darkAt(grid, nx, ny) ? FINDER_SEAM : 0)
  return {
    left: -0.5 - reach(x - 1, y),
    right: 0.5 + reach(x + 1, y),
    back: -0.5 - reach(x, y - 1),
    front: 0.5 + reach(x, y + 1),
  }
}

function insideBounds(x: number, z: number, halfW: number, bounds: Bounds): boolean {
  return (
    x - halfW >= bounds.left - 1e-9 &&
    x + halfW <= bounds.right + 1e-9 &&
    z - halfW >= bounds.back - 1e-9 &&
    z + halfW <= bounds.front + 1e-9
  )
}

/**
 * Decorative vegetation outside the QR ink. The rim is sampled by clump,
 * leaving some tall-plant gaps, then a short turf strip fills in so the
 * island edge reads as a lawn rather than a row of stalks. Nothing here
 * sits on a light QR module — the code is formed by camera angle, not by
 * hiding a second layer.
 */
export function buildSceneryVegetation(
  grid: ModuleGrid,
  seed: number,
  cover: GroundCover = 'meadow',
): VegetationInstance[] {
  const rng = mulberry32((seed ^ hashString('scenery-vegetation')) >>> 0)
  const island = grid.size + ISLAND_RIM * 2
  const origin = -(island - 1) / 2
  const result: VegetationInstance[] = []
  let rimIndex = 0

  for (let gy = 0; gy < island; gy++) {
    for (let gx = 0; gx < island; gx++) {
      if (gx !== 0 && gy !== 0 && gx !== island - 1 && gy !== island - 1) continue
      const cellIndex = rimIndex++
      const islandCorner = (gx === 0 || gx === island - 1) && (gy === 0 || gy === island - 1)
      const cx = origin + gx
      const cz = origin + gy

      // Sit on the outer lip / slab face, not on the paving quiet zone.
      // Looking down the code stays clean; looking across, the edge is a lawn.
      const lip = (x: number, z: number): [number, number] => {
        let lx = x
        let lz = z
        if (gx === 0) lx = Math.min(lx, -island / 2 - rng() * 0.12)
        if (gx === island - 1) lx = Math.max(lx, island / 2 + rng() * 0.12)
        if (gy === 0) lz = Math.min(lz, -island / 2 - rng() * 0.12)
        if (gy === island - 1) lz = Math.max(lz, island / 2 + rng() * 0.12)
        return [lx, lz]
      }

      const turfCount = 16 + Math.floor(rng() * 8) + (islandCorner ? 8 : 0)
      for (let itemIndex = 0; itemIndex < turfCount; itemIndex++) {
        const radius = Math.sqrt(rng()) * 0.48
        const angle = rng() * Math.PI * 2
        const [x, z] = lip(cx + Math.cos(angle) * radius, cz + Math.sin(angle) * radius)
        result.push({
          region: 'turf',
          form: 'blade',
          root: [x, -0.04, z],
          clump: [cx, cz],
          height: 0.14 + rng() * 0.22,
          width: 0.14 + rng() * 0.1,
          heading: rng() * Math.PI * 2,
          lean: 0.12 + rng() * 0.4,
          tone: Math.floor(rng() * 4),
          phase: rng() * Math.PI * 2,
          gust: islandCorner ? 1.75 : 1.15,
        })
      }

      if (!islandCorner && rng() < 0.1) continue
      const large = islandCorner || rng() < 0.42
      const count = (large ? 24 + Math.floor(rng() * 10) : 14 + Math.floor(rng() * 7)) + (islandCorner ? 12 : 0)
      for (let itemIndex = 0; itemIndex < count; itemIndex++) {
        const form = rimForm(itemIndex + cellIndex, cover)
        const radius = Math.sqrt(rng()) * (islandCorner ? 0.5 : 0.44)
        const angle = rng() * Math.PI * 2
        const [x, z] = lip(cx + Math.cos(angle) * radius, cz + Math.sin(angle) * radius)
        const outward = Math.atan2(x, z)
        result.push({
          region: 'rim',
          form,
          root: [x, -0.02, z],
          clump: [cx, cz],
          height: rimHeight(itemIndex + cellIndex, rng) * (islandCorner ? 1.12 : 1),
          width: widthFor(form, rng),
          heading: outward + (rng() - 0.5) * 1.45,
          lean: 0.08 + rng() * (form === 'broad' ? 0.68 : 0.5),
          tone: Math.floor(rng() * 4),
          phase: rng() * Math.PI * 2,
          gust: islandCorner ? 1.9 : 1.4,
        })
      }
    }
  }

  const rosetteClumpCount = 4 + Math.floor(rng() * 3)
  const turn = Math.PI * (3 - Math.sqrt(5))
  for (let clumpIndex = 0; clumpIndex < rosetteClumpCount; clumpIndex++) {
    const angle = clumpIndex * turn + (rng() - 0.5) * 0.35
    const radius = 1.25 + rng() * 2
    const cx = Math.cos(angle) * radius
    const cz = Math.sin(angle) * radius
    const leafCount = 5 + Math.floor(rng() * 3)
    for (let leafIndex = 0; leafIndex < leafCount; leafIndex++) {
      const rootRadius = Math.sqrt(rng()) * 0.07
      const rootAngle = rng() * Math.PI * 2
      result.push({
        region: 'trunk',
        form: 'broad',
        root: [cx + Math.cos(rootAngle) * rootRadius, 0.02, cz + Math.sin(rootAngle) * rootRadius],
        clump: [cx, cz],
        height: 0.52 + rng() * 0.36,
        width: 0.32 + rng() * 0.3,
        heading: angle + (leafIndex / leafCount) * Math.PI * 2 + (rng() - 0.5) * 0.25,
        lean: 1.05 + rng() * 0.37,
        tone: Math.floor(rng() * 4),
        phase: rng() * Math.PI * 2,
        gust: 0.55,
      })
    }
  }

  return result
}

/** Species-matching fallen leaves gathered in irregular patches under the drip line. */
export function buildGroundLitter(grid: ModuleGrid, seed: number, species?: TreeSpecies): GroundLitterInstance[] {
  const rng = mulberry32((seed ^ hashString('ground-litter')) >>> 0)
  const shape = species ?? 'cherry'
  const count = 44 + Math.floor(rng() * 7)
  const clusterCount = 4 + Math.floor(rng() * 3)
  const clusteredCount = Math.floor(count * 0.82)
  const edge = grid.size / 2 - 0.5
  const turn = Math.PI * (3 - Math.sqrt(5))
  const centers = Array.from({ length: clusterCount }, (_, index) => {
    const angle = index * turn + rng() * 0.55
    const radius = 2 + rng() * Math.min(3, grid.size * 0.12)
    return [Math.cos(angle) * radius, Math.sin(angle) * radius] as const
  })
  const clamp = (value: number) => Math.max(-edge, Math.min(edge, value))
  const result: GroundLitterInstance[] = []

  for (let index = 0; index < count; index++) {
    const clustered = index < clusteredCount
    const cluster = clustered ? index % clusterCount : null
    let x: number
    let z: number
    if (cluster !== null) {
      const center = centers[cluster]!
      const radius = Math.sqrt(rng()) * 0.65
      const angle = rng() * Math.PI * 2
      x = center[0] + Math.cos(angle) * radius
      z = center[1] + Math.sin(angle) * radius
    } else {
      const radius = 1.1 + rng() * Math.max(1, edge - 1.6)
      const angle = rng() * Math.PI * 2
      x = Math.cos(angle) * radius
      z = Math.sin(angle) * radius
    }
    result.push({
      position: [clamp(x), clamp(z)],
      rotation: rng() * Math.PI * 2,
      scale: 0.28 + rng() * 0.34,
      tone: Math.floor(rng() * 4),
      cluster,
      shape,
    })
  }

  return result
}

/**
 * Thirteen overlapping grass tufts that are the finder modules' ink. Slots
 * and fitting are the same coverage-first layout the canopy uses, so a
 * finder is a packed lawn rather than a reserved colour plate.
 */
function buildInkCarpet(
  grid: ModuleGrid,
  seed: number,
  salt: string,
  belongs: (x: number, y: number, size: number) => boolean,
): FinderCarpetInstance[] {
  const rng = mulberry32((seed ^ hashString(salt)) >>> 0)
  const half = (grid.size - 1) / 2
  const result: FinderCarpetInstance[] = []
  const cells = grid.cells.filter((cell) => cell.dark && belongs(cell.x, cell.y, grid.size))

  for (const cell of cells) {
    const cx = cell.x - half
    const cz = cell.y - half
    const bounds = moduleBounds(grid, cell.x, cell.y)
    result.push({
      position: [cx, 0.026, cz],
      euler: [-Math.PI / 2 + 0.03, 0, 0],
      scale: 0.56 / 0.495,
      cell: [cx, cz],
      ink: FINDER_INK,
      tone: 1,
      slot: 0,
    })
    qrSlots(FINDER_CARPET_SLOTS - 1, rng).forEach((slot) => {
      result.push({
        position: [cx + slot.ox * 0.72, 0.03, cz + slot.oz * 0.72],
        euler: [-Math.PI / 2 + 0.02 + rng() * 0.06, slot.phi, 0],
        scale: fitScale(slot.ox * 0.72, slot.oz * 0.72, slot.phi, bounds, slot.cap * 0.62, 'ovate'),
        cell: [cx, cz],
        ink: FINDER_INK,
        tone: (slot.id + 1) % 4,
        slot: slot.id + 1,
      })
    })
  }

  return result
}

export function buildFinderCarpet(grid: ModuleGrid, seed: number): FinderCarpetInstance[] {
  return buildInkCarpet(grid, seed, 'finder-carpet', isCornerCell)
}

/** Same packed occupancy as the finder, on the QR rim's dark modules. */
export function buildMeadowCarpet(grid: ModuleGrid, seed: number): FinderCarpetInstance[] {
  return buildInkCarpet(grid, seed, 'meadow-carpet', isEdgeCell)
}

/**
 * Standing tufts rooted in dark grass-ink modules. Finder corners are a
 * hedge; the rim is a shorter meadow so the island edge fills without
 * becoming a second tree.
 */
function buildInkVegetation(
  grid: ModuleGrid,
  seed: number,
  salt: string,
  belongs: (x: number, y: number, size: number) => boolean,
  kind: 'finder' | 'meadow',
): FinderVegetationInstance[] {
  const rng = mulberry32((seed ^ hashString(salt)) >>> 0)
  const half = (grid.size - 1) / 2
  const result: FinderVegetationInstance[] = []
  const cells = grid.cells.filter((cell) => cell.dark && belongs(cell.x, cell.y, grid.size))

  for (const cell of cells) {
    const cx = cell.x - half
    const cz = cell.y - half
    const local = moduleBounds(grid, cell.x, cell.y)
    const bounds: Bounds = {
      left: cx + local.left,
      right: cx + local.right,
      back: cz + local.back,
      front: cz + local.front,
    }
    const meadow = kind === 'meadow'
    const count = (meadow ? 52 : 70) + Math.floor(rng() * (meadow ? 12 : 16))
    let placed = 0
    let attempts = 0
    while (placed < count && attempts < count * 10) {
      attempts++
      const lawn = placed < (meadow ? 34 : 28)
      const form = placed % (meadow ? 4 : 5) === 0 ? 'broad' : 'blade'
      const radius = Math.sqrt(rng()) * FINDER_ROOT_RADIUS
      const angle = rng() * Math.PI * 2
      const width = form === 'broad'
        ? 0.2 + rng() * 0.16
        : lawn
          ? 0.14 + rng() * 0.1
          : 0.12 + rng() * 0.12
      const height = form === 'broad'
        ? (meadow ? 0.28 + rng() * 0.4 : 0.42 + rng() * 0.55)
        : lawn
          ? 0.16 + rng() * 0.26
          : meadow
            ? 0.36 + rng() * 0.52
            : 0.72 + rng() * (FINDER_BLADE_HEIGHT - 0.72)
      const lean = form === 'broad'
        ? 0.12 + rng() * 0.26
        : lawn
          ? 0.16 + rng() * 0.22
          : 0.06 + rng() * (FINDER_BLADE_LEAN - 0.06)
      const heading = rng() * Math.PI * 2
      const root: [number, number, number] = [
        cx + Math.cos(angle) * radius,
        0.02,
        cz + Math.sin(angle) * radius,
      ]
      const tipX = root[0] + Math.sin(lean) * Math.sin(heading) * height
      const tipZ = root[2] + Math.sin(lean) * Math.cos(heading) * height
      const halfW = width / 2
      if (!insideBounds(root[0], root[2], halfW, bounds)) continue
      if (!insideBounds(tipX, tipZ, halfW, bounds)) continue
      const tone = Math.floor(rng() * 4)
      const phase = rng() * Math.PI * 2
      result.push({
        region: 'finder',
        form,
        root,
        clump: [cx, cz],
        cell: [cx, cz],
        height,
        width,
        heading,
        lean,
        tone,
        phase,
        gust: 0,
        ink: FINDER_INK,
      })
      placed++
      const crossHeading = heading + Math.PI / 2
      const crossTipX = root[0] + Math.sin(lean) * Math.sin(crossHeading) * height
      const crossTipZ = root[2] + Math.sin(lean) * Math.cos(crossHeading) * height
      if (insideBounds(crossTipX, crossTipZ, halfW, bounds)) {
        result.push({
          region: 'finder',
          form,
          root,
          clump: [cx, cz],
          cell: [cx, cz],
          height: height * 0.9,
          width,
          heading: crossHeading,
          lean,
          tone,
          phase,
          gust: 0,
          ink: FINDER_INK,
        })
        placed++
      }
    }
  }

  return result
}

export function buildFinderVegetation(grid: ModuleGrid, seed: number): FinderVegetationInstance[] {
  return buildInkVegetation(grid, seed, 'finder-vegetation', isCornerCell, 'finder')
}

export function buildMeadowVegetation(grid: ModuleGrid, seed: number): FinderVegetationInstance[] {
  return buildInkVegetation(grid, seed, 'meadow-vegetation', isEdgeCell, 'meadow')
}
