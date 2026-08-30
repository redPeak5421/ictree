export const DEFAULT_PAYLOAD = 'https://www.cloudflare.com/'
export const MAX_PAYLOAD_CHARS = 200
export const TOO_LONG_MESSAGE = 'URL is too long for a reliable scan'

const SCHEME = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:\/\/|mailto:|tel:|sms:|data:)/i

function hostPart(text: string): string {
  return text.split(/[/?#]/, 1)[0] ?? text
}

/** Bare hosts and paths get https://. Plain text such as 你好 does not. */
function looksLikeHost(text: string): boolean {
  if (/\s/.test(text)) return false
  if (/^www\./i.test(text)) return true
  if (/^localhost(?::\d+)?(?:[/?#]|$)/i.test(text)) return true
  if (/^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:[/?#]|$)/.test(text)) return true
  const host = hostPart(text)
  if (!host || host.includes('@')) return false
  const labels = host.split('.')
  if (labels.length < 2) return false
  const tld = labels[labels.length - 1] ?? ''
  return /^xn--[a-z0-9-]+$/i.test(tld) || /^[a-z]{2,24}$/i.test(tld)
}

export function normalizePayload(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return DEFAULT_PAYLOAD
  if (SCHEME.test(trimmed)) return trimmed
  if (looksLikeHost(trimmed)) return `https://${trimmed}`
  return trimmed
}

export function payloadError(raw: string): string | null {
  if (raw.trim().length > MAX_PAYLOAD_CHARS) return TOO_LONG_MESSAGE
  return null
}
