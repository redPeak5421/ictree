import type { PaletteId, Season } from '../scene/palettes'
import { isWrapped } from './secret'

export type AppMode = 'create' | 'reveal'

export interface ShareState {
  url: string
  season: Season
  palette: PaletteId
  locked: boolean
  mode: AppMode
}

const SEASONS: Season[] = ['spring', 'summer', 'autumn']
const PALETTES: PaletteId[] = ['default', 'lavender', 'coral', 'gold', 'sky', 'snow']

export function parseShareParams(search: string): ShareState {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const seasonRaw = q.get('s') ?? ''
  const paletteRaw = q.get('p') ?? ''
  const url = q.get('u') ?? ''
  const locked = q.get('e') === '1' || isWrapped(url)
  const modeRaw = q.get('m')
  const mode: AppMode = modeRaw === 'r' || locked ? 'reveal' : 'create'
  return {
    url,
    season: SEASONS.includes(seasonRaw as Season) ? (seasonRaw as Season) : 'autumn',
    palette: PALETTES.includes(paletteRaw as PaletteId) ? (paletteRaw as PaletteId) : 'default',
    locked,
    mode,
  }
}

export function buildShareSearch(state: ShareState): string {
  const q = new URLSearchParams()
  q.set('u', state.url)
  q.set('s', state.season)
  q.set('p', state.palette)
  if (state.locked) q.set('e', '1')
  if (state.mode === 'reveal') q.set('m', 'r')
  return `?${q.toString()}`
}

export function shareUrl(origin: string, pathname: string, state: ShareState): string {
  return `${origin}${pathname}${buildShareSearch(state)}`
}
