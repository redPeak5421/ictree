import type { Season } from '../scene/palettes'
import { isTreeSpecies, type TreeSpecies } from '../scene/treeSpecies'
import { isWrapped } from './secret'

export type AppMode = 'create' | 'reveal'
/** `blocks` keeps a grout line between tiles; `solid` tiles meet edge to edge. */
export type InkStyle = 'plants' | 'blocks' | 'solid'

export interface ShareState {
  url: string
  season: Season
  tree: TreeSpecies
  locked: boolean
  mode: AppMode
  ink: InkStyle
}

const SEASONS: Season[] = ['spring', 'summer', 'autumn']

/** Links minted while swatches picked the tree still open on the tree they showed. */
const LEGACY_PALETTE_TREE: Record<string, TreeSpecies> = {
  default: 'cherry',
  lavender: 'willow',
  coral: 'maple',
  gold: 'apple',
  sky: 'willow',
  snow: 'pine',
}

function parseTree(tree: string, palette: string): TreeSpecies {
  if (isTreeSpecies(tree)) return tree
  return LEGACY_PALETTE_TREE[palette] ?? 'cherry'
}

export function parseShareParams(search: string): ShareState {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const seasonRaw = q.get('s') ?? ''
  const url = q.get('u') ?? ''
  const locked = q.get('e') === '1' || isWrapped(url)
  const modeRaw = q.get('m')
  const mode: AppMode = modeRaw === 'r' || locked ? 'reveal' : 'create'
  const inkRaw = q.get('k')
  const ink: InkStyle = inkRaw === 'b' ? 'blocks' : inkRaw === 's' ? 'solid' : 'plants'
  return {
    url,
    season: SEASONS.includes(seasonRaw as Season) ? (seasonRaw as Season) : 'autumn',
    tree: parseTree(q.get('t') ?? '', q.get('p') ?? ''),
    locked,
    mode,
    ink,
  }
}

export function buildShareSearch(state: ShareState): string {
  const q = new URLSearchParams()
  q.set('u', state.url)
  q.set('s', state.season)
  q.set('t', state.tree)
  if (state.locked) q.set('e', '1')
  if (state.mode === 'reveal') q.set('m', 'r')
  if (state.ink === 'blocks') q.set('k', 'b')
  if (state.ink === 'solid') q.set('k', 's')
  return `?${q.toString()}`
}

export function shareUrl(origin: string, pathname: string, state: ShareState): string {
  return `${origin}${pathname}${buildShareSearch(state)}`
}
