import { QrCodeDataType } from 'uqr'
import type { ModuleKind } from './types'

export function classifyKind(type: QrCodeDataType, dark: boolean): ModuleKind {
  if (type === QrCodeDataType.Position) return 'finder'
  if (type === QrCodeDataType.Timing) return 'timing'
  if (type === QrCodeDataType.Alignment) return 'alignment'
  return dark ? 'dark' : 'light'
}
