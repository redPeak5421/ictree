import { silhouette, type LeafShape } from '../scene/leafShape'
import type { OrnamentKind } from '../scene/palettes'
import type { TreeSpecies } from '../scene/treeSpecies'

const SIZE = 24

/** The picker draws the same outline the canopy is built from, so a chip is a true sample of its tree. */
export function leafPath(shape: LeafShape): string {
  return (
    silhouette(shape)
      .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${((x + 0.5) * SIZE).toFixed(2)} ${((0.5 - y) * SIZE).toFixed(2)}`)
      .join(' ') + 'Z'
  )
}

export function LeafGlyph({ species, ornament }: { species: TreeSpecies; ornament: OrnamentKind }) {
  return (
    <svg className="leaf-glyph" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
      <path className="leaf-fill" d={leafPath(ornament === 'blossom' ? 'blossom' : species)} />
      {ornament === 'fruit' && (
        <circle className="leaf-fruit" cx={SIZE * 0.68} cy={SIZE * 0.3} r={3.4} />
      )}
    </svg>
  )
}
