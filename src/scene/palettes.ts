export type Season = 'spring' | 'summer' | 'autumn'
export type PaletteId = 'default' | 'lavender' | 'coral' | 'gold' | 'sky' | 'snow'
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
}

export const PALETTE_SWATCHES: { id: PaletteId; hex: string }[] = [
  { id: 'default', hex: '#e8a0b0' },
  { id: 'lavender', hex: '#9b6fc0' },
  { id: 'coral', hex: '#e83030' },
  { id: 'gold', hex: '#e8a800' },
  { id: 'sky', hex: '#3a8ef5' },
  { id: 'snow', hex: '#dfe6e9' },
]

interface TonePair {
  foliage: string
  foliageVar: string
  grass: string
  grassTip: string
  finder: string
  accent: string
}

const THEMES: Record<PaletteId, Record<Season, TonePair>> = {
  default: {
    spring: { foliage: '#e8a0b0', foliageVar: '#f7cddd', grass: '#5aa832', grassTip: '#c6e37a', finder: '#9a4d66', accent: '#ef9dc0' },
    summer: { foliage: '#d4789a', foliageVar: '#f0b8c8', grass: '#4a9f28', grassTip: '#8bd14a', finder: '#8a4060', accent: '#e07098' },
    autumn: { foliage: '#c96b84', foliageVar: '#e8a0b0', grass: '#cca63c', grassTip: '#e8d48a', finder: '#7a3a52', accent: '#cf5a1c' },
  },
  lavender: {
    spring: { foliage: '#9b6fc0', foliageVar: '#d4b7ec', grass: '#5aa832', grassTip: '#c6e37a', finder: '#6a4588', accent: '#c89be8' },
    summer: { foliage: '#8a62b4', foliageVar: '#c9a6e4', grass: '#4a9f28', grassTip: '#8bd14a', finder: '#5c3a78', accent: '#b888dc' },
    autumn: { foliage: '#7b549c', foliageVar: '#b892d4', grass: '#cca63c', grassTip: '#e8d48a', finder: '#4e2f66', accent: '#9a6cbf' },
  },
  coral: {
    spring: { foliage: '#e85a4a', foliageVar: '#f3a090', grass: '#5aa832', grassTip: '#c6e37a', finder: '#b03228', accent: '#ff8a70' },
    summer: { foliage: '#e83030', foliageVar: '#f07860', grass: '#4a9f28', grassTip: '#8bd14a', finder: '#a02020', accent: '#ff6a48' },
    autumn: { foliage: '#c42820', foliageVar: '#e86040', grass: '#cca63c', grassTip: '#e8d48a', finder: '#8a1818', accent: '#e85020' },
  },
  gold: {
    spring: { foliage: '#e8b84a', foliageVar: '#f5de8a', grass: '#6aa832', grassTip: '#d4e37a', finder: '#b88818', accent: '#f0c040' },
    summer: { foliage: '#e8a800', foliageVar: '#f5d24a', grass: '#4a9f28', grassTip: '#c8d14a', finder: '#a87800', accent: '#f0b400' },
    autumn: { foliage: '#e8862c', foliageVar: '#f5c342', grass: '#cca63c', grassTip: '#e8d48a', finder: '#a85a10', accent: '#cf5a1c' },
  },
  sky: {
    spring: { foliage: '#5aa8e0', foliageVar: '#a8d4f4', grass: '#5aa832', grassTip: '#c6e37a', finder: '#2a6ca0', accent: '#7ec8f0' },
    summer: { foliage: '#3a8ef5', foliageVar: '#8ec4ff', grass: '#4a9f28', grassTip: '#8bd14a', finder: '#1f64b8', accent: '#64b0ff' },
    autumn: { foliage: '#3a7ec8', foliageVar: '#7eb0e0', grass: '#cca63c', grassTip: '#e8d48a', finder: '#245888', accent: '#4a90c8' },
  },
  snow: {
    spring: { foliage: '#dfe6e9', foliageVar: '#f4f7f8', grass: '#b8c8b0', grassTip: '#e8f0e0', finder: '#8a969c', accent: '#c5d0d4' },
    summer: { foliage: '#c8d2d8', foliageVar: '#e8eef2', grass: '#9ab094', grassTip: '#d4e0cc', finder: '#7a868c', accent: '#b4c0c6' },
    autumn: { foliage: '#c4c8cc', foliageVar: '#e4e6e8', grass: '#c8c0a0', grassTip: '#e8e0c4', finder: '#7a7c80', accent: '#d0c8b0' },
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

export function colorsOf(season: Season, palette: PaletteId): SceneColors {
  const tone = THEMES[palette][season]
  return {
    bg: '#f6f1e7',
    pathLight: '#cdcac2',
    pathDark: '#a6a39b',
    pathEdge: '#b8b5ad',
    foliage: tone.foliage,
    foliageVar: tone.foliageVar,
    finder: tone.finder,
    grass: tone.grass,
    grassTip: tone.grassTip,
    trunk: palette === 'snow' ? '#ddd6cc' : '#cdb9a3',
    accent: tone.accent,
  }
}

export function ornamentOf(season: Season, palette: PaletteId): OrnamentKind {
  if (palette === 'snow') return 'none'
  if (season === 'autumn' && (palette === 'coral' || palette === 'gold' || palette === 'default')) return 'fruit'
  if (season === 'spring') return 'blossom'
  if (palette === 'default' || palette === 'lavender') return 'blossom'
  return 'none'
}

export function groundCoverOf(season: Season, palette: PaletteId): GroundCover {
  if (palette === 'sky' || (palette === 'gold' && season === 'summer')) return 'dandelion'
  if (palette === 'default' || palette === 'lavender') return season === 'autumn' ? 'meadow' : 'flower'
  if (season === 'spring') return 'flower'
  return 'meadow'
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
    mixHex(colors.foliage, colors.foliageVar, 0.4),
    colors.foliageVar,
    mixHex(colors.foliage, colors.accent, 0.35),
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
