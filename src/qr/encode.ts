import { encode } from 'uqr'
import { classifyKind } from './classify'
import type { ModuleCell, ModuleGrid } from './types'

export function encodeGrid(payload: string): ModuleGrid {
  const result = encode(payload, { ecc: 'M', border: 0, boostEcc: false })
  const cells: ModuleCell[] = []
  for (let y = 0; y < result.size; y++) {
    const row = result.data[y]!
    const kinds = result.types[y]!
    for (let x = 0; x < result.size; x++) {
      const dark = row[x]!
      cells.push({
        x,
        y,
        dark,
        kind: classifyKind(kinds[x]!, dark),
      })
    }
  }
  return {
    size: result.size,
    version: result.version,
    cells,
    payload,
  }
}
