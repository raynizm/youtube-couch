import { describe, expect, it } from 'vitest'
import { activationUrl } from './SignIn'
import { qrPath } from './QrCode'

describe('qrPath', () => {
  it('draws a square code with a quiet zone', () => {
    const { path, size } = qrPath('https://www.google.com/device?user_code=ABC-DEF')
    expect(size).toBeGreaterThan(8)
    expect(path.startsWith('M')).toBe(true)
  })
})

describe('activationUrl', () => {
  it('adds the code to the verification url', () => {
    expect(activationUrl({ url: 'https://www.google.com/device', code: 'ABC-DEF' })).toBe(
      'https://www.google.com/device?user_code=ABC-DEF',
    )
  })
  it('appends to an existing query and adds https when missing', () => {
    expect(activationUrl({ url: 'youtube.com/activate?x=1', code: 'A B' })).toBe(
      'https://youtube.com/activate?x=1&user_code=A%20B',
    )
  })
})
