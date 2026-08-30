import { ISLAND_RIM, type ModuleCell, type ModuleGrid } from '../qr/types'
import type { LeafShape } from './leafShape'
import { hashString, mulberry32 } from './hash'

export type TreeSpecies = 'cherry' | 'apple' | 'pine' | 'willow' | 'maple'
export type CrownLayer = 'low' | 'middle' | 'high'

export interface TreeKind {
  id: TreeSpecies
  label: string
}

/** The five trees a person can plant, in picker order. */
export const TREE_KINDS: readonly TreeKind[] = [
  { id: 'cherry', label: 'Cherry' },
  { id: 'apple', label: 'Apple' },
  { id: 'pine', label: 'Pine' },
  { id: 'willow', label: 'Willow' },
  { id: 'maple', label: 'Maple' },
]

export const TREE_IDS: readonly TreeSpecies[] = TREE_KINDS.map((kind) => kind.id)

export function isTreeSpecies(value: string): value is TreeSpecies {
  return (TREE_IDS as readonly string[]).includes(value)
}

export interface CrownPoint {
  cell: ModuleCell
  height: number
  layer: CrownLayer
}

export interface CrownSampleInput {
  x: number
  z: number
  radius: number
  angle: number
  island: number
  phases: readonly number[]
}

export interface TreeSpeciesProfile {
  species: TreeSpecies
  trunkRatio: number
  verticalExtent: [number, number]
  limbPitch: [number, number]
  heightAt(input: CrownSampleInput): number
}

export const CORNER_MODULES = 8

function nearCornerBand(value: number, size: number): boolean {
  return value < CORNER_MODULES || value >= size - CORNER_MODULES
}

export function isCornerCell(x: number, y: number, size: number): boolean {
  return nearCornerBand(x, size) && nearCornerBand(y, size)
}

/**
 * How many outer QR rings become meadow instead of crown. Capped at two
 * modules so the grassy frame stays a thin lip and the canopy still owns
 * the inner dark modules.
 */
export function edgeRingsFor(_size: number): number {
  return 2
}

/** Dark modules on the QR rim, between the finder corners. */
export function isEdgeCell(x: number, y: number, size: number): boolean {
  const rings = edgeRingsFor(size)
  const onRim = x < rings || y < rings || x >= size - rings || y >= size - rings
  return onRim && !isCornerCell(x, y, size)
}

/** Finder corners plus the rim: grass ink, not canopy. */
export function isGrassCell(x: number, y: number, size: number): boolean {
  return isCornerCell(x, y, size) || isEdgeCell(x, y, size)
}

export type TreeHabit = 'lush' | 'sparse'

/** The single leaf of a species: ground litter, particles, and the picker glyph. */
export function leafShapeFor(species: TreeSpecies): LeafShape {
  return species
}

/**
 * The element the visible crown mass is made of. Broadleaves hang single
 * leaves; a pine hangs twigs with needles along them; a willow hangs withes
 * with leaflets down their length.
 */
export function fillerShapeFor(species: TreeSpecies): LeafShape {
  if (species === 'pine') return 'pineTwig'
  if (species === 'willow') return 'willowWithe'
  return species
}

/**
 * The shape the QR-coverage leaves are built from. The silhouette stays a
 * solid cluster so a module still scans from above; the texture is the
 * species' own leaves or needles, not a filled disc.
 */
export function canopyShapeFor(species: TreeSpecies): LeafShape {
  return `${species}Canopy`
}

export function resolveTreeChoice(
  _payload: string,
  tree: TreeSpecies = 'cherry',
): { species: TreeSpecies; habit: TreeHabit } {
  return { species: tree, habit: 'lush' }
}

function mapleHeight({ x, z, radius, angle, phases }: CrownSampleInput): number {
  const lobes =
    0.13 * Math.sin(5 * angle + phases[0]!) * (0.35 + radius * 0.65) +
    0.06 * Math.cos(3 * angle + phases[1]!)
  const crownNoise = 0.04 * Math.sin(x * 0.7 + phases[2]!) * Math.sin(z * 0.62 + phases[3]!)
  return 1.04 * (1 - radius ** 1.72) + lobes + crownNoise
}

function cherryHeight({ x, z, radius, angle, phases }: CrownSampleInput): number {
  const umbrella = 0.92 * Math.exp(-Math.pow((radius - 0.5) / 0.3, 2))
  const hollow = 0.2 * Math.exp(-Math.pow(radius / 0.22, 2))
  const tips = 0.36 * radius ** 2
  const lobes =
    0.1 * Math.sin(3 * angle + phases[0]!) +
    0.05 * Math.sin(6 * angle + phases[1]!)
  const crownNoise = 0.035 * Math.sin(x * 0.5 + phases[2]!) * Math.cos(z * 0.58 + phases[3]!)
  return umbrella - hollow - tips + lobes * (0.45 + radius * 0.55) + crownNoise
}

function willowHeight({ x, z, radius, angle, phases }: CrownSampleInput): number {
  const cascade = 0.9 * Math.exp(-Math.pow((radius - 0.4) / 0.28, 2))
  const hang = 0.5 * radius ** 1.55
  const hollow = 0.1 * Math.exp(-Math.pow(radius / 0.2, 2))
  const lobes = 0.08 * Math.sin(4 * angle + phases[0]!) + 0.04 * Math.cos(7 * angle + phases[1]!)
  const crownNoise = 0.03 * Math.sin(x * 0.48 + phases[2]!) * Math.cos(z * 0.5 + phases[3]!)
  return cascade - hang - hollow + lobes * (0.4 + radius * 0.6) + crownNoise
}

function pineHeight({ radius, angle, phases }: CrownSampleInput): number {
  const cone = 1.2 * (1 - radius)
  const lobes = 0.07 * Math.sin(6 * angle + phases[0]!) * radius
  return cone + lobes
}

function appleHeight({ x, z, radius, angle, phases }: CrownSampleInput): number {
  const lobes =
    0.1 * Math.sin(4 * angle + phases[0]!) * (0.4 + radius * 0.6) +
    0.05 * Math.cos(2 * angle + phases[1]!)
  const crownNoise = 0.035 * Math.sin(x * 0.62 + phases[2]!) * Math.sin(z * 0.58 + phases[3]!)
  return 0.9 * (1 - radius ** 1.5) + lobes + crownNoise
}

const PROFILES: Record<TreeSpecies, TreeSpeciesProfile> = {
  maple: {
    species: 'maple',
    trunkRatio: 0.22,
    verticalExtent: [0.48, 0.62],
    limbPitch: [0.34, 0.68],
    heightAt: mapleHeight,
  },
  cherry: {
    species: 'cherry',
    trunkRatio: 0.2,
    verticalExtent: [0.4, 0.54],
    limbPitch: [0.52, 0.9],
    heightAt: cherryHeight,
  },
  willow: {
    species: 'willow',
    trunkRatio: 0.16,
    verticalExtent: [0.38, 0.52],
    limbPitch: [0.62, 1.05],
    heightAt: willowHeight,
  },
  pine: {
    species: 'pine',
    trunkRatio: 0.28,
    verticalExtent: [0.52, 0.7],
    limbPitch: [0.22, 0.48],
    heightAt: pineHeight,
  },
  apple: {
    species: 'apple',
    trunkRatio: 0.2,
    verticalExtent: [0.42, 0.56],
    limbPitch: [0.36, 0.7],
    heightAt: appleHeight,
  },
}

export function profileFor(species: TreeSpecies): TreeSpeciesProfile {
  return PROFILES[species]
}

/**
 * Assign every dark inner QR module one continuous crown height and one
 * semantic layer. Finder corners and the outer rim are meadow, not canopy.
 * Layer labels are quantiles of the continuous field; they do not snap
 * leaves onto three visible shelves.
 */
export function crownLayout(grid: ModuleGrid, seed: number, species: TreeSpecies): CrownPoint[] {
  const profile = profileFor(species)
  const island = grid.size + ISLAND_RIM * 2
  const half = (grid.size - 1) / 2
  const rng = mulberry32((seed ^ hashString(`${grid.payload}:${species}:crown`)) >>> 0)
  const phases = Array.from({ length: 4 }, () => rng() * Math.PI * 2)
  const samples = grid.cells
    .filter((cell) => cell.dark && !isGrassCell(cell.x, cell.y, grid.size))
    .map((cell) => {
      const x = cell.x - half
      const z = cell.y - half
      const radius = Math.min(1, Math.hypot(x, z) / Math.max(1, half))
      const angle = Math.atan2(z, x)
      const raw = profile.heightAt({ x, z, radius, angle, island, phases }) + (rng() - 0.5) * 0.035
      return { cell, raw }
    })

  if (samples.length === 0) return []
  const rawMin = Math.min(...samples.map((sample) => sample.raw))
  const rawMax = Math.max(...samples.map((sample) => sample.raw))
  const rawSpan = Math.max(1e-6, rawMax - rawMin)
  const extentRatio = (profile.verticalExtent[0] + profile.verticalExtent[1]) / 2
  const crownBase = profile.trunkRatio * island
  const withHeight = samples.map((sample) => ({
    cell: sample.cell,
    height: crownBase + ((sample.raw - rawMin) / rawSpan) * extentRatio * island,
  }))

  const ranked = withHeight.slice().sort((a, b) => a.height - b.height)
  const layerByCell = new Map<string, CrownLayer>()
  ranked.forEach((point, index) => {
    const fraction = (index + 0.5) / ranked.length
    const layer: CrownLayer = fraction < 1 / 3 ? 'low' : fraction < 2 / 3 ? 'middle' : 'high'
    layerByCell.set(`${point.cell.x},${point.cell.y}`, layer)
  })

  return withHeight.map((point) => ({
    ...point,
    layer: layerByCell.get(`${point.cell.x},${point.cell.y}`)!,
  }))
}
