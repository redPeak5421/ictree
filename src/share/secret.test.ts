import { describe, expect, it } from 'vitest'
import { isWrapped, unwrapSecret, wrapSecret, WRAP_TOO_LONG } from './secret'

const URL = 'https://example.com/a b'

describe('secret wrap', () => {
  it('hides the URL until the password is supplied', async () => {
    const token = await wrapSecret(URL, 'grove')
    expect(isWrapped(token)).toBe(true)
    expect(token.includes('example.com')).toBe(false)
    expect(await unwrapSecret(token, 'grove')).toBe(URL)
    expect(await unwrapSecret(token, 'wrong')).toBeNull()
    expect(await unwrapSecret(URL, 'grove')).toBeNull()
  })

  it('rejects an oversized protected URL', async () => {
    await expect(wrapSecret(`https://example.com/${'p'.repeat(400)}`, 'grove')).rejects.toThrow(WRAP_TOO_LONG)
  })
})
