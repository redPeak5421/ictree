export type ModuleKind = 'finder' | 'timing' | 'alignment' | 'dark' | 'light'

export interface ModuleCell {
  x: number
  y: number
  dark: boolean
  kind: ModuleKind
}

export interface ModuleGrid {
  size: number
  version: number
  cells: ModuleCell[]
  payload: string
}

/** Quiet zone baked into the exported PNG, per the QR spec. */
export const QUIET_ZONE = 4

/**
 * Stone rim around the code in the 3D island. The reference keeps this to a
 * single module of grass; the page background supplies the quiet zone when the
 * 2D view is scanned off-screen.
 */
export const ISLAND_RIM = 1
