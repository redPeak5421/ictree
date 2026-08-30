import type { TreeSpecies } from './treeSpecies'

export type Season = 'spring' | 'summer' | 'autumn'
export type OrnamentKind = 'blossom' | 'fruit' | 'none'
export type GroundCover = 'meadow' | 'flower' | 'dandelion'

export interface SceneColors {
  bg: string
  pathLight: string
  pathDark: string
  pathEdge: string
  foliage: string
  foliageVar: string
  finder: string
  grass: string
  grassTip: string
  trunk: string
  accent: string
  /** Fruit colour. Apples are red whatever the leaves do; elsewhere it follows the accent. */
  fruit: string
  /**
   * Added to every dark module's pinned luma. Spring lifts the whole canopy a
   * shade paler; autumn settles it deeper. Small enough that the code still
   * binarizes cleanly — the projection decode test is the gate.
   */
  inkLift: number
}

interface TonePair {
  foliage: string
  foliageVar: string
  finder: string
  accent: string
}

interface SeasonGround {
  grass: string
  grassTip: string
  inkLift: number
}

const GROUND: Record<Season, SeasonGround> = {
  spring: { grass: '#8ec45a', grassTip: '#c3e086', inkLift: 0.03 },
  summer: { grass: '#7fb056', grassTip: '#c5dc82', inkLift: 0 },
  autumn: { grass: '#7a8f40', grassTip: '#c8c070', inkLift: -0.02 },
}

/**
 * The 4-tone canopy ramp is foliage / foliage+var / var / foliage+accent, so
 * an autumn maple set to red foliage and yellow var burns in red, orange,
 * yellow, and deep red at once.
 *
 * Natural leaf colour per tree and season. Spring is the pale, low-saturation
 * flush of new growth; summer is the full green; autumn is each species'
 * own turn — maple to yellow, cherry to copper, apple and willow to olive,
 * pine barely at all.
 */
const THEMES: Record<TreeSpecies, Record<Season, TonePair>> = {
  cherry: {
    spring: { foliage: '#f2b8c8', foliageVar: '#fbdce6', finder: '#b2687f', accent: '#ee8fb0' },
    summer: { foliage: '#4f9a3a', foliageVar: '#8cc86a', finder: '#2f6a2a', accent: '#d94a5a' },
    autumn: { foliage: '#d2662e', foliageVar: '#eda05a', finder: '#8f3f1c', accent: '#c94a24' },
  },
  apple: {
    spring: { foliage: '#96d24a', foliageVar: '#cdf09a', finder: '#5f9a2a', accent: '#f0ec9a' },
    summer: { foliage: '#3f8f2f', foliageVar: '#7bbd56', finder: '#2a6220', accent: '#e6d54a' },
    autumn: { foliage: '#4f7f2c', foliageVar: '#8aac52', finder: '#35561c', accent: '#c4b84a' },
  },
  pine: {
    spring: { foliage: '#7cc45a', foliageVar: '#b8e69a', finder: '#4c8a3a', accent: '#d2ec9c' },
    summer: { foliage: '#2f6e3c', foliageVar: '#5c9a62', finder: '#204a2a', accent: '#8aa860' },
    autumn: { foliage: '#275a3a', foliageVar: '#4f8458', finder: '#1a3e28', accent: '#a8884c' },
  },
  willow: {
    spring: { foliage: '#b2e63a', foliageVar: '#e2f89c', finder: '#6ea52a', accent: '#eef2a0' },
    summer: { foliage: '#6aa83a', foliageVar: '#a6d070', finder: '#45702a', accent: '#d4c860' },
    autumn: { foliage: '#b5a028', foliageVar: '#d9c95a', finder: '#7a6a18', accent: '#c48a2a' },
  },
  maple: {
    spring: { foliage: '#9ed848', foliageVar: '#d4f29c', finder: '#639c2e', accent: '#e8d89a' },
    summer: { foliage: '#3e9a3a', foliageVar: '#78c468', finder: '#2a6a2a', accent: '#c8b040' },
    autumn: { foliage: '#d8461c', foliageVar: '#f2c22e', finder: '#8f2a12', accent: '#b0180f' },
  },
}

export function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbHex(r: number, g: number, b: number): string {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexRgb(a)
  const [br, bg, bb] = hexRgb(b)
  return rgbHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t)
}

export function colorsOf(season: Season, tree: TreeSpecies): SceneColors {
  const tone = THEMES[tree][season]
  const ground = GROUND[season]
  return {
    bg: '#f6f1e7',
    pathLight: '#cdcac2',
    pathDark: '#a6a39b',
    pathEdge: '#b8b5ad',
    foliage: tone.foliage,
    foliageVar: tone.foliageVar,
    finder: tone.finder,
    grass: ground.grass,
    grassTip: ground.grassTip,
    trunk: tree === 'pine' ? '#c4ad94' : '#cdb9a3',
    accent: tone.accent,
    fruit: tree === 'apple' ? '#d8342a' : tone.accent,
    inkLift: tree === 'pine' ? Math.max(ground.inkLift, 0.025) : ground.inkLift,
  }
}

/** Cherry blossoms in spring; apple fruits in autumn; the others carry only leaves. */
export function ornamentOf(season: Season, tree: TreeSpecies): OrnamentKind {
  if (tree === 'cherry' && season === 'spring') return 'blossom'
  if (tree === 'apple' && season === 'autumn') return 'fruit'
  return 'none'
}

export function groundCoverOf(season: Season, tree: TreeSpecies): GroundCover {
  if (season === 'spring') return 'flower'
  if (season === 'summer') return tree === 'apple' ? 'dandelion' : tree === 'cherry' ? 'flower' : 'meadow'
  return 'meadow'
}

type HexKey = { [K in keyof SceneColors]: SceneColors[K] extends string ? K : never }[keyof SceneColors]

const HEX_KEYS: HexKey[] = [
  'bg',
  'pathLight',
  'pathDark',
  'pathEdge',
  'foliage',
  'foliageVar',
  'finder',
  'grass',
  'grassTip',
  'trunk',
  'accent',
  'fruit',
]

export function lerpColors(a: SceneColors, b: SceneColors, t: number): SceneColors {
  const out = { ...b }
  for (const key of HEX_KEYS) out[key] = mixHex(a[key], b[key], t)
  out.inkLift = a.inkLift + (b.inkLift - a.inkLift) * t
  return out
}

/** The 4-tone ramp the canopy and the 2D mosaic both draw from. */
export function foliageTones(colors: SceneColors): [string, string, string, string] {
  return [
    colors.foliage,
    mixHex(colors.foliage, colors.foliageVar, 0.4),
    colors.foliageVar,
    mixHex(colors.foliage, colors.accent, 0.35),
  ]
}

/**
 * Mixed meadow: shadow olive, living mid-green, new growth, and a dry straw
 * tip. Sampled from a close-up lawn so turf is not one cartoon lime.
 */
export function grassTones(colors: SceneColors): [string, string, string, string] {
  return [
    mixHex(colors.grass, '#3d4a18', 0.32),
    colors.grass,
    mixHex(colors.grass, colors.grassTip, 0.55),
    mixHex(colors.grassTip, '#d8c878', 0.38),
  ]
}

/** Finder ink stays in the foliage family so corners do not read as a second QR. */
export function finderInkTones(colors: SceneColors): [string, string, string, string] {
  return [
    colors.finder,
    mixHex(colors.finder, colors.foliage, 0.4),
    mixHex(colors.foliage, colors.finder, 0.28),
    mixHex(colors.finder, colors.grass, 0.16),
  ]
}
