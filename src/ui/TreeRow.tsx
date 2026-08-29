import type { CSSProperties } from 'react'
import { useT } from '../i18n/useLocale'
import { colorsOf, ornamentOf, type Season } from '../scene/palettes'
import { TREE_KINDS, type TreeSpecies } from '../scene/treeSpecies'
import { LeafGlyph } from './LeafGlyph'

/**
 * Plant tags. Every chip wears its own tree's colour for the current season,
 * so the row doubles as a legend: switch to autumn and the maple tag turns
 * yellow while the apple tag grows its fruit.
 */
export function TreeRow({
  tree,
  season,
  onChange,
}: {
  tree: TreeSpecies
  season: Season
  onChange: (tree: TreeSpecies) => void
}) {
  const t = useT()
  return (
    <div className="tree-row" role="radiogroup" aria-label={t.tree}>
      {TREE_KINDS.map((kind) => {
        const selected = kind.id === tree
        const colors = colorsOf(season, kind.id)
        const style = { '--leaf': colors.foliage, '--leaf-accent': colors.accent } as CSSProperties
        return (
          <button
            key={kind.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={selected ? 'tree-chip is-selected' : 'tree-chip'}
            style={style}
            onClick={() => onChange(kind.id)}
          >
            <LeafGlyph species={kind.id} ornament={ornamentOf(season, kind.id)} />
            <span>{t.trees[kind.id]}</span>
          </button>
        )
      })}
    </div>
  )
}
