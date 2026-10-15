import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAuth, getAuthSnapshot, loadCredentials, saveAccount, saveCredentials } from './auth'

const creds = { access_token: 'a', refresh_token: 'r', expiry_date: '2030-01-01T00:00:00.000Z' }

function fake() {
  const m = new Map<string, string>()
  return {
    m,
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

describe('auth store', () => {
  let ls: ReturnType<typeof fake>
  beforeEach(() => {
    ls = fake()
    vi.stubGlobal('localStorage', ls)
    clearAuth()
  })

  it('loadCredentials returns undefined for missing, malformed JSON, and wrong-shape values', () => {
    expect(loadCredentials()).toBeUndefined()
    for (const bad of ['{', 'null', '{"access_token":1}']) {
      ls.m.set('bluefin.auth', bad)
      expect(loadCredentials()).toBeUndefined()
    }
  })

  it('save then load round-trips credentials', () => {
    saveCredentials(creds)
    expect(loadCredentials()).toEqual(creds)
    expect(JSON.parse(ls.m.get('bluefin.auth') as string)).toEqual(creds)
  })

  it('getAuthSnapshot is signedIn only when credentials exist; name comes from saveAccount', () => {
    expect(getAuthSnapshot().signedIn).toBe(false)
    saveCredentials(creds)
    expect(getAuthSnapshot()).toEqual({ signedIn: true, name: undefined, avatar: undefined })
    saveAccount({ name: 'Ty', avatar: 'u' })
    expect(getAuthSnapshot()).toEqual({ signedIn: true, name: 'Ty', avatar: 'u' })
  })

  it('clearAuth removes both keys and getAuthSnapshot returns { signedIn: false }', () => {
    saveCredentials(creds)
    saveAccount({ name: 'Ty' })
    clearAuth()
    expect(ls.m.has('bluefin.auth')).toBe(false)
    expect(ls.m.has('bluefin.account')).toBe(false)
    expect(getAuthSnapshot()).toEqual({ signedIn: false })
  })

  it('getAuthSnapshot returns the same object until state changes', () => {
    saveCredentials(creds)
    const a = getAuthSnapshot()
    expect(getAuthSnapshot()).toBe(a)
    saveAccount({ name: 'Ty' })
    expect(getAuthSnapshot()).not.toBe(a)
  })

  it('works when localStorage throws', () => {
    const boom = () => {
      throw new Error('denied')
    }
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom })
    expect(() => saveCredentials(creds)).not.toThrow()
    expect(loadCredentials()).toEqual(creds)
    expect(() => saveAccount({ name: 'Ty' })).not.toThrow()
    expect(getAuthSnapshot().name).toBe('Ty')
    expect(() => clearAuth()).not.toThrow()
    expect(loadCredentials()).toBeUndefined()
  })
})
