export const SECRET_PREFIX = 'gv2.'
export const WRAP_TOO_LONG = 'Password-protected URL is too long'
/** Locked groves stay at or under QR version 10 (ECC M, byte mode). */
export const MAX_WRAP_VERSION = 10
const MAX_TOKEN_BYTES = 213

const SALT_LEN = 16
const IV_LEN = 12
const ITERATIONS = 120000

function bytesToLatin1(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]!)
  return out
}

function latin1ToBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff
  return out
}

export function isWrapped(payload: string): boolean {
  return payload.startsWith(SECRET_PREFIX)
}

export function wrappedQrData(payload: string): number[] {
  const bytes = new Array<number>(payload.length)
  for (let i = 0; i < payload.length; i++) bytes[i] = payload.charCodeAt(i) & 0xff
  return bytes
}

export function tokenFromQrBytes(bytes: readonly number[]): string | null {
  if (bytes.length < SECRET_PREFIX.length) return null
  let token = ''
  for (const byte of bytes) token += String.fromCharCode(byte)
  return isWrapped(token) ? token : null
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveKey',
  ])
  const saltCopy = new Uint8Array(salt)
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltCopy, iterations: ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function wrapSecret(url: string, password: string): Promise<string> {
  if (!password) throw new Error('password required')
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const key = await deriveKey(password, salt)
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(url)))
  const packed = new Uint8Array(SALT_LEN + IV_LEN + cipher.length)
  packed.set(salt, 0)
  packed.set(iv, SALT_LEN)
  packed.set(cipher, SALT_LEN + IV_LEN)
  if (SECRET_PREFIX.length + packed.length > MAX_TOKEN_BYTES) throw new Error(WRAP_TOO_LONG)
  return SECRET_PREFIX + bytesToLatin1(packed)
}

export async function unwrapSecret(token: string, password: string): Promise<string | null> {
  if (!isWrapped(token) || !password) return null
  const packed = latin1ToBytes(token.slice(SECRET_PREFIX.length))
  if (packed.length < SALT_LEN + IV_LEN + 16) return null
  const salt = packed.subarray(0, SALT_LEN)
  const iv = packed.subarray(SALT_LEN, SALT_LEN + IV_LEN)
  const cipher = packed.subarray(SALT_LEN + IV_LEN)
  try {
    const key = await deriveKey(password, salt)
    const ivCopy = new Uint8Array(iv)
    const cipherCopy = new Uint8Array(cipher)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivCopy }, key, cipherCopy)
    const text = new TextDecoder().decode(plain)
    return text.length > 0 ? text : null
  } catch {
    return null
  }
}
