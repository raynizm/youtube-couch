import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toDetails } from './client'

type Handler = (arg?: any) => void
const h = vi.hoisted(() => {
  const state: { session: any; info: any; feeds: Record<string, (arg?: any) => any> } = {
    session: undefined,
    info: undefined,
    feeds: {},
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
        getHomeFeed: async () => h.feeds.home(),
        getSubscriptionsFeed: async () => h.feeds.subs(),
        getPlaylists: async () => h.feeds.playlists(),
        getHistory: async () => h.feeds.history(),
        getPlaylist: async (id: string) => h.feeds.playlist(id),
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

  it('subscriptionsFeed drops shorts and ads and keeps videos', async () => {
    const { client } = await load()
    h.feeds.subs = () => ({
      videos: [
        vid('aaaaaaaaaaa'),
        { type: 'ReelItem', id: 'short1', title: { text: 's' } },
        { type: 'AdSlot' },
        { type: 'Mystery' },
        vid('bbbbbbbbbbb'),
      ],
    })
    expect((await client.subscriptionsFeed()).map((i) => i.id)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb'])
  })

  it('accountHistory flattens sections and ignores unknown node types', async () => {
    const { client } = await load()
    h.feeds.history = () => ({
      sections: [
        { contents: [vid('aaaaaaaaaaa'), { type: 'Weird' }, { type: 'ReelShelf', items: [] }] },
        { contents: [vid('bbbbbbbbbbb')] },
        {},
      ],
    })
    expect((await client.accountHistory()).map((i) => i.id)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb'])
  })

  it('accountPlaylists returns only playlist items', async () => {
    const { client } = await load()
    h.feeds.playlists = () => ({
      playlists: [
        { type: 'GridPlaylist', id: 'PL1', title: { text: 'One' } },
        vid('aaaaaaaaaaa'),
        { type: 'LockupView', content_id: 'PL2', content_type: 'PLAYLIST', metadata: { title: { text: 'Two' } } },
      ],
    })
    expect(await client.accountPlaylists()).toMatchObject([
      { id: 'PL1', kind: 'playlist' },
      { id: 'PL2', kind: 'playlist' },
    ])
  })

  it('accountHome returns [] for an empty feed instead of throwing', async () => {
    const { client } = await load()
    h.feeds.home = () => ({ contents: { contents: [] } })
    expect(await client.accountHome()).toEqual([])
    h.feeds.home = () => ({})
    expect(await client.accountHome()).toEqual([])
  })

  it('accountHome builds a row per shelf, or one Recommended row for a flat grid', async () => {
    const { client } = await load()
    h.feeds.home = () => ({
      contents: {
        contents: [
          { type: 'RichSection', content: { type: 'RichShelf', title: { text: 'Shelf' }, contents: [{ type: 'RichItem', content: vid('aaaaaaaaaaa') }] } },
          { type: 'RichItem', content: vid('bbbbbbbbbbb') },
          { type: 'RichItem', content: vid('ccccccccccc') },
        ],
      },
    })
    const rows = await client.accountHome()
    expect(rows.map((r) => [r.title, r.items.map((i) => i.id)])).toEqual([
      ['Shelf', ['aaaaaaaaaaa']],
      ['Recommended', ['bbbbbbbbbbb', 'ccccccccccc']],
    ])
  })

  it('getPlaylistVideos returns videos from the playlist', async () => {
    const { client } = await load()
    h.feeds.playlist = () => ({ videos: [vid('aaaaaaaaaaa'), { type: 'PlaylistVideo', id: 'bbbbbbbbbbb', title: { text: 'P' } }] })
    expect((await client.getPlaylistVideos('PL1')).map((i) => i.id)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb'])
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
