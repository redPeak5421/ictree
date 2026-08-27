export type Season = 'spring' | 'summer' | 'autumn'
export type PaletteId = 'default' | 'lavender' | 'coral' | 'gold' | 'sky' | 'snow'

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
}

export const PALETTE_SWATCHES: { id: PaletteId; hex: string }[] = [
  { id: 'default', hex: '#e8a0b0' },
  { id: 'lavender', hex: '#9b6fc0' },
  { id: 'coral', hex: '#e83030' },
  { id: 'gold', hex: '#e8a800' },
  { id: 'sky', hex: '#3a8ef5' },
  { id: 'snow', hex: '#dfe6e9' },
]

const SWATCH: Record<PaletteId, string> = {
  default: '#e8a0b0',
  lavender: '#9b6fc0',
  coral: '#e83030',
  gold: '#e8a800',
  sky: '#3a8ef5',
  snow: '#dfe6e9',
}

const SEASON_FOLIAGE: Record<Season, string> = {
  spring: '#e8a0b0',
  summer: '#57ab3a',
  autumn: '#e8862c',
}

/** Second tone in the canopy ramp; the reference crown is two-hued, not shaded. */
const SEASON_FOLIAGE_VAR: Record<Season, string> = {
  spring: '#f7cddd',
  summer: '#8bd14a',
  autumn: '#f5c342',
}

const SEASON_GRASS: Record<Season, string> = {
  spring: '#5aa832',
  summer: '#4a9f28',
  autumn: '#cca63c',
}

const SEASON_ACCENT: Record<Season, string> = {
  spring: '#ef9dc0',
  summer: '#7ed957',
  autumn: '#cf5a1c',
}

const SEASON_FINDER: Record<Season, string> = {
  spring: '#2f6b32',
  summer: '#2f6b32',
  autumn: '#6f7c2c',
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

export function colorsOf(season: Season, palette: PaletteId): SceneColors {
  const custom = palette !== 'default'
  const foliage = custom ? SWATCH[palette] : SEASON_FOLIAGE[season]
  return {
    bg: '#f6f1e7',
    pathLight: '#cdcac2',
    pathDark: '#a6a39b',
    pathEdge: '#b8b5ad',
    foliage,
    foliageVar: custom ? mixHex(foliage, '#fff4d6', 0.42) : SEASON_FOLIAGE_VAR[season],
    finder: SEASON_FINDER[season],
    grass: SEASON_GRASS[season],
    grassTip: mixHex(SEASON_GRASS[season], '#f2e59a', 0.26),
    // Pale: from overhead the wood shows through the light modules, and a
    // decoder must still read those as light.
    trunk: '#cdb9a3',
    accent: custom ? mixHex(SWATCH[palette], '#c23a10', 0.35) : SEASON_ACCENT[season],
  }
}

const KEYS: (keyof SceneColors)[] = [
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
]

export function lerpColors(a: SceneColors, b: SceneColors, t: number): SceneColors {
  const out = { ...b }
  for (const key of KEYS) out[key] = mixHex(a[key], b[key], t)
  return out
}

/** The 4-tone ramp the canopy and the 2D mosaic both draw from. */
export function foliageTones(colors: SceneColors): [string, string, string, string] {
  return [
    colors.foliage,
    mixHex(colors.foliage, colors.foliageVar, 0.55),
    colors.foliageVar,
    mixHex(colors.foliage, colors.accent, 0.6),
  ]
}
