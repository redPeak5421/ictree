export const DEFAULT_PAYLOAD = 'http://example.com/'
export const MAX_PAYLOAD_CHARS = 200
export const TOO_LONG_MESSAGE = 'URL is too long for a reliable scan'

const SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/

export function normalizePayload(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return DEFAULT_PAYLOAD
  if (SCHEME.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function payloadError(raw: string): string | null {
  if (raw.trim().length > MAX_PAYLOAD_CHARS) return TOO_LONG_MESSAGE
  return null
}
