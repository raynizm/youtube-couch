import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toDetails } from './client'

type Handler = (arg?: any) => void
const h = vi.hoisted(() => {
  const state: { session: any; info: any } = { session: undefined, info: undefined }
  return state
})

function makeSession() {
  const handlers = new Map<string, Set<Handler>>()
  const s = {
    logged_in: false,
    on: (e: string, fn: Handler) => {
      if (!handlers.has(e)) handlers.set(e, new Set())
      handlers.get(e)!.add(fn)
    },
    once: (e: string, fn: Handler) => {
      const w: Handler = (a) => {
        s.off(e, w)
        fn(a)
      }
      s.on(e, w)
    },
    off: (e: string, fn: Handler) => void handlers.get(e)?.delete(fn),
    emit: (e: string, a?: unknown) => [...(handlers.get(e) ?? [])].forEach((fn) => fn(a)),
    signIn: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
  }
  return s
}

vi.mock('youtubei.js', () => ({
  Innertube: {
    create: vi.fn(async () => {
      h.session = makeSession()
      return {
        session: h.session,
        account: { getInfo: async () => h.info() },
      }
    }),
  },
}))

const creds = { access_token: 'a', refresh_token: 'r', expiry_date: '2030-01-01T00:00:00.000Z' } as any
const goodInfo = () => ({ contents: { contents: [{ account_name: { text: 'Ann' } }] }, account_photo: [{ url: 'p.jpg' }] })

async function load() {
  vi.resetModules()
  const client = await import('./client')
  const auth = await import('./auth')
  return { client, auth }
}
const ready = () => vi.waitFor(() => expect(h.session?.signIn).toHaveBeenCalled())

describe('sign-in', () => {
  beforeEach(() => {
    h.session = undefined
    h.info = goodInfo
  })

  it('startSignIn calls onCode with user_code and verification_url from auth-pending', async () => {
    const { client } = await load()
    const onCode = vi.fn()
    const { done } = client.startSignIn(onCode)
    done.catch(() => {})
    await ready()
    h.session.emit('auth-pending', { user_code: 'ABC-123', verification_url: 'https://g.co/tv', device_code: 'd' })
    expect(onCode).toHaveBeenCalledWith({ code: 'ABC-123', url: 'https://g.co/tv' })
    expect(h.session.signIn).toHaveBeenCalledWith()
  })

  it('startSignIn resolves, saves credentials and the account name after auth', async () => {
    const { client, auth } = await load()
    const { done } = client.startSignIn(() => {})
    await ready()
    h.session.emit('auth', { credentials: creds })
    await done
    expect(auth.loadCredentials()).toEqual(creds)
    expect(auth.getAuthSnapshot()).toEqual({ signedIn: true, name: 'Ann', avatar: 'p.jpg' })
  })

  it('falls back to a generic account name when getInfo fails', async () => {
    const { client, auth } = await load()
    h.info = () => {
      throw new Error('nope')
    }
    const { done } = client.startSignIn(() => {})
    await ready()
    h.session.emit('auth', { credentials: creds })
    await done
    expect(auth.getAuthSnapshot()).toMatchObject({ signedIn: true, name: 'Account' })
  })

  it('startSignIn rejects on auth-error and stays signed out', async () => {
    const { client, auth } = await load()
    const { done } = client.startSignIn(() => {})
    const settled = expect(done).rejects.toThrow()
    await ready()
    h.session.emit('auth-error', new Error('denied'))
    await settled
    expect(auth.getAuthSnapshot().signedIn).toBe(false)
  })

  it('cancel makes a later auth event a no-op', async () => {
    const { client, auth } = await load()
    const onCode = vi.fn()
    const { done, cancel } = client.startSignIn(onCode)
    const settled = expect(done).rejects.toThrow(/cancel/i)
    await ready()
    cancel()
    h.session.emit('auth-pending', { user_code: 'X', verification_url: 'u' })
    h.session.emit('auth', { credentials: creds })
    await settled
    expect(onCode).not.toHaveBeenCalled()
    expect(auth.loadCredentials()).toBeUndefined()
  })

  it('getSession signs in with stored credentials', async () => {
    vi.resetModules()
    const auth = await import('./auth')
    auth.saveCredentials(creds)
    const client = await import('./client')
    await client.getChannelVideos('UC1').catch(() => {})
    expect(h.session.signIn).toHaveBeenCalledWith(creds)
  })

  it('update-credentials persists refreshed tokens', async () => {
    const { client, auth } = await load()
    auth.saveCredentials(creds)
    await client.getChannelVideos('UC1').catch(() => {})
    const fresh = { ...creds, access_token: 'new' }
    h.session.emit('update-credentials', { credentials: fresh })
    expect(auth.loadCredentials()).toEqual(fresh)
  })

  it('auth-error on a signed-in session clears auth', async () => {
    const { client, auth } = await load()
    auth.saveCredentials(creds)
    await client.getChannelVideos('UC1').catch(() => {})
    h.session.emit('auth-error', new Error('revoked'))
    expect(auth.getAuthSnapshot().signedIn).toBe(false)
  })

  it('signOut calls session.signOut, clears auth, and the next call creates a new session', async () => {
    const { client, auth } = await load()
    auth.saveCredentials(creds)
    await client.getChannelVideos('UC1').catch(() => {})
    const first = h.session
    await client.signOut()
    expect(first.signOut).toHaveBeenCalled()
    expect(auth.getAuthSnapshot().signedIn).toBe(false)
    await client.getChannelVideos('UC1').catch(() => {})
    expect(h.session).not.toBe(first)
  })
})

describe('toDetails', () => {
  it('maps owner, description and related videos', () => {
    const d = toDetails({
      basic_info: { title: 'T', channel_id: 'UC1', author: 'Chan', short_description: 'short' },
      primary_info: { view_count: { short_view_count: { text: '1M views' } }, relative_date: { text: '2 days ago' } },
      secondary_info: {
        description: { text: 'long desc' },
        owner: { author: { id: 'UC1', name: 'Chan', thumbnails: [{ url: 'a.jpg' }] }, subscriber_count: { text: '10K subscribers' } },
      },
      watch_next_feed: [{ type: 'LockupView', content_id: 'abcdefghijk', content_type: 'VIDEO', metadata: { title: { text: 'Rel' } } }],
    })
    expect(d).toMatchObject({ title: 'T', description: 'long desc', meta: '1M views · 2 days ago' })
    expect(d.channel).toEqual({ id: 'UC1', name: 'Chan', avatar: 'a.jpg', subs: '10K subscribers' })
    expect(d.related.map((i) => i.id)).toEqual(['abcdefghijk'])
  })

  it('tolerates a sparse response', () => {
    const d = toDetails({ basic_info: { title: 'T', short_description: 'short' } })
    expect(d).toMatchObject({ title: 'T', description: 'short', meta: '', channel: undefined, related: [] })
  })
})
