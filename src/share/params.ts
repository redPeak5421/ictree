import type { PaletteId, Season } from '../scene/palettes'
import { parseVariety, type TreeVariety } from '../scene/treeSpecies'

export interface ShareState {
  url: string
  season: Season
  palette: PaletteId
  variety: TreeVariety | 'auto'
}

const SEASONS: Season[] = ['spring', 'summer', 'autumn']
const PALETTES: PaletteId[] = ['default', 'lavender', 'coral', 'gold', 'sky', 'snow']

export function parseShareParams(search: string): ShareState {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const seasonRaw = q.get('s') ?? ''
  const paletteRaw = q.get('p') ?? ''
  return {
    url: q.get('u') ?? '',
    season: SEASONS.includes(seasonRaw as Season) ? (seasonRaw as Season) : 'autumn',
    palette: PALETTES.includes(paletteRaw as PaletteId) ? (paletteRaw as PaletteId) : 'default',
    variety: parseVariety(q.get('t')),
  }
}

export function buildShareSearch(state: ShareState): string {
  const q = new URLSearchParams()
  q.set('u', state.url)
  q.set('s', state.season)
  q.set('p', state.palette)
  if (state.variety !== 'auto') q.set('t', state.variety)
  return `?${q.toString()}`
}

export function shareUrl(origin: string, pathname: string, state: ShareState): string {
  return `${origin}${pathname}${buildShareSearch(state)}`
}
