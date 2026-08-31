import { encode } from 'uqr'
import { isWrapped, MAX_WRAP_VERSION, wrappedQrData } from '../share/secret'
import { classifyKind } from './classify'
import type { ModuleCell, ModuleGrid } from './types'

export function encodeGrid(payload: string): ModuleGrid {
  const wrapped = isWrapped(payload)
  const result = encode(wrapped ? wrappedQrData(payload) : payload, {
    ecc: 'M',
    border: 0,
    boostEcc: false,
    maxVersion: wrapped ? MAX_WRAP_VERSION : 40,
  })
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
