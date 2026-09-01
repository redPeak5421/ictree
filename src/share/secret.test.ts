import { describe, expect, it } from 'vitest'
import { encodeGrid } from '../qr/encode'
import { isWrapped, unwrapSecret, wrapSecret, MAX_WRAP_VERSION, SECRET_PREFIX, WRAP_TOO_LONG } from './secret'

const URL = 'https://example.com/a b'

describe('secret wrap', () => {
  it('hides the URL until the password is supplied', async () => {
    const token = await wrapSecret(URL, 'ictree')
    expect(isWrapped(token)).toBe(true)
    expect(token.startsWith(SECRET_PREFIX)).toBe(true)
    expect(token.includes('example.com')).toBe(false)
    expect(await unwrapSecret(token, 'ictree')).toBe(URL)
    expect(await unwrapSecret(token, 'wrong')).toBeNull()
    expect(await unwrapSecret(URL, 'ictree')).toBeNull()
  })

  it('keeps a short locked payload under the version cap', async () => {
    const token = await wrapSecret('https://www.example.com/', 'ictree')
    const grid = encodeGrid(token)
    expect(grid.version).toBeLessThanOrEqual(5)
    expect(grid.version).toBeLessThanOrEqual(MAX_WRAP_VERSION)
  })

  it('rejects an oversized protected URL', async () => {
    await expect(wrapSecret(`https://example.com/${'p'.repeat(400)}`, 'ictree')).rejects.toThrow(WRAP_TOO_LONG)
  })
})
