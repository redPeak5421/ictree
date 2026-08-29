export const SECRET_PREFIX = 'gv1.'
export const WRAP_TOO_LONG = 'Password-protected URL is too long'

const SALT_LEN = 16
const IV_LEN = 12
const ITERATIONS = 120000
const MAX_WRAPPED = 280

function bytesToB64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function b64ToBytes(text: string): Uint8Array | null {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  try {
    const bin = atob(padded + pad)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

export function isWrapped(payload: string): boolean {
  return payload.startsWith(SECRET_PREFIX)
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
  const token = `${SECRET_PREFIX}${bytesToB64(packed)}`
  if (token.length > MAX_WRAPPED) throw new Error(WRAP_TOO_LONG)
  return token
}

export async function unwrapSecret(token: string, password: string): Promise<string | null> {
  if (!isWrapped(token) || !password) return null
  const packed = b64ToBytes(token.slice(SECRET_PREFIX.length))
  if (!packed || packed.length < SALT_LEN + IV_LEN + 16) return null
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
