import { Innertube, Utils, type OAuth2Tokens } from 'youtubei.js'
import { stripAds, stripPlayerAds } from '../filters/ads'
import { stripShorts } from '../filters/shorts'
import { clearAuth, loadCredentials, saveAccount, saveCredentials, type Account } from './auth'
import { toProxyHeaders } from './proxyHeaders'
import type { Caption, Details, Item, Row, Stream } from './types'

const proxied = (url: string) => `/__proxy?url=${encodeURIComponent(url)}`

// Browser fetch cannot set User-Agent or reach YouTube cross-origin, so route through the proxy.
async function proxyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const req = new Request(input as RequestInfo, init)
  const headers = toProxyHeaders(init, input)
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer()
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
  // A failed token refresh THROWS an OAuth2Error (the library only emits 'auth-error' while polling
  // for a device code), so treat it as sign-out. Other errors (offline) keep the stored credentials.
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
      if (e instanceof Utils.OAuth2Error) dropAuth()
      throw e
    }
  }
  const tokens = loadCredentials()
  if (tokens) {
    try {
      await yt.session.signIn(tokens)
    } catch (e) {
      if (!(e instanceof Utils.OAuth2Error)) throw e
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

export async function signOut(): Promise<void> {
  try {
    const yt = await getSession()
    await yt.session.signOut()
  } catch {
    /* clear local state regardless */
  }
  clearAuth()
  resetSession()
}

type Raw = Record<string, any>
const text = (t: any): string | undefined => (typeof t === 'string' ? t : t?.text)

/** Maps the parser's node types onto our flat Item shape. Returns undefined for unknown types. */
export function toItem(n: Raw): Item | undefined {
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
    const item = toItem(n)
    if (item) out.push(item)
    else if (Array.isArray(n.items)) out.push(...flatten(n.items))
  }
  return out
}

export async function search(query: string): Promise<Item[]> {
  const yt = await getSession()
  const res = await yt.search(query)
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

const asArray = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : [])
/** Home-feed grid entries wrap the real node in `.content`. */
const unwrap = (n: Raw): Raw => (n && n.content && typeof n.content === 'object' && !Array.isArray(n.content) ? n.content : n)

/** Personalised home: one row per shelf; loose grid items collect into a single "Recommended" row. */
export async function accountHome(): Promise<Row[]> {
  const yt = await getSession()
  const feed = (await yt.getHomeFeed()) as unknown as Raw
  const rows: Row[] = []
  const loose: Raw[] = []
  for (const entry of asArray(feed?.contents?.contents)) {
    if (!entry) continue
    const node = unwrap(entry)
    if (Array.isArray(node.contents) && node.title) {
      const items = toVideos(node.contents.map(unwrap))
      if (items.length) rows.push({ title: text(node.title) ?? '', items })
    } else {
      loose.push(node)
    }
  }
  const items = toVideos(loose)
  if (items.length) rows.push({ title: 'Recommended', items })
  return rows
}

export async function subscriptionsFeed(): Promise<Item[]> {
  const yt = await getSession()
  const feed = (await yt.getSubscriptionsFeed()) as unknown as Raw
  return toVideos(asArray(feed?.videos))
}

export async function accountPlaylists(): Promise<Item[]> {
  const yt = await getSession()
  const feed = (await yt.getPlaylists()) as unknown as Raw
  return flatten(asArray(feed?.playlists)).filter((i) => i.kind === 'playlist')
}

export async function accountHistory(): Promise<Item[]> {
  const yt = await getSession()
  const feed = (await yt.getHistory()) as unknown as Raw
  return toVideos(asArray(feed?.sections).flatMap((s) => asArray(s?.contents)))
}

export async function getPlaylistVideos(id: string): Promise<Item[]> {
  const yt = await getSession()
  const pl = (await yt.getPlaylist(id)) as unknown as Raw
  return toVideos(asArray(pl?.videos))
}
