import { PALETTE_SWATCHES, type PaletteId } from '../scene/palettes'

export function PaletteRow({
  palette,
  onChange,
}: {
  palette: PaletteId
  onChange: (palette: PaletteId) => void
}) {
  return (
    <div className="palette-row" role="radiogroup" aria-label="Palette">
      {PALETTE_SWATCHES.map((swatch) => (
        <button
          key={swatch.id}
          type="button"
          role="radio"
          aria-checked={swatch.id === palette}
          aria-label={swatch.id}
          className={swatch.id === palette ? 'swatch is-selected' : 'swatch'}
          style={{ background: swatch.hex }}
          onClick={() => onChange(swatch.id)}
        />
      ))}
    </div>
  )
}
