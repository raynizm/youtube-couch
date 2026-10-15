import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toDetails } from './client'

type Handler = (arg?: any) => void
const { FakeOAuth2Error } = vi.hoisted(() => ({ FakeOAuth2Error: class extends Error {} }))
const h = vi.hoisted(() => {
  const state: { session: any; info: any; feeds: Record<string, (...arg: any[]) => any>; rawFetch: () => any; signInImpl: any } = {
    session: undefined,
    info: undefined,
    feeds: {},
    rawFetch: async () => ({}),
    signInImpl: undefined,
  }
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
    // Mirrors Session.signIn: the library's own once('auth') handler marks the session logged in.
    signIn: vi.fn(async (tokens?: unknown) => {
      if (h.signInImpl) return h.signInImpl(tokens)
      s.once('auth', () => {
        s.logged_in = true
      })
    }),
    http: { fetch: async () => h.rawFetch() },
    signOut: vi.fn(async () => {}),
  }
  return s
}

vi.mock('youtubei.js', () => ({
  Utils: { OAuth2Error: FakeOAuth2Error },
  Innertube: {
    create: vi.fn(async () => {
      h.session = makeSession()
      return {
        session: h.session,
        account: {
          getInfo: async () => {
            if (!h.session.logged_in) throw new Error('You must be signed in')
            return h.info()
          },
        },
        actions: { execute: async (path: string, args: any) => ({ data: h.feeds.browse?.(args.browseId, args, path) }) },
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
    h.signInImpl = undefined
    h.rawFetch = async () => ({})
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

  it('does not look up the account until the session is marked logged in', async () => {
    const { client, auth } = await load()
    h.info = () => goodInfo()
    const { done } = client.startSignIn(() => {})
    await ready()
    h.session.emit('auth', { credentials: creds })
    await done
    expect(auth.getAuthSnapshot().name).toBe('Ann')
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

  it('startup refresh failure (OAuth2Error) clears auth and resolves a signed-out session', async () => {
    const { client, auth } = await load()
    auth.saveCredentials(creds)
    h.signInImpl = async () => {
      throw new FakeOAuth2Error('Failed to refresh access token: 400')
    }
    h.feeds.browse = () => ({})
    await expect(client.accountHome()).resolves.toEqual([])
    expect(auth.loadCredentials()).toBeUndefined()
    expect(auth.getAuthSnapshot().signedIn).toBe(false)
  })

  it('startup network failure keeps credentials and rejects the call', async () => {
    const { client, auth } = await load()
    auth.saveCredentials(creds)
    h.signInImpl = async () => {
      throw new TypeError('Failed to fetch')
    }
    await expect(client.accountHome()).rejects.toThrow('Failed to fetch')
    expect(auth.loadCredentials()).toEqual(creds)
  })

  it('a mid-session refresh failure clears auth and resets the session', async () => {
    const { client, auth } = await load()
    auth.saveCredentials(creds)
    h.feeds.browse = () => h.session.http.fetch('x')
    h.rawFetch = async () => {
      throw new FakeOAuth2Error('Failed to refresh access token: 400')
    }
    await client.getChannelVideos('UC1').catch(() => {})
    const cur = h.session
    await expect(client.accountHome()).rejects.toThrow(/refresh/)
    expect(auth.getAuthSnapshot().signedIn).toBe(false)
    await client.getChannelVideos('UC1').catch(() => {})
    expect(h.session).not.toBe(cur)
  })

  it('a refresh failure from a 5xx/429 keeps the credentials', async () => {
    const { client, auth } = await load()
    auth.saveCredentials(creds)
    await client.getChannelVideos('UC1').catch(() => {})
    const cur = h.session
    for (const status of [500, 503, 429]) {
      h.rawFetch = async () => {
        throw new FakeOAuth2Error(`Failed to refresh access token: ${status}`)
      }
      await expect(cur.http.fetch('x')).rejects.toThrow(String(status))
    }
    h.rawFetch = async () => {
      throw new TypeError('Failed to fetch')
    }
    await expect(cur.http.fetch('x')).rejects.toThrow('Failed to fetch')
    expect(auth.loadCredentials()).toEqual(creds)
    expect(auth.getAuthSnapshot().signedIn).toBe(true)
  })

  it('invalid_grant style OAuth2Error (server error body) clears auth', async () => {
    const { client, auth } = await load()
    auth.saveCredentials(creds)
    await client.getChannelVideos('UC1').catch(() => {})
    const e: any = new FakeOAuth2Error('Authorization server returned an error')
    e.info = { error_code: 'invalid_grant' }
    h.rawFetch = async () => {
      throw e
    }
    await expect(h.session.http.fetch('x')).rejects.toThrow()
    expect(auth.getAuthSnapshot().signedIn).toBe(false)
  })

  it('a 401 on an authenticated request signs the user out', async () => {
    const { client, auth } = await load()
    auth.saveCredentials(creds)
    await client.getChannelVideos('UC1').catch(() => {})
    const cur = h.session
    cur.logged_in = true
    h.rawFetch = async () => {
      throw new Error('Request to https://x failed with status code 401')
    }
    await expect(cur.http.fetch('x')).rejects.toThrow('401')
    expect(auth.getAuthSnapshot().signedIn).toBe(false)
    await client.getChannelVideos('UC1').catch(() => {})
    expect(h.session).not.toBe(cur)
  })

  it('a 401 on a signed-out session does not touch auth state', async () => {
    const { client, auth } = await load()
    await client.getChannelVideos('UC1').catch(() => {})
    h.rawFetch = async () => {
      throw new Error('Request to https://x failed with status code 401')
    }
    await expect(h.session.http.fetch('x')).rejects.toThrow('401')
    expect(auth.getAuthSnapshot().signedIn).toBe(false)
  })

  it('signOut flips to signed out immediately, then revokes in the background', async () => {
    const { client, auth } = await load()
    auth.saveCredentials(creds)
    await client.getChannelVideos('UC1').catch(() => {})
    const first = h.session
    let release: () => void = () => {}
    first.signOut.mockImplementation(() => new Promise<void>((r) => (release = r)))
    await client.signOut()
    expect(auth.getAuthSnapshot().signedIn).toBe(false)
    await vi.waitFor(() => expect(first.signOut).toHaveBeenCalled())
    release()
    await client.getChannelVideos('UC1').catch(() => {})
    expect(h.session).not.toBe(first)
  })

  it('signOut survives a failing revoke', async () => {
    const { client, auth } = await load()
    auth.saveCredentials(creds)
    await client.getChannelVideos('UC1').catch(() => {})
    const first = h.session
    first.signOut.mockRejectedValue(new Error('offline'))
    await expect(client.signOut()).resolves.toBeUndefined()
    expect(auth.getAuthSnapshot().signedIn).toBe(false)
    await vi.waitFor(() => expect(first.signOut).toHaveBeenCalled())
  })

  it('signOut clears auth and the next call creates a new session', async () => {
    const { client, auth } = await load()
    auth.saveCredentials(creds)
    await client.getChannelVideos('UC1').catch(() => {})
    const first = h.session
    await client.signOut()
    expect(auth.getAuthSnapshot().signedIn).toBe(false)
    await client.getChannelVideos('UC1').catch(() => {})
    expect(h.session).not.toBe(first)
  })

  it('cancel resets the session so a late approval cannot authenticate later requests', async () => {
    const { client, auth } = await load()
    const { done, cancel } = client.startSignIn(() => {})
    const settled = expect(done).rejects.toThrow()
    await ready()
    const old = h.session
    cancel()
    await settled
    old.emit('auth', { credentials: creds })
    expect(auth.loadCredentials()).toBeUndefined()
    await client.getChannelVideos('UC1').catch(() => {})
    expect(h.session).not.toBe(old)
    expect(h.session.signIn).not.toHaveBeenCalled()
  })

  it('cancel during a pending getInfo leaves nothing saved', async () => {
    const { client, auth } = await load()
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    h.info = async () => {
      await gate
      return goodInfo()
    }
    const { done, cancel } = client.startSignIn(() => {})
    const settled = expect(done).rejects.toThrow(/cancel/i)
    await ready()
    h.session.emit('auth', { credentials: creds })
    cancel()
    release()
    await settled
    await new Promise((r) => setTimeout(r, 0))
    expect(auth.loadCredentials()).toBeUndefined()
    expect(auth.getAuthSnapshot().signedIn).toBe(false)
  })

  it('rejects done when the auth handler throws', async () => {
    const { client, auth } = await load()
    const { done } = client.startSignIn(() => {})
    const settled = expect(done).rejects.toThrow('boom')
    await ready()
    h.session.emit('auth', {
      get credentials() {
        throw new Error('boom')
      },
    })
    await settled
    expect(auth.loadCredentials()).toBeUndefined()
  })

  it('auth-error from a stale session does not wipe a newer login', async () => {
    const { client, auth } = await load()
    auth.saveCredentials(creds)
    await client.getChannelVideos('UC1').catch(() => {})
    const old = h.session
    await client.signOut()
    auth.saveCredentials({ ...creds, access_token: 'newer' })
    await client.getChannelVideos('UC1').catch(() => {})
    const fresh = h.session
    old.emit('auth-error', new Error('stale'))
    expect(auth.loadCredentials()?.access_token).toBe('newer')
    await client.getChannelVideos('UC1').catch(() => {})
    expect(h.session).toBe(fresh)
  })

  it('auth-error from the current session clears auth and the next call creates a new session', async () => {
    const { client, auth } = await load()
    auth.saveCredentials(creds)
    await client.getChannelVideos('UC1').catch(() => {})
    const cur = h.session
    cur.emit('auth-error', new Error('revoked'))
    expect(auth.loadCredentials()).toBeUndefined()
    await client.getChannelVideos('UC1').catch(() => {})
    expect(h.session).not.toBe(cur)
  })
})

const tile = (id: string, type: string, extra: Record<string, unknown> = {}) => ({
  tileRenderer: { contentId: id, contentType: `TILE_CONTENT_TYPE_${type}`, ...extra },
})
const grid = (items: unknown[]) => ({
  contents: { tvBrowseRenderer: { content: { tvSurfaceContentRenderer: { content: { gridRenderer: { items } } } } } },
})
const vid = (id: string, extra: Record<string, unknown> = {}) => ({ type: 'Video', id, title: { text: id }, ...extra })

describe('account feeds', () => {
  beforeEach(() => {
    h.feeds = {}
  })

  it('toItem maps a Playlist node', async () => {
    const { client } = await load()
    expect(client.toItem({ type: 'Playlist', id: 'PL1', title: { text: 'Mix' }, thumbnails: [{ url: 't.jpg' }] })).toEqual({
      id: 'PL1',
      kind: 'playlist',
      title: 'Mix',
      thumb: 't.jpg',
    })
    expect(client.toItem({ type: 'GridPlaylist', id: 'PL2', title: { text: 'G' } })).toMatchObject({ id: 'PL2', kind: 'playlist' })
  })

  it('feeds call the TV browse endpoint with the right browseId', async () => {
    const { client } = await load()
    const calls: any[] = []
    h.feeds.browse = (id: string, args: any) => (calls.push([id, args.client]), {})
    await client.accountHome()
    await client.subscriptionsFeed()
    await client.accountHistory()
    await client.accountPlaylists()
    await client.getPlaylistVideos('PL1')
    expect(calls).toEqual([
      ['FEwhat_to_watch', 'TV'],
      ['FEsubscriptions', 'TV'],
      ['FEhistory', 'TV'],
      ['FEplaylist_aggregation', 'TV'],
      ['VLPL1', 'TV'],
    ])
  })

  it('feeds return [] for empty or odd responses', async () => {
    const { client } = await load()
    for (const data of [undefined, null, {}, { contents: null }]) {
      h.feeds.browse = () => data
      expect(await client.accountHome()).toEqual([])
      expect(await client.subscriptionsFeed()).toEqual([])
      expect(await client.accountHistory()).toEqual([])
      expect(await client.accountPlaylists()).toEqual([])
      expect(await client.getPlaylistVideos('PL1')).toEqual([])
    }
  })

  it('history and playlists parse grid tiles; playlist videos collect tiles anywhere', async () => {
    const { client } = await load()
    h.feeds.browse = (id: string) =>
      id === 'FEplaylist_aggregation'
        ? grid([tile('WL', 'PLAYLIST'), tile('aaaaaaaaaaa', 'VIDEO')])
        : id === 'FEhistory'
          ? grid([tile('aaaaaaaaaaa', 'VIDEO'), tile('PL9', 'PLAYLIST')])
          : { deep: [{ x: { tileRenderer: tile('bbbbbbbbbbb', 'VIDEO').tileRenderer } }, null] }
    expect((await client.accountPlaylists()).map((i) => i.id)).toEqual(['WL'])
    expect((await client.accountHistory()).map((i) => i.id)).toEqual(['aaaaaaaaaaa'])
    expect((await client.getPlaylistVideos('PL1')).map((i) => i.id)).toEqual(['bbbbbbbbbbb'])
  })

  it('null nodes inside feeds do not throw', async () => {
    const { client } = await load()
    expect(client.toVideos([null, undefined, vid('aaaaaaaaaaa'), { type: 'Row', items: [null, vid('bbbbbbbbbbb')] }] as any).map((i) => i.id)).toEqual([
      'aaaaaaaaaaa',
      'bbbbbbbbbbb',
    ])
    expect(client.toItem(null as any)).toBeUndefined()
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
