import { moduleInkLuma } from '../qr/contrast'
import { ISLAND_RIM, type ModuleCell, type ModuleGrid } from '../qr/types'
import { colonize, type ColonizeNode, type Point } from './colonize'
import {
  buildFinderCarpet,
  buildFinderVegetation,
  buildMeadowCarpet,
  buildMeadowVegetation,
  type FinderCarpetInstance,
  type FinderVegetationInstance,
} from './grassLayout'
import { hashString, mulberry32 } from './hash'
import { fitScale, halfExtents, qrSlots, type Bounds, type LeafShape } from './leafShape'
import {
  CORNER_MODULES,
  canopyShapeFor,
  crownLayout,
  fillerShapeFor,
  isCornerCell,
  isGrassCell,
  profileFor,
  type CrownLayer,
  type TreeHabit,
  type TreeSpecies,
} from './treeSpecies'

export interface BranchInstance {
  position: [number, number, number]
  quaternion: [number, number, number, number]
  scale: [number, number, number]
  /** 0 = trunk (light bark), 1 = limb (dark bark). */
  shade: number
}

/** Euler angles in three.js 'YXZ' order: [tilt about x, heading about y, spin]. */
export type Euler3 = [number, number, number]

export type { LeafShape } from './leafShape'

export interface LeafInstance {
  kind: 'leaf'
  shape: LeafShape
  position: [number, number, number]
  /**
   * Absolute: every leaf and blade is part of the object, and a leaf's
   * top-down outline is what the code is made of. Nothing faces the camera.
   */
  euler: Euler3
  scale: number
  /** Twig tip this leaf grows from. */
  anchor: [number, number, number]
  /** Centre of the module this instance stands over, in world x/z. */
  cell: [number, number]
  /** Luma its colour is pinned to, so its module reads as one flat block of ink. */
  ink: number
  /** Index into the 4-tone ramp of its kind. */
  tone: number
  /** Stable projected slot ID inside the owning module. */
  slot: number
  /** Crown layer owned by this module. */
  layer: CrownLayer
}

export interface LawnInstance {
  cell: [number, number]
  ink: number
  tone: number
}

/**
 * Extra crown mass. Always visible, always on a dark module and luma-pinned.
 * Stacks thicken the silhouette from the side; looking down they land on the
 * same ink, so the QR bits do not change.
 */
export interface FillerInstance {
  shape: LeafShape
  position: [number, number, number]
  euler: Euler3
  scale: number
  /** Index into the 4-tone foliage ramp. */
  tone: number
  /** Natural brightness factor on the side; overhead colour is pinned to `ink`. */
  shade: number
  /** Owning module luma, so the clump remains QR-safe from above. */
  ink: number
}

export interface TreeRig {
  species: TreeSpecies
  habit: TreeHabit
  branches: BranchInstance[]
  leaves: LeafInstance[]
  /** Standing tufts that give the finder corners their 3D grass. */
  finderGrass: FinderVegetationInstance[]
  /** Nearly-flat grass blades that are the finder modules' ink. */
  finderCarpet: FinderCarpetInstance[]
  /** Dark corner modules; the 3D colour plates are gone — grass is the ink. */
  lawns: LawnInstance[]
  /** Ink-free scenery leaves that fade out before the scanning pitch. */
  filler: FillerInstance[]
  /** Highest point of the crown, so the camera can frame all of it. */
  crownTop: number
}

/**
 * How far, in module units, a silhouette may lap over into a neighbouring
 * module — and only when that neighbour is dark. Two dark modules side by side
 * are one solid patch of ink to both the eye and a decoder, so a leaf bridging
 * them changes nothing visible; what it buys is coverage, since without it
 * every module edge is scalloped by leaf outlines and the finder rings stop
 * reading as rings. Crossing into a light module is never allowed at any
 * value: the centre always stays inside its own module.
 */
export const SEAM_OVERLAP = 0.4

/** Cylinders are stretched by this so joints between segments do not gap. */
export const BRANCH_OVERLAP = 1.08

/**
 * Modules this close to a corner belong to the grass, not the tree: the three
 * finder patterns plus their separators, and the matching block at the fourth
 * corner. In the reference the code's corners are grass-coloured because the
 * island's corners are where the grass grows.
 */
export const CORNER = CORNER_MODULES

/** Default camera azimuth, before the island is turned by hand. */
export const VIEW_YAW = Math.PI / 4
/**
 * Default camera elevation above the ground, about 22deg: the reference's
 * island reads as a rhombus roughly 2.5x wider than tall.
 */
export const VIEW_PITCH = 0.38

/**
 * The corner grass: standing tufts on every dark corner module, with a
 * thirteen-tuft grass carpet that is the finder ink from above. The paving
 * carries no reserved colour plates — from the side there is a tree and
 * four patches of grass, and only straight down is there a code.
 */
export {
  FINDER_BLADE_HEIGHT as BLADE_H,
  FINDER_BLADE_LEAN as BLADE_LEAN,
  FINDER_ROOT_RADIUS as BLADE_ROOT,
} from './grassLayout'

/** Thickness of the island slab under the paving. */
export const SLAB_H = 1.05

/** Farthest a leaf may sit from the twig tip it grows on. */
export const REACH = 1.6

export function islandExtent(gridSize: number): number {
  return gridSize + ISLAND_RIM * 2
}

export function isCornerModule(x: number, y: number, size: number): boolean {
  return isCornerCell(x, y, size)
}

export function isGrassModule(x: number, y: number, size: number): boolean {
  return isGrassCell(x, y, size)
}

/**
 * The tree is the code. Seen from straight above, the canopy's outline is the
 * QR matrix — not because anything rearranges, but because of where the
 * leaves grow: every dark module inside the grassy frame owns one leaf pack
 * at one crown height, each sized so its silhouette cannot cross into a
 * light module, and no light module has a leaf over it. The corners and the
 * QR rim are grass tufts, not reserved colour plates. The trunk and twigs are pale, so where
 * they show through a light module from above they still read as light.
 *
 * Crown: a species-specific broadleaf profile on a short trunk. Each dark
 * module contributes one attraction point, and space colonization grows twigs
 * from the trunk to each pack. `sectorMass` and `reader`
 * spend the code's own bits on the main limbs and the lobes, so the same URL
 * always grows the same tree.
 */
function payloadBits(grid: ModuleGrid): number[] {
  const bits: number[] = []
  for (const cell of grid.cells) {
    if (cell.kind === 'finder' || cell.kind === 'timing' || cell.kind === 'alignment') continue
    bits.push(cell.dark ? 1 : 0)
  }
  return bits.length > 0 ? bits : [1, 0]
}

function makeReader(bits: number[]) {
  let i = 0
  const next = () => {
    const bit = bits[i % bits.length]!
    i++
    return bit
  }
  const read = (n: number) => {
    let v = 0
    for (let k = 0; k < n; k++) v = (v << 1) | next()
    return v
  }
  const unit = () => read(10) / 1024
  const range = (lo: number, hi: number) => lo + (hi - lo) * unit()
  return { read, unit, range }
}

function sectorMass(grid: ModuleGrid, sectors: number): number[] {
  const c = (grid.size - 1) / 2
  const mass = new Array<number>(sectors).fill(0)
  for (const cell of grid.cells) {
    if (!cell.dark) continue
    const dx = cell.x - c
    const dy = cell.y - c
    const r = Math.hypot(dx, dy)
    if (r < 1.5) continue
    let a = Math.atan2(dy, dx)
    if (a < 0) a += Math.PI * 2
    mass[Math.floor((a / (Math.PI * 2)) * sectors) % sectors] += r
  }
  const max = Math.max(1, ...mass)
  return mass.map((m) => m / max)
}

function quatFromUnitY(dx: number, dy: number, dz: number): [number, number, number, number] {
  const len = Math.hypot(dx, dy, dz) || 1
  const x = dx / len
  const y = dy / len
  const z = dz / len
  if (y > 0.9999) return [0, 0, 0, 1]
  if (y < -0.9999) return [1, 0, 0, 0]
  const ax = z
  const az = -x
  const qw = 1 + y
  const qlen = Math.hypot(ax, az, qw) || 1
  return [ax / qlen, 0, az / qlen, qw / qlen]
}

export interface BuildTreeOptions {
  species?: TreeSpecies
  habit?: TreeHabit
}

/**
 * Largest scale at which an upright plane (a hanging withe) stays inside its
 * module from above. Seen from overhead it is a line along its heading, plus
 * whatever its slight tilt lets the height project, so the flat-leaf fit
 * would be far too strict for it — and a naive cap lets it cross into a
 * light neighbour as a dark hairline.
 */
export function uprightFit(
  ox: number,
  oz: number,
  phi: number,
  tilt: number,
  bounds: Bounds,
  cap: number,
  shape: LeafShape,
): number {
  const [halfX, halfY] = halfExtents(shape)
  const lean = halfY * Math.abs(Math.sin(tilt))
  const c = Math.abs(Math.cos(phi))
  const s = Math.abs(Math.sin(phi))
  const extentX = halfX * c + lean * s + 1e-3
  const extentZ = halfX * s + lean * c + 1e-3
  const scale = Math.min(
    (bounds.right - ox) / extentX,
    (ox - bounds.left) / extentX,
    (bounds.front - oz) / extentZ,
    (oz - bounds.back) / extentZ,
  )
  return Math.max(0, Math.min(cap, scale * 0.985))
}

export function buildTree(grid: ModuleGrid, seed: number, options: BuildTreeOptions = {}): TreeRig {
  const island = islandExtent(grid.size)
  const bits = payloadBits(grid)
  const reader = makeReader(bits)
  const rng = mulberry32((seed ^ hashString(bits.join(''))) >>> 0)
  const species = options.species ?? 'cherry'
  const habit = options.habit ?? 'lush'
  const profile = profileFor(species)
  const crownPoints = crownLayout(grid, seed, species)

  const half = (grid.size - 1) / 2
  const trunkH = island * profile.trunkRatio
  const step = crownPoints.length > 600 ? 0.8 : 0.65

  // ---- seeds: trunk column plus one main limb per angular sector ----
  const seeds: ColonizeNode[] = []
  const trunkSteps = Math.max(2, Math.round(trunkH / step))
  for (let i = 0; i <= trunkSteps; i++) {
    seeds.push({ x: 0, y: (trunkH * i) / trunkSteps, z: 0, parent: i - 1, depth: i })
  }
  const top = seeds.length - 1
  const sectors = species === 'pine' ? 7 : species === 'maple' || species === 'apple' ? 6 : 5
  const mass = sectorMass(grid, sectors)
  const limbLen =
    island *
    (species === 'cherry' || species === 'willow' ? 0.19 : species === 'pine' ? 0.12 : 0.16)
  for (let s = 0; s < sectors; s++) {
    const weight = 0.7 + mass[s]! * 0.3
    const yaw = (s / sectors) * Math.PI * 2 + reader.range(-0.35, 0.35)
    const pitch = reader.range(profile.limbPitch[0], profile.limbPitch[1])
    const dx = Math.cos(yaw) * Math.sin(pitch)
    const dy = Math.cos(pitch)
    const dz = Math.sin(yaw) * Math.sin(pitch)
    const segs = 3
    let parent = top
    for (let k = 1; k <= segs; k++) {
      const t = (limbLen * weight * k) / segs
      seeds.push({ x: dx * t, y: trunkH + dy * t, z: dz * t, parent, depth: seeds[parent]!.depth + 1 })
      parent = seeds.length - 1
    }
  }

  // ---- one attractor per dark canopy module ----
  const dense = crownPoints.length > 600
  const growStep = dense ? 0.85 : step
  const killDist = dense ? 1.0 : 0.82
  const attractors: Point[] = []
  const owners: { point: (typeof crownPoints)[number]; at: number }[] = []
  const attractorJitter = () => (rng() - 0.5) * 0.18
  for (const point of crownPoints) {
    const cx = point.cell.x - half
    const cz = point.cell.y - half
    attractors.push({ x: cx + attractorJitter(), y: point.height, z: cz + attractorJitter() })
    owners.push({ point, at: attractors.length - 1 })
  }
  const lawnCells = grid.cells.filter(
    (cell) => cell.dark && isGrassCell(cell.x, cell.y, grid.size),
  )

  const colony = colonize(
    seeds,
    attractors,
    // The whole crown must be inside the influence radius: attractors beyond
    // it fall to the straggler fallback, which grows one node per unreached
    // attractor per pass and turned a v10 crown into 26k segments.
    { influence: island * 1.6, kill: killDist, step: growStep, maxIterations: 160, jitter: 0.12 },
    rng,
  )
  const nodes = colony.nodes

  // ---- radii by the pipe model, so every branch tapers into its children ----
  const K = 2.4
  const tipR = island * 0.0011
  const maxR = island * 0.032
  const sumK = new Float64Array(nodes.length)
  const radius = new Float64Array(nodes.length)
  for (let i = nodes.length - 1; i >= 0; i--) {
    radius[i] = Math.min(maxR, sumK[i]! > 0 ? sumK[i]! ** (1 / K) : tipR)
    const p = nodes[i]!.parent
    if (p >= 0) sumK[p]! += radius[i]! ** K
  }

  const branches: BranchInstance[] = []
  for (let i = 1; i < nodes.length; i++) {
    const q = nodes[i]!
    const p = nodes[q.parent]!
    const dx = q.x - p.x
    const dy = q.y - p.y
    const dz = q.z - p.z
    const len = Math.hypot(dx, dy, dz)
    if (len < 1e-4) continue
    let r = Math.max(tipR, (radius[i]! + radius[q.parent]!) / 2)
    // The pipe model stays twig-thin on a short stem. Lift the bole just
    // enough to read as a trunk, not a chimney.
    const bole = island * 0.03
    if (q.depth <= trunkSteps) {
      const flare = (1 - q.depth / trunkSteps) ** 2
      r = Math.max(r, bole * (0.88 + 0.18 * flare))
    } else if (q.depth <= trunkSteps + 2) {
      r = Math.max(r, bole * 0.28)
    }
    branches.push({
      position: [(p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2],
      quaternion: quatFromUnitY(dx, dy, dz),
      scale: [r, len * BRANCH_OVERLAP, r],
      shade: q.depth <= trunkSteps ? 0 : 1,
    })
  }

  // ---- one projected leaf pack per module-owned crown height ----
  const isDark = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < grid.size && y < grid.size && grid.cells[y * grid.size + x]!.dark
  const boundsOf = (cell: ModuleCell, light: number): Bounds => {
    const reach = (x: number, y: number) => (isDark(x, y) ? SEAM_OVERLAP : light)
    return {
      left: -0.5 - reach(cell.x - 1, cell.y),
      right: 0.5 + reach(cell.x + 1, cell.y),
      back: -0.5 - reach(cell.x, cell.y - 1),
      front: 0.5 + reach(cell.x, cell.y + 1),
    }
  }
  const crownBot = Math.min(...crownPoints.map((point) => point.height), trunkH)
  const crownTopHeight = Math.max(...crownPoints.map((point) => point.height), trunkH + 1)
  const crownH = Math.max(1, crownTopHeight - crownBot)
  const toneAt = (y: number) => {
    const v = (y - crownBot) / crownH + (rng() - 0.5) * 0.9
    return v < 0.22 ? 3 : v < 0.48 ? 0 : v < 0.74 ? 1 : 2
  }
  const leaves: LeafInstance[] = []

  // Every canopy leaf is the species' own shape. Coverage comes from the
  // outline design (see canopyShapeFor), not from hiding generic leaves
  // among the real ones.
  const canopyShape: LeafShape = canopyShapeFor(species)
  const detailShape: LeafShape = fillerShapeFor(species)
  for (const { point, at } of owners) {
    const cell = point.cell
    const cx = cell.x - half
    const cz = cell.y - half
    const ink = moduleInkLuma(cell)
    const node = nodes[colony.anchors[at]!]!
    const anchor: [number, number, number] = [node.x, node.y, node.z]
    qrSlots(13, rng).forEach((slot) => {
      const shape: LeafShape = canopyShape
      const bounds = boundsOf(cell, 0)
      const ly = point.height + (rng() - 0.5) * 0.68
      leaves.push({
        kind: 'leaf',
        shape,
        position: [cx + slot.ox, ly, cz + slot.oz],
        euler: [-Math.PI / 2 + 0.05 + rng() * 0.23, slot.phi, 0],
        scale: fitScale(slot.ox, slot.oz, slot.phi, bounds, slot.cap, shape),
        anchor,
        cell: [cx, cz],
        ink,
        tone: toneAt(ly),
        slot: slot.id,
        layer: point.layer,
      })
    })
  }
  // ---- corners: dark-module records; grass, not colour plates, is the ink ----
  const lawns: LawnInstance[] = []
  for (const cell of lawnCells) {
    const cx = cell.x - half
    const cz = cell.y - half
    const ink = moduleInkLuma(cell)
    lawns.push({ cell: [cx, cz], ink, tone: Math.floor(rng() * 4) })
  }

  // ---- extra crown mass: stacked on dark modules so the QR bits stay put ----
  const filler: FillerInstance[] = []
  const lush = habit === 'lush'
  const fillerLo = lush ? (dense ? 0.68 : 1.0) : dense ? 0.55 : 0.85
  const fillerHi = lush ? (dense ? 1.22 : 1.75) : dense ? 1.05 : 1.55
  const pushFiller = (cell: ModuleCell, x: number, y: number, z: number, sizeFactor: number) => {
    const cx = cell.x - half
    const cz = cell.y - half
    const bounds = boundsOf(cell, 0)
    const ly = Math.min(crownTopHeight + 0.9, Math.max(crownBot - 0.5, y))
    const lift = (ly - crownBot) / crownH
    // Extra crown mass is the species' own leaf, twig, or withe. Cluster
    // cards stay on the QR slots; mixing those plates into the filler is
    // what read as "not a leaf".
    const shape: LeafShape = detailShape
    const phi = rng() * Math.PI * 2
    // A willow withe hangs: its plane is upright, so from above it is a line
    // and it may run longer than a flat leaf could. A pine twig angles up.
    const hangs = shape === 'willowWithe'
    const twig = shape === 'pineTwig'
    const reach = hangs ? 0.3 : 0.42
    // Centre stays in this module. A seam in X plus a seam in Z would
    // otherwise land in the diagonal neighbour, which may be light.
    const ox = Math.min(reach, Math.max(-reach, x - cx))
    const oz = Math.min(reach, Math.max(-reach, z - cz))
    const cap = (fillerLo + rng() * (fillerHi - fillerLo)) * sizeFactor
    const tilt = hangs
      ? (rng() - 0.5) * 0.12
      : twig
        ? -Math.PI / 2 + 0.45 + rng() * 0.75
        : -Math.PI / 2 + (lush ? 0.12 + rng() * 0.7 : 0.08 + rng() * 0.42)
    filler.push({
      shape,
      position: [cx + ox, ly, cz + oz],
      euler: [tilt, phi, 0],
      scale: hangs ? uprightFit(ox, oz, phi, tilt, bounds, cap * 1.6, shape) : fitScale(ox, oz, phi, bounds, cap, shape),
      tone: toneAt(ly),
      shade: Math.min(1.22, Math.max(0.74, 0.82 + lift * 0.32 + (rng() - 0.5) * 0.26)),
      ink: moduleInkLuma(cell),
    })
  }
  if (lush) {
    const stacks = dense ? 4 : 6
    const around = dense ? 3 : 5
    const extraSlots = dense ? 8 : 13
    for (const { point } of owners) {
      const cx = point.cell.x - half
      const cz = point.cell.y - half
      const column = Math.max(1.15, point.height - trunkH + 0.45)
      for (let s = 0; s < stacks; s++) {
        const t = s / (stacks - 1)
        const band = trunkH + 0.7 + t * column
        for (let i = 0; i < around; i++) {
          pushFiller(
            point.cell,
            cx + (rng() - 0.5) * 0.46,
            band + (rng() - 0.5) * 0.5,
            cz + (rng() - 0.5) * 0.46,
            1,
          )
        }
      }
      qrSlots(extraSlots, rng).forEach((slot) => {
        pushFiller(
          point.cell,
          cx + slot.ox,
          point.height - 0.55 + (rng() - 0.5) * 0.7,
          cz + slot.oz,
          0.92,
        )
      })
      qrSlots(dense ? 5 : 9, rng).forEach((slot) => {
        pushFiller(
          point.cell,
          cx + slot.ox,
          point.height + 0.45 + (rng() - 0.5) * 0.45,
          cz + slot.oz,
          0.88,
        )
      })
    }
    for (let i = 1; i < nodes.length; i++) {
      const node = nodes[i]!
      if (node.depth <= trunkSteps + 1 || node.y < trunkH * 0.9) continue
      if (dense && i % 2 !== 0) continue
      let nearest = owners[0]!
      let best = Infinity
      for (const owner of owners) {
        const cx = owner.point.cell.x - half
        const cz = owner.point.cell.y - half
        const d = (node.x - cx) ** 2 + (node.z - cz) ** 2
        if (d < best) {
          best = d
          nearest = owner
        }
      }
      pushFiller(nearest.point.cell, node.x, node.y, node.z, 0.88)
      if (!dense || i % 4 === 0) {
        pushFiller(
          nearest.point.cell,
          node.x + (rng() - 0.5) * 0.35,
          node.y + (rng() - 0.5) * 0.55,
          node.z + (rng() - 0.5) * 0.35,
          0.8,
        )
      }
    }
  } else {
    const perModule = dense ? 2 : 4
    for (const { point } of owners) {
      const cx = point.cell.x - half
      const cz = point.cell.y - half
      for (let i = 0; i < perModule; i++) {
        pushFiller(
          point.cell,
          cx + (rng() - 0.5) * 1.7,
          point.height + (rng() - 0.5) * 1.9,
          cz + (rng() - 0.5) * 1.7,
          1,
        )
      }
    }
    for (let i = 1; i < nodes.length; i++) {
      const node = nodes[i]!
      if (node.depth <= trunkSteps + 1 || node.y < trunkH * 0.9) continue
      if (dense && i % 3 !== 0) continue
      let nearest = owners[0]!
      let best = Infinity
      for (const owner of owners) {
        const cx = owner.point.cell.x - half
        const cz = owner.point.cell.y - half
        const d = (node.x - cx) ** 2 + (node.z - cz) ** 2
        if (d < best) {
          best = d
          nearest = owner
        }
      }
      pushFiller(nearest.point.cell, node.x, node.y, node.z, 0.85)
    }
  }

  const crownTop = [...leaves, ...filler].reduce(
    (t, leaf) => Math.max(t, leaf.position[1] + leaf.scale * 0.5),
    trunkH,
  )
  const finderGrass = [...buildFinderVegetation(grid, seed), ...buildMeadowVegetation(grid, seed)]
  const finderCarpet = [...buildFinderCarpet(grid, seed), ...buildMeadowCarpet(grid, seed)]
  return { species, habit, branches, leaves, finderGrass, finderCarpet, lawns, filler, crownTop }
}
