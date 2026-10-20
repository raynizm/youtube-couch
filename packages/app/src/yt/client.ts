import { Innertube, Utils, type OAuth2Tokens } from 'youtubei.js'
import { stripAds, stripPlayerAds } from '../filters/ads'
import { stripShorts } from '../filters/shorts'
import { newestFirst } from './age'
import { clearAuth, loadCredentials, loadProfileId, saveAccount, saveCredentials, saveProfileId, type Account } from './auth'
import { parseProfiles, type Profile } from './profiles'
import { scopeBearer, scopeProfile, toProxyHeaders } from './proxyHeaders'
import { allItems, parseGrid, parseHome, parseSubscriptions } from './tv'
import type { Caption, Details, Item, Row, Stream } from './types'

const proxied = (url: string) => `/__proxy?url=${encodeURIComponent(url)}`

// Browser fetch cannot set User-Agent or reach YouTube cross-origin, so route through the proxy.
async function proxyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const req = new Request(input as RequestInfo, init)
  const headers = toProxyHeaders(init, input)
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : scopeProfile(await req.arrayBuffer())
  scopeBearer(headers, body)
  return fetch(proxied(req.url), { method: req.method, headers, body })
}

let session: Promise<Innertube> | undefined
let current: Innertube | undefined
const resetSession = () => {
  session = undefined
  current = undefined
}
// A stale session (cancelled sign-in, pre-signOut) must not touch newer state.
const resetIfCurrent = (yt: Innertube) => {
  if (current === yt) resetSession()
}

/** True only for an OAuth2Error that means the server refused the credentials (not a transient failure). */
function isAuthRejection(e: unknown): boolean {
  if (!(e instanceof Utils.OAuth2Error)) return false
  const status = /(\d{3})\s*$/.exec(e.message)?.[1]
  if (status) return status === '400' || status === '401'
  const info = (e as { info?: Raw }).info
  if (info && (info.error || info.error_code)) return true
  return /invalid tokens|no tokens available|invalid_grant/i.test(e.message)
}

const isUnauthorized = (e: unknown) => e instanceof Error && /status code 401\b/.test(e.message)

/** Makes every request act as the given page id; undefined goes back to the primary account. */
function applyProfile(yt: Innertube, id: string | undefined) {
  const user = yt.session.context?.user
  if (!user) return
  if (id) user.onBehalfOfUser = id
  else delete user.onBehalfOfUser
}

async function createSession(): Promise<Innertube> {
  const yt = await Innertube.create({
    fetch: proxyFetch as typeof fetch,
    retrieve_player: false,
    generate_session_locally: true,
  })
  current = yt
  yt.session.on('update-credentials', ({ credentials }) => {
    if (credentials && current === yt) saveCredentials(credentials)
  })
  yt.session.on('auth-error', () => {
    if (current !== yt) return
    clearAuth()
    resetSession()
  })
  // A refresh the server REJECTS (HTTP 400/401, invalid_grant) throws an OAuth2Error, and a 401 on an
  // authenticated request throws an InnertubeError; both mean the credentials are dead. Network
  // failures, 5xx and 429 keep the stored credentials.
  const dropAuth = () => {
    if (current !== yt) return
    clearAuth()
    resetSession()
  }
  const http = yt.session.http
  const rawFetch = http.fetch.bind(http)
  http.fetch = async (...args: Parameters<typeof rawFetch>) => {
    try {
      return await rawFetch(...args)
    } catch (e) {
      if (isAuthRejection(e) || (yt.session.logged_in && isUnauthorized(e))) dropAuth()
      throw e
    }
  }
  const tokens = loadCredentials()
  if (tokens) {
    try {
      await yt.session.signIn(tokens)
      applyProfile(yt, loadProfileId())
    } catch (e) {
      if (!isAuthRejection(e)) throw e
      clearAuth()
    }
  }
  return yt
}

const getSession = () => (session ??= createSession().catch((e) => {
  resetSession()
  throw e
}))

export type SignInCode = { code: string; url: string }

/**
 * Starts the device-code flow. Limitation: the library's code poller (setInterval ~5s, up to ~30min)
 * keeps running after cancel/retry; state stays correct because that session is discarded.
 * `cancel` silences every handler and rejects `done`.
 */
export function startSignIn(onCode: (c: SignInCode) => void): { done: Promise<void>; cancel: () => void } {
  let cancelled = false
  let stop: () => void = () => {}
  let fail: (e: Error) => void = () => {}
  const done = new Promise<void>((resolve, reject) => {
    fail = reject
    getSession().then((yt) => {
      if (cancelled) return
      const s = yt.session
      const onPending = (d: { user_code: string; verification_url: string }) => {
        if (!cancelled) onCode({ code: d.user_code, url: d.verification_url })
      }
      const onAuth = async (data: { credentials?: OAuth2Tokens }) => {
        if (cancelled) return
        cleanup()
        // The library's own once('auth') handler (logged_in = true) was registered after ours and
        // runs synchronously later in this same emit; one microtask turn lets it finish first.
        await Promise.resolve()
        try {
          const credentials = data.credentials
          if (!credentials) throw new Error('Sign-in returned no credentials')
          let account: Account = { name: 'Account' }
          try {
            const info = (await yt.account.getInfo()) as unknown as Raw
            const first = info.contents?.contents?.[0]
            const name = first?.account_name?.text
            if (name) account = { name, avatar: first?.account_photo?.[0]?.url ?? info.account_photo?.[0]?.url }
          } catch {
            /* keep the generic name */
          }
          if (cancelled) return
          saveCredentials(credentials)
          saveAccount(account)
          resolve()
        } catch (e) {
          resetIfCurrent(yt)
          reject(e instanceof Error ? e : new Error('Sign-in failed'))
        }
      }
      const onError = (e: unknown) => {
        if (cancelled) return
        cleanup()
        resetIfCurrent(yt)
        reject(e instanceof Error ? e : new Error('Sign-in failed'))
      }
      function cleanup() {
        s.off('auth-pending', onPending)
        s.off('auth', onAuth)
        s.off('auth-error', onError)
      }
      stop = () => {
        cleanup()
        resetIfCurrent(yt)
      }
      s.on('auth-pending', onPending)
      s.on('auth', onAuth)
      s.on('auth-error', onError)
      s.signIn().catch(onError)
    }, reject)
  })
  return {
    done,
    cancel: () => {
      if (cancelled) return
      cancelled = true
      stop()
      fail(new Error('Sign-in cancelled'))
    },
  }
}

const REVOKE_TIMEOUT_MS = 5000

/** Signs out locally at once; revoking the token on the server is best effort in the background. */
export async function signOut(): Promise<void> {
  const pending = session
  clearAuth()
  resetSession()
  if (!pending) return
  void pending
    .then((yt) =>
      Promise.race([yt.session.signOut(), new Promise<void>((resolve) => setTimeout(resolve, REVOKE_TIMEOUT_MS))]),
    )
    .catch(() => {})
}

type Raw = Record<string, any>
const text = (t: any): string | undefined => (typeof t === 'string' ? t : t?.text)

/** Maps the parser's node types onto our flat Item shape. Returns undefined for unknown types. */
export function toItem(n: Raw): Item | undefined {
  if (!n) return undefined
  if (n.type === 'Video' && n.id) {
    return {
      id: n.id,
      kind: 'video',
      title: text(n.title) ?? '',
      thumb: n.thumbnails?.[0]?.url ?? `https://i.ytimg.com/vi/${n.id}/hqdefault.jpg`,
      author: n.author?.name,
      preview: n.rich_thumbnail?.[0]?.url,
      meta: [n.short_view_count?.text, n.published?.text, n.duration?.text].filter(Boolean).join(' · '),
    }
  }
  if (n.type === 'LockupView' && n.content_id) {
    const kind = n.content_type === 'VIDEO' ? 'video' : n.content_type === 'PLAYLIST' ? 'playlist' : undefined
    if (!kind) return undefined
    return {
      id: n.content_id,
      kind,
      title: text(n.metadata?.title) ?? '',
      thumb: n.content_image?.image?.[0]?.url ?? `https://i.ytimg.com/vi/${n.content_id}/hqdefault.jpg`,
    }
  }
  if ((n.type === 'Playlist' || n.type === 'GridPlaylist') && n.id) {
    return {
      id: n.id,
      kind: 'playlist',
      title: text(n.title) ?? '',
      thumb: n.thumbnails?.[0]?.url ?? '',
    }
  }
  if ((n.type === 'PlaylistVideo' || n.type === 'GridVideo') && n.id) {
    return {
      id: n.id,
      kind: 'video',
      title: text(n.title) ?? '',
      thumb: n.thumbnails?.[0]?.url ?? `https://i.ytimg.com/vi/${n.id}/hqdefault.jpg`,
      author: n.author?.name,
      meta: [n.video_info?.text, n.duration?.text].filter(Boolean).join(' · '),
    }
  }
  return undefined
}

function flatten(nodes: Raw[]): Item[] {
  const out: Item[] = []
  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue
    const item = toItem(n)
    if (item) out.push(item)
    else if (Array.isArray(n.items)) out.push(...flatten(n.items))
  }
  return out
}

type SearchFilters = Parameters<Innertube['search']>[1]

export async function search(query: string, filters?: SearchFilters): Promise<Item[]> {
  const yt = await getSession()
  const res = await yt.search(query, filters)
  const nodes = stripAds(stripShorts((res.results ?? []) as Raw[]))
  return flatten(nodes).filter((i) => i.kind === 'video')
}

const HOME_TOPICS = ['Trending today', 'Music', 'Gaming', 'Live now', 'News', 'Science and tech', 'Cooking', 'Movie trailers']

/** Signed-out home: one row per topic. Replaced by the real home feed once login lands. */
export async function homeRows(): Promise<Row[]> {
  const rows = await Promise.all(
    HOME_TOPICS.map((title) =>
      search(title).then(
        (items) => ({ title, items: items.slice(0, 15) }),
        () => null,
      ),
    ),
  )
  return rows.filter((r): r is Row => !!r && r.items.length > 0)
}

/** Flattens a raw watch-next / channel node list into video Items, minus ads and shorts. */
export const toVideos = (nodes: Raw[] | null | undefined): Item[] =>
  flatten(stripAds(stripShorts(nodes ?? []))).filter((i) => i.kind === 'video')

/** Maps a youtubei.js VideoInfo onto the fields the details page shows. */
export function toDetails(info: Raw): Details {
  const owner = info.secondary_info?.owner
  const author = owner?.author
  const id = author?.id ?? info.basic_info?.channel_id
  const views = info.primary_info?.view_count?.short_view_count ?? info.primary_info?.view_count?.view_count
  return {
    title: info.basic_info?.title ?? text(info.primary_info?.title) ?? '',
    description: text(info.secondary_info?.description) ?? info.basic_info?.short_description ?? '',
    meta: [text(views), text(info.primary_info?.relative_date) ?? text(info.primary_info?.published)].filter(Boolean).join(' · '),
    channel: id
      ? {
          id,
          name: author?.name ?? info.basic_info?.author ?? '',
          avatar: author?.thumbnails?.[0]?.url,
          subs: text(owner?.subscriber_count),
        }
      : undefined,
    related: toVideos(info.watch_next_feed as Raw[]),
  }
}

export async function getDetails(videoId: string): Promise<Details> {
  const yt = await getSession()
  return toDetails((await yt.getInfo(videoId)) as unknown as Raw)
}

export async function getChannelVideos(channelId: string): Promise<Item[]> {
  const yt = await getSession()
  const ch = await (await yt.getChannel(channelId)).getVideos()
  return toVideos(ch.videos as unknown as Raw[])
}

export async function getStream(videoId: string): Promise<Stream> {
  const yt = await getSession()
  const info = await yt.getBasicInfo(videoId, { client: 'ANDROID' })
  const sd = info.streaming_data
  stripPlayerAds(sd as unknown as Record<string, unknown>)
  const format = sd?.formats?.find((f) => f.url) ?? sd?.formats?.[0]
  if (!format?.url) throw new Error('No playable stream')
  return { url: format.url, title: info.basic_info.title ?? '', author: info.basic_info.author }
}

/** Subtitle tracks as WebVTT blob URLs. Tries ANDROID first, then WEB, since either may omit captions. */
export async function getCaptions(videoId: string): Promise<Caption[]> {
  const yt = await getSession()
  for (const client of ['ANDROID', 'WEB'] as const) {
    try {
      const info = await yt.getBasicInfo(videoId, { client })
      const tracks = info.captions?.caption_tracks ?? []
      if (!tracks.length) continue
      const out = await Promise.all(
        tracks.map(async (t): Promise<Caption | undefined> => {
          try {
            const res = await fetch(proxied(`${t.base_url}&fmt=vtt`))
            if (!res.ok) return undefined
            const url = URL.createObjectURL(new Blob([await res.text()], { type: 'text/vtt' }))
            return { label: text(t.name) ?? t.language_code, lang: t.language_code, url }
          } catch {
            return undefined
          }
        }),
      )
      const ok = out.filter((c): c is Caption => !!c)
      if (ok.length) return ok
    } catch {
      /* try next client */
    }
  }
  return []
}

export type PreviewClip = { url: string; mime: string; bytes: number }

const CLIP_BYTES = 3_000_000
const previews = new Map<string, Promise<PreviewClip | undefined>>()

/**
 * Silent clip for the cover: a 720p video-only H.264 stream. These are DASH fragmented MP4s,
 * which `<video src>` rejects, so the caller feeds them to a MediaSource. The IOS client is used
 * because its adaptive URLs need no cipher handling and work with a locally generated session.
 */
export function getPreviewClip(videoId: string): Promise<PreviewClip | undefined> {
  let hit = previews.get(videoId)
  if (!hit) {
    hit = (async () => {
      const yt = await getSession()
      const info = await yt.getBasicInfo(videoId, { client: 'IOS' })
      const video = (info.streaming_data?.adaptive_formats ?? [])
        .filter((f) => f.has_video && f.mime_type.includes('avc1') && f.url && (f.height ?? 0) <= 720)
        .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0]
      if (!video?.url) return undefined
      return { url: video.url, mime: video.mime_type, bytes: Math.min(video.content_length ?? CLIP_BYTES, CLIP_BYTES) }
    })().catch(() => undefined)
    previews.set(videoId, hit)
  }
  return hit
}

/** Fetches a byte range of a stream through the same route the rest of the app uses. */
export async function fetchRange(url: string, start: number, end: number): Promise<ArrayBuffer> {
  const res = await fetch(proxied(url), { headers: { Range: `bytes=${start}-${end}` } })
  if (!res.ok) throw new Error(`range ${res.status}`)
  return res.arrayBuffer()
}

const tvBrowse = async (browseId: string): Promise<unknown> => {
  const yt = await getSession()
  const res = (await yt.actions.execute('/browse', { browseId, client: 'TV' } as any)) as unknown as Raw
  return res?.data
}

/** Personalised home (TV client): one row per shelf. */
export async function accountHome(): Promise<Row[]> {
  return parseHome(await tvBrowse('FEwhat_to_watch'))
}

export async function subscriptionsFeed(): Promise<Item[]> {
  return parseSubscriptions(await tvBrowse('FEsubscriptions'))
}

export async function accountPlaylists(): Promise<Item[]> {
  return parseGrid(await tvBrowse('FEplaylist_aggregation')).filter((i) => i.kind === 'playlist')
}

export async function accountHistory(): Promise<Item[]> {
  return parseGrid(await tvBrowse('FEhistory')).filter((i) => i.kind === 'video')
}

/** Playlist browse shape was not captured, so every tile in the response is collected. */
export async function getPlaylistVideos(id: string): Promise<Item[]> {
  return allItems(await tvBrowse(`VL${id}`)).filter((i) => i.kind === 'video')
}

/** Every profile the signed-in login can act as. Empty when the response has none we understand. */
export async function listProfiles(): Promise<Profile[]> {
  const yt = await getSession()
  const ask = async (args: Raw) => ((await yt.actions.execute('/account/accounts_list', { ...args, client: 'TV' } as any)) as unknown as Raw)?.data
  const switcher = await ask({ requestType: 'ACCOUNTS_LIST_REQUEST_TYPE_CHANNEL_SWITCHER', callCircumstance: 'SWITCHING_USERS_FULL' }).catch(() => undefined)
  let profiles = parseProfiles(switcher)
  if (profiles.length < 2) {
    const plain = await ask({}).catch(() => undefined)
    const more = parseProfiles(plain)
    if (more.length > profiles.length) profiles = more
  }
  return profiles
}

/** Switches the whole app to one profile; feeds keyed on the auth snapshot refetch on their own. */
export async function selectProfile(p: Profile): Promise<void> {
  const yt = await getSession()
  applyProfile(yt, p.id)
  saveAccount({ name: p.name, avatar: p.avatar })
  saveProfileId(p.id)
}

const HOME_ROW_SIZE = 20
// Newest first, then trimmed, so the freshest uploads are the ones kept.
const row = (title: string, items: Item[]): Row => ({ title, items: newestFirst(items).slice(0, HOME_ROW_SIZE) })
const settled = <T>(p: Promise<T>): Promise<T | undefined> => p.catch(() => undefined)

/**
 * The home screen's fixed set of rows: Latest, Recommended, Movie trailers, Series trailers, Music.
 * Signed in, Latest comes from the subscriptions and Recommended from the account's own home feed;
 * otherwise both fall back to searches. A row that fails or comes back empty is left out.
 */
export async function curatedHome(signedIn: boolean): Promise<Row[]> {
  const latestSearch = () => search('new videos', { upload_date: 'today', type: 'video' })
  const [latest, recommended, movies, series, music] = await Promise.all([
    signedIn ? settled(subscriptionsFeed()).then((i) => (i?.length ? i : settled(latestSearch()))) : settled(latestSearch()),
    signedIn
      ? settled(accountHome()).then((rows) => allRowItems(rows))
      : settled(search('Trending today')),
    settled(search('Movie trailers')),
    settled(search('TV series trailers')),
    settled(search('Music')),
  ])
  return [
    row('Latest', latest ?? []),
    row('Recommended', recommended ?? []),
    row('Movie trailers', movies ?? []),
    row('Series trailers', series ?? []),
    row('Music', music ?? []),
  ].filter((r) => r.items.length > 0)
}

function allRowItems(rows: Row[] | undefined): Item[] {
  const seen = new Set<string>()
  return (rows ?? []).flatMap((r) => r.items).filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
}
