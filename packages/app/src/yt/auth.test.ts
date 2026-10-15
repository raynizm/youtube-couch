import { beforeEach, describe, expect, it, vi } from 'vitest'
type Auth = typeof import('./auth')

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
  let a: Auth
  // Fresh module per call: hydration is lazy and happens once per module.
  const fresh = async () => {
    vi.resetModules()
    a = await import('./auth')
    return a
  }
  beforeEach(async () => {
    ls = fake()
    vi.stubGlobal('localStorage', ls)
    await fresh()
  })

  it('loadCredentials returns undefined for missing, malformed JSON, and wrong-shape values', async () => {
    expect(a.loadCredentials()).toBeUndefined()
    for (const bad of ['{', 'null', '{"access_token":1}']) {
      ls.m.set('bluefin.auth', bad)
      await fresh()
      expect(a.loadCredentials()).toBeUndefined()
    }
  })

  it('corrupt JSON under bluefin.auth reads as signed out', async () => {
    ls.m.set('bluefin.auth', '{')
    await fresh()
    expect(a.getAuthSnapshot().signedIn).toBe(false)
  })

  it('hydrates from existing storage', async () => {
    ls.m.set('bluefin.auth', JSON.stringify(creds))
    ls.m.set('bluefin.account', JSON.stringify({ name: 'Ty' }))
    await fresh()
    expect(a.getAuthSnapshot()).toEqual({ signedIn: true, name: 'Ty', avatar: undefined })
  })

  it('ignores an account whose avatar is not a string', async () => {
    ls.m.set('bluefin.auth', JSON.stringify(creds))
    ls.m.set('bluefin.account', JSON.stringify({ name: 'Ty', avatar: 5 }))
    await fresh()
    expect(a.getAuthSnapshot().name).toBeUndefined()
  })

  it('save then load round-trips credentials', () => {
    a.saveCredentials(creds)
    expect(a.loadCredentials()).toEqual(creds)
    expect(JSON.parse(ls.m.get('bluefin.auth') as string)).toEqual(creds)
  })

  it('getAuthSnapshot is signedIn only when credentials exist; name comes from saveAccount', () => {
    expect(a.getAuthSnapshot().signedIn).toBe(false)
    a.saveCredentials(creds)
    expect(a.getAuthSnapshot()).toEqual({ signedIn: true, name: undefined, avatar: undefined })
    a.saveAccount({ name: 'Ty', avatar: 'u' })
    expect(a.getAuthSnapshot()).toEqual({ signedIn: true, name: 'Ty', avatar: 'u' })
  })

  it('clearAuth removes both keys and getAuthSnapshot returns { signedIn: false }', () => {
    a.saveCredentials(creds)
    a.saveAccount({ name: 'Ty' })
    a.clearAuth()
    expect(ls.m.has('bluefin.auth')).toBe(false)
    expect(ls.m.has('bluefin.account')).toBe(false)
    expect(a.getAuthSnapshot()).toEqual({ signedIn: false })
  })

  it('getAuthSnapshot returns the same object until state changes', () => {
    a.saveCredentials(creds)
    const s1 = a.getAuthSnapshot()
    expect(a.getAuthSnapshot()).toBe(s1)
    a.saveAccount({ name: 'Ty' })
    expect(a.getAuthSnapshot()).not.toBe(s1)
  })

  it('works when localStorage throws', () => {
    const boom = () => {
      throw new Error('denied')
    }
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom })
    expect(() => a.saveCredentials(creds)).not.toThrow()
    expect(a.loadCredentials()).toEqual(creds)
    expect(() => a.saveAccount({ name: 'Ty' })).not.toThrow()
    expect(a.getAuthSnapshot().name).toBe('Ty')
    expect(() => a.clearAuth()).not.toThrow()
    expect(a.loadCredentials()).toBeUndefined()
  })

  it('setItem throws but getItem works: saved values win over stale stored ones', async () => {
    ls.m.set('bluefin.auth', JSON.stringify({ ...creds, access_token: 'old' }))
    ls.m.set('bluefin.account', JSON.stringify({ name: 'Old' }))
    vi.stubGlobal('localStorage', {
      ...ls,
      setItem: () => {
        throw new Error('full')
      },
    })
    await fresh()
    a.saveCredentials(creds)
    a.saveAccount({ name: 'New' })
    expect(a.loadCredentials()).toEqual(creds)
    expect(a.getAuthSnapshot()).toEqual({ signedIn: true, name: 'New', avatar: undefined })
  })

  it('removeItem throws but getItem works: clearAuth still signs out', async () => {
    ls.m.set('bluefin.auth', JSON.stringify(creds))
    ls.m.set('bluefin.account', JSON.stringify({ name: 'Ty' }))
    vi.stubGlobal('localStorage', {
      ...ls,
      removeItem: () => {
        throw new Error('denied')
      },
    })
    await fresh()
    expect(a.getAuthSnapshot().signedIn).toBe(true)
    a.clearAuth()
    expect(a.getAuthSnapshot()).toEqual({ signedIn: false })
    expect(a.loadCredentials()).toBeUndefined()
  })

  it('getItem throws but writes work: saves persist and read back', async () => {
    vi.stubGlobal('localStorage', {
      ...ls,
      getItem: () => {
        throw new Error('denied')
      },
    })
    await fresh()
    expect(a.getAuthSnapshot().signedIn).toBe(false)
    a.saveCredentials(creds)
    expect(a.loadCredentials()).toEqual(creds)
    expect(JSON.parse(ls.m.get('bluefin.auth') as string)).toEqual(creds)
  })
})
