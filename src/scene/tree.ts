import { moduleInkLuma } from '../qr/contrast'
import { ISLAND_RIM, type ModuleCell, type ModuleGrid } from '../qr/types'
import { colonize, type ColonizeNode, type Point } from './colonize'
import { hashString, mulberry32 } from './hash'
import { fitScale, qrSlots, type Bounds } from './leafShape'

export interface BranchInstance {
  position: [number, number, number]
  quaternion: [number, number, number, number]
  scale: [number, number, number]
  /** 0 = trunk (light bark), 1 = limb (dark bark). */
  shade: number
}

/** Euler angles in three.js 'YXZ' order: [tilt about x, heading about y, spin]. */
export type Euler3 = [number, number, number]

/** Which silhouette a canopy leaf is drawn with. */
export type LeafShape = 'ovate' | 'maple'

export interface LeafInstance {
  /** Canopy leaf, or a grass blade standing on one of the code's corners. */
  kind: 'leaf' | 'blade'
  shape: LeafShape
  position: [number, number, number]
  /**
   * Absolute: every leaf and blade is part of the object, and a leaf's
   * top-down outline is what the code is made of. Nothing faces the camera.
   */
  euler: Euler3
  scale: number
  /** Twig tip this leaf grows from; for a blade, where it meets the turf. */
  anchor: [number, number, number]
  /** Centre of the module this instance stands over, in world x/z. */
  cell: [number, number]
  /** Luma its colour is pinned to, so its module reads as one flat block of ink. */
  ink: number
  /** Index into the 4-tone ramp of its kind. */
  tone: number
}

export interface LawnInstance {
  cell: [number, number]
  ink: number
  tone: number
}

export interface TreeRig {
  branches: BranchInstance[]
  leaves: LeafInstance[]
  /** Turf mounds that are the code's four corners. */
  lawns: LawnInstance[]
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

/**
 * How far a surface leaf's tip may reach into a light neighbour. A decoder
 * samples each module at its centre, so the middle of a light module must stay
 * clean but its very rim need not: this leaves the central three quarters
 * untouched, and is what lets a maple grow a little past its own module. The
 * flat base layers never cross at all — they are the ink.
 */
export const LIGHT_OVERLAP = 0.12

/** Cylinders are stretched by this so joints between segments do not gap. */
export const BRANCH_OVERLAP = 1.08

/**
 * Modules this close to a corner belong to the grass, not the tree: the three
 * finder patterns plus their separators, and the matching block at the fourth
 * corner. In the reference the code's corners are grass-coloured because the
 * island's corners are where the grass grows.
 */
export const CORNER = 8

/** Default camera azimuth, before the island is turned by hand. */
export const VIEW_YAW = Math.PI / 4
/**
 * Default camera elevation above the ground, about 22deg: the reference's
 * island reads as a rhombus roughly 2.5x wider than tall.
 */
export const VIEW_PITCH = 0.38

/**
 * The corner grass: a low turf mound on every dark corner module, whose top
 * is the finder patterns' ink from above, with a clump of blades standing in
 * it. The paving carries no trace of the code — from the side there is a
 * tree and four patches of grass, and only straight down is there a code.
 */
export const MOUND_R = 0.56
export const MOUND_H = 0.24
/**
 * Tallest blade, the most it may lean and how far from centre it may root:
 * together they keep a leaning blade — its width included — over its own
 * module. The finder rings are made of these modules, and even slivers of
 * blade in the light ring between them break a decoder's 1:1:3:1:1 scan.
 */
export const BLADE_H = 0.9
export const BLADE_LEAN = 0.28
export const BLADE_ROOT = 0.14

/** Thickness of the island slab under the paving. */
export const SLAB_H = 1.05

/**
 * Steepest a leaf may lean from flat, by how many layers its column has. A
 * leaf's top-down outline shrinks as it leans, so a lone layer stays nearly
 * flat to cover its module, while a deep column can afford looser leaves
 * because the layers cover for each other.
 */
export const LEAN_BY_DEPTH: [number, number, number] = [0.3, 0.55, 0.75]

/** Vertical scatter of leaves about their layer. */
export const LAYER_JITTER = 0.35

/** Farthest a leaf may sit from the twig tip it grows on. */
export const REACH = 1.6

/**
 * The slot caps in leafShape were set for tiling a module flat; a surface
 * maple may be this much larger, and is then cut back only by its module's
 * bounds.
 */
export const CANOPY_CAP = 1.5

export function islandExtent(gridSize: number): number {
  return gridSize + ISLAND_RIM * 2
}

export function isCornerModule(x: number, y: number, size: number): boolean {
  const near = (v: number) => v < CORNER || v >= size - CORNER
  return near(x) && near(y)
}

/**
 * The tree is the code. Seen from straight above, the canopy's outline is the
 * QR matrix — not because anything rearranges, but because of where the
 * leaves grow: every dark module outside the corners owns a column of leaves
 * stacked through the crown, each sized so its silhouette cannot cross into a
 * light module, and no light module has a leaf over it. The corners are turf
 * mounds with grass standing in them. The trunk and twigs are pale, so where
 * they show through a light module from above they still read as light.
 *
 * Crown: a broad lobed dome about half as tall as it is wide, as in the
 * reference, on a short trunk. Each column takes attraction points down the
 * dome's chord, and space colonization grows twigs from the trunk to every one
 * of them, which is what guarantees nothing floats. `sectorMass` and `reader`
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

/**
 * Slots per layer, scaled down for dense codes to keep frames cheap. The base
 * layer of every column takes the full count — 13 measured at 88% coverage of
 * its module on its own — and the layers above take fewer, since they only
 * add to it.
 */
function slotsFor(darkCount: number): number {
  if (darkCount * 13 <= 9000) return 13
  if (darkCount * 9 <= 12000) return 9
  return 5
}

export function buildTree(grid: ModuleGrid, seed: number): TreeRig {
  const island = islandExtent(grid.size)
  const bits = payloadBits(grid)
  const reader = makeReader(bits)
  const rng = mulberry32((seed ^ hashString(bits.join(''))) >>> 0)

  const half = (grid.size - 1) / 2
  const trunkH = island * 0.2
  const step = 0.45

  // ---- crown envelope: a lobed dome, about half as tall as it is wide ----
  const rx = half * 1.2
  const ry = island * 0.3
  const cy = trunkH + ry * 0.9
  const lobeA = reader.range(0, Math.PI * 2)
  const lobeB = reader.range(0, Math.PI * 2)
  const swellA = reader.range(0, Math.PI * 2)
  const swellB = reader.range(0, Math.PI * 2)
  const swellC = reader.range(0, Math.PI * 2)
  const swellD = reader.range(0, Math.PI * 2)
  // Three and five lobes around the outline, seeded from the code, so the crown
  // is a living shape rather than a geometric ball.
  const radiusAt = (x: number, z: number) => {
    const th = Math.atan2(z, x)
    return rx * (1 + 0.13 * Math.sin(3 * th + lobeA) + 0.08 * Math.sin(5 * th + lobeB))
  }
  // Low-frequency swell over the top of the dome, in two octaves.
  const swell = (x: number, z: number) =>
    1 +
    0.18 * Math.sin(0.5 * x + swellA) * Math.cos(0.45 * z + swellB) +
    0.1 * Math.sin(1.1 * x + swellC) * Math.sin(0.95 * z + swellD)
  /** Bottom and top of the crown over a column; a thin sliver outside the dome. */
  const chord = (x: number, z: number): [number, number] => {
    const r = radiusAt(x, z)
    const q = (x * x + z * z) / (r * r)
    const h = ry * Math.sqrt(Math.max(0.04, 1 - q)) * swell(x, z)
    return [cy - h * 0.8, cy + h]
  }

  // ---- seeds: trunk column plus one main limb per angular sector ----
  const seeds: ColonizeNode[] = []
  const trunkSteps = Math.max(2, Math.round(trunkH / step))
  for (let i = 0; i <= trunkSteps; i++) {
    seeds.push({ x: 0, y: (trunkH * i) / trunkSteps, z: 0, parent: i - 1, depth: i })
  }
  const top = seeds.length - 1
  const SECTORS = 5
  const mass = sectorMass(grid, SECTORS)
  const limbLen = island * 0.16
  for (let s = 0; s < SECTORS; s++) {
    const weight = 0.7 + mass[s]! * 0.3
    const yaw = (s / SECTORS) * Math.PI * 2 + reader.range(-0.35, 0.35)
    const pitch = reader.range(0.4, 0.8)
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

  // ---- attractors: down the crown's chord above every code column ----
  const dark = grid.cells.filter((cell) => cell.dark)
  const perModule = slotsFor(dark.length)
  // Dense codes get fewer layers and coarser twigs: colonization is
  // O(attractors x nodes), and a v10 code with five layers per column grew a
  // 22k-segment tree in a full second.
  const dense = dark.length > 600
  const maxLayers = dark.length > 1200 ? 1 : dense ? 2 : 5
  const growStep = dense ? 0.6 : step
  const killDist = dense ? 0.75 : 0.55
  const attractors: Point[] = []
  /** Columns whose leaves are the code: dark modules outside the corners. */
  const columns: { cell: ModuleCell; at: number[]; heights: number[] }[] = []
  const lawnCells: ModuleCell[] = []
  const j = () => (rng() - 0.5) * 0.3
  for (const cell of grid.cells) {
    if (!cell.dark) continue
    if (isCornerModule(cell.x, cell.y, grid.size)) {
      lawnCells.push(cell)
      continue
    }
    const cx = cell.x - half
    const cz = cell.y - half
    const [bot, topY] = chord(cx, cz)
    const n = Math.max(1, Math.min(maxLayers, 1 + Math.floor((topY - bot) / 2.8)))
    const at: number[] = []
    const heights: number[] = []
    for (let i = 0; i < n; i++) {
      // Layers run from the top of the chord down, so a one-layer column sits
      // at the crown's surface.
      const y = n === 1 ? topY - 0.6 : topY - 0.5 + ((bot + 1.0 - (topY - 0.5)) * i) / (n - 1)
      attractors.push({ x: cx + j(), y, z: cz + j() })
      at.push(attractors.length - 1)
      heights.push(y)
    }
    columns.push({ cell, at, heights })
  }

  const colony = colonize(
    seeds,
    attractors,
    // The whole crown must be inside the influence radius: attractors beyond
    // it fall to the straggler fallback, which grows one node per unreached
    // attractor per pass and turned a v10 crown into 26k segments.
    { influence: island * 1.6, kill: killDist, step: growStep, maxIterations: 200, jitter: 0.14 },
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
    // Flare at the base of the trunk.
    if (q.depth <= trunkSteps) r *= 1 + 0.35 * (1 - q.depth / trunkSteps) ** 2
    branches.push({
      position: [(p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2],
      quaternion: quatFromUnitY(dx, dy, dz),
      scale: [r, len * BRANCH_OVERLAP, r],
      shade: q.depth <= trunkSteps ? 0 : 1,
    })
  }

  // ---- leaves: stacked in their module's column ----
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
  /**
   * Which of the four foliage tones a leaf takes, from its height in the crown:
   * the ramp runs dark (3) to light (2), so the top of the dome is lit and its
   * underside is in shadow, with enough scatter that no band shows. Luma is
   * pinned per module either way, so this is hue only.
   */
  const crownBot = cy - ry * 0.8
  const crownH = Math.max(1, cy + ry * 1.2 - crownBot)
  const toneAt = (y: number) => {
    const v = (y - crownBot) / crownH + (rng() - 0.5) * 0.9
    return v < 0.22 ? 3 : v < 0.48 ? 0 : v < 0.74 ? 1 : 2
  }
  const leaves: LeafInstance[] = []
  const leafLayer = (
    cell: ModuleCell,
    y: number,
    anchor: [number, number, number],
    shape: LeafShape,
    count: number,
    lean: number,
  ) => {
    const cx = cell.x - half
    const cz = cell.y - half
    const ink = moduleInkLuma(cell)
    const surface = shape === 'maple'
    const bounds = boundsOf(cell, surface ? LIGHT_OVERLAP : 0)
    const cap = surface ? CANOPY_CAP : 1
    qrSlots(count, rng).forEach((slot, k) => {
      const ly = y + (rng() - 0.5) * 2 * LAYER_JITTER + k * 0.012
      leaves.push({
        kind: 'leaf',
        shape,
        // Flat is [-pi/2, heading, 0]; the leaf leans off flat by up to `lean`
        // about its own axis. Leaning only shrinks its top-down outline, so
        // the flat footprint that fitScale sized is a bound on it.
        position: [cx + slot.ox, ly, cz + slot.oz],
        euler: [-Math.PI / 2 + rng() * lean, slot.phi, 0],
        scale: fitScale(slot.ox, slot.oz, slot.phi, bounds, slot.cap * cap, 'leaf'),
        anchor,
        cell: [cx, cz],
        ink,
        tone: toneAt(ly),
      })
    })
  }
  const upperSlots = Math.max(5, Math.round(perModule * 0.85))
  for (const { cell, at, heights } of columns) {
    const n = heights.length
    const lean = LEAN_BY_DEPTH[Math.min(2, n - 1)]!
    const anchorOf = (i: number): [number, number, number] => {
      const node = nodes[colony.anchors[at[i]!]!]!
      return [node.x, node.y, node.z]
    }
    // The lowest layer is broad leaves lying nearly flat, twice over with
    // different headings: the base that covers the module on its own, so a
    // decoder sees one solid block whatever the maples above happen to leave
    // open. Everything above it is maples, looser, which is what the crown
    // shows from the side and from above.
    const base = n - 1
    leafLayer(cell, heights[base]!, anchorOf(base), 'ovate', perModule, Math.min(lean, 0.3))
    leafLayer(cell, heights[base]! + 0.45, anchorOf(base), 'ovate', perModule, Math.min(lean, 0.3))
    if (n === 1) {
      leafLayer(cell, heights[0]! + 0.9, anchorOf(0), 'maple', upperSlots, lean)
    } else {
      for (let i = 0; i < base; i++) leafLayer(cell, heights[i]!, anchorOf(i), 'maple', upperSlots, lean)
    }
  }

  // ---- corners: turf mounds, with a clump of blades standing in each ----
  const lawns: LawnInstance[] = []
  for (const cell of lawnCells) {
    const cx = cell.x - half
    const cz = cell.y - half
    const ink = moduleInkLuma(cell)
    lawns.push({ cell: [cx, cz], ink, tone: Math.floor(rng() * 4) })
    const blades = 22 + Math.floor(rng() * 7)
    for (let k = 0; k < blades; k++) {
      // Each blade has its own heading and leans a little away from the
      // clump's centre, so the clump is a real bush from every side. Short
      // enough, and rooted close enough to centre, that a leaning tip stays
      // over its own module from above.
      const h = BLADE_H * (0.4 + rng() * 0.6)
      const r = Math.sqrt(rng()) * BLADE_ROOT
      const a = rng() * Math.PI * 2
      const bx = cx + Math.cos(a) * r
      const bz = cz + Math.sin(a) * r
      const lean = BLADE_LEAN * (0.3 + rng() * 0.7)
      // Lean is about the blade's own x axis after its heading is applied,
      // so the heading sets which way it leans: outward, plus scatter.
      const heading = a + Math.PI / 2 + (rng() - 0.5) * 0.8
      const up: [number, number, number] = [
        Math.sin(lean) * Math.sin(heading),
        Math.cos(lean),
        Math.sin(lean) * Math.cos(heading),
      ]
      const baseY = MOUND_H * 0.55
      leaves.push({
        kind: 'blade',
        shape: 'ovate',
        position: [bx + (up[0] * h) / 2, baseY + (up[1] * h) / 2, bz + (up[2] * h) / 2],
        euler: [lean, heading, 0],
        scale: h,
        anchor: [bx, baseY, bz],
        cell: [cx, cz],
        ink,
        tone: Math.floor(rng() * 4),
      })
    }
  }

  const crownTop = leaves.reduce((t, leaf) => Math.max(t, leaf.position[1] + leaf.scale * 0.5), trunkH)
  return { branches, leaves, lawns, crownTop }
}
