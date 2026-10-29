import { stripPlayerAds } from '../filters/ads'
import { toVideos } from './items'
import type { Raw } from './raw'
import { text } from './raw'
import { getSession, proxied } from './session'
import type { AdaptiveStream, Caption, Details, Item, MediaTrack, Stream } from './types'

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

export async function channelVideos(channelId: string): Promise<{ items: Item[]; avatar?: string }> {
  const yt = await getSession()
  const ch = await (await yt.getChannel(channelId)).getVideos()
  const avatar = (ch as unknown as Raw).metadata?.avatar?.[0]?.url
  return { items: toVideos(ch.videos as unknown as Raw[]), avatar: typeof avatar === 'string' ? avatar : undefined }
}

export async function getChannelVideos(channelId: string): Promise<Item[]> {
  return (await channelVideos(channelId)).items
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

const MAX_HEIGHT = 1080

type Format = {
  url?: string
  mime_type: string
  height?: number
  average_bitrate?: number
  bitrate: number
  has_video: boolean
  has_audio: boolean
  init_range?: { start: number; end: number }
  index_range?: { start: number; end: number }
}

/** The format as a track, when it can be fed to a MediaSource here: a URL, byte ranges for the index, and a codec the browser plays. */
function toTrack(f: Format): MediaTrack | undefined {
  if (!f.url || !f.init_range || !f.index_range) return undefined
  if (typeof MediaSource === 'undefined' || !MediaSource.isTypeSupported(f.mime_type)) return undefined
  return { url: f.url, mime: f.mime_type, init: f.init_range, index: f.index_range, height: f.height }
}

const bitrate = (f: Format) => f.average_bitrate ?? f.bitrate

/**
 * The best H.264 video (up to MAX_HEIGHT) and AAC audio as separate tracks. The IOS client is used because its adaptive URLs need no
 * cipher handling and work with a locally generated session. Undefined when either track is missing, so the caller falls back to getStream.
 */
export async function getAdaptiveStream(videoId: string): Promise<AdaptiveStream | undefined> {
  const yt = await getSession()
  const info = await yt.getBasicInfo(videoId, { client: 'IOS' })
  const formats = (info.streaming_data?.adaptive_formats ?? []) as unknown as Format[]
  const video = formats
    .filter((f) => f.has_video && !f.has_audio && f.mime_type.includes('avc1') && (f.height ?? 0) <= MAX_HEIGHT)
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || bitrate(b) - bitrate(a))
    .flatMap((f) => toTrack(f) ?? [])[0]
  const audio = formats
    .filter((f) => f.has_audio && !f.has_video && f.mime_type.includes('mp4a'))
    .sort((a, b) => bitrate(b) - bitrate(a))
    .flatMap((f) => toTrack(f) ?? [])[0]
  const duration = info.basic_info.duration
  if (!video || !audio || !duration) return undefined
  return { video, audio, duration, title: info.basic_info.title ?? '', author: info.basic_info.author }
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
export async function fetchRange(url: string, start: number, end: number, signal?: AbortSignal): Promise<ArrayBuffer> {
  const res = await fetch(proxied(url), { headers: { Range: `bytes=${start}-${end}` }, signal })
  if (!res.ok) throw new Error(`range ${res.status}`)
  return res.arrayBuffer()
}
