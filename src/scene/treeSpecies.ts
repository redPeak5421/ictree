import type { PaletteId } from './palettes'
import { ISLAND_RIM, type ModuleCell, type ModuleGrid } from '../qr/types'
import type { LeafShape } from './leafShape'
import { hashString, mulberry32 } from './hash'

export type TreeSpecies = 'oak' | 'maple' | 'cherry' | 'willow' | 'pine' | 'apple' | 'banana'
export type CrownLayer = 'low' | 'middle' | 'high'

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

export function isCornerCell(x: number, y: number, size: number): boolean {
  const near = (value: number) => value < CORNER_MODULES || value >= size - CORNER_MODULES
  return near(x) && near(y)
}

export type TreeHabit = 'lush' | 'sparse'

export const PALETTE_SPECIES: Record<PaletteId, TreeSpecies> = {
  default: 'cherry',
  lavender: 'willow',
  coral: 'maple',
  gold: 'apple',
  sky: 'banana',
  snow: 'pine',
}

export function speciesForPalette(palette: PaletteId): TreeSpecies {
  return PALETTE_SPECIES[palette]
}

export function leafShapeFor(species: TreeSpecies): LeafShape {
  return species
}

export function resolveTreeChoice(
  _payload: string,
  palette: PaletteId = 'default',
): { species: TreeSpecies; habit: TreeHabit } {
  return {
    species: speciesForPalette(palette),
    habit: palette === 'snow' ? 'sparse' : 'lush',
  }
}

function oakHeight({ x, radius, angle, island, phases }: CrownSampleInput): number {
  const xn = x / (island * 0.5)
  const shoulder = 0.2 * Math.exp(-Math.pow((radius - 0.64) / 0.2, 2))
  const lobes =
    0.2 * Math.sin(3 * angle + phases[0]!) +
    0.11 * Math.sin(5 * angle + phases[1]!)
  const crownNoise = 0.06 * Math.sin(x * 0.55 + phases[2]!) * Math.cos(radius * 8 + phases[3]!)
  return 0.46 * (1 - radius ** 1.35) + shoulder + lobes * (0.45 + radius * 0.55) + xn * 0.23 + crownNoise
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

function bananaHeight({ radius, angle, phases }: CrownSampleInput): number {
  const fountain = 1.14 * (1 - radius ** 0.82)
  const lobes = 0.07 * Math.cos(3 * angle + phases[0]!)
  return fountain + lobes
}

const PROFILES: Record<TreeSpecies, TreeSpeciesProfile> = {
  oak: {
    species: 'oak',
    trunkRatio: 0.18,
    verticalExtent: [0.36, 0.48],
    limbPitch: [0.42, 0.78],
    heightAt: oakHeight,
  },
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
  banana: {
    species: 'banana',
    trunkRatio: 0.3,
    verticalExtent: [0.44, 0.58],
    limbPitch: [0.28, 0.58],
    heightAt: bananaHeight,
  },
}

export function profileFor(species: TreeSpecies): TreeSpeciesProfile {
  return PROFILES[species]
}

/**
 * Assign every dark, non-corner QR module one continuous crown height and one
 * semantic layer. Layer labels are quantiles of the continuous field; they do
 * not snap leaves onto three visible shelves.
 */
export function crownLayout(grid: ModuleGrid, seed: number, species: TreeSpecies): CrownPoint[] {
  const profile = profileFor(species)
  const island = grid.size + ISLAND_RIM * 2
  const half = (grid.size - 1) / 2
  const rng = mulberry32((seed ^ hashString(`${grid.payload}:${species}:crown`)) >>> 0)
  const phases = Array.from({ length: 4 }, () => rng() * Math.PI * 2)
  const samples = grid.cells
    .filter((cell) => cell.dark && !isCornerCell(cell.x, cell.y, grid.size))
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
