import { stripAds } from '../filters/ads'
import { stripShorts } from '../filters/shorts'
import type { Raw } from './raw'
import { text } from './raw'
import type { Item } from './types'

/** "1.7K views · 8 hours ago · 2:11" for a LockupView: metadata rows first, then the duration badge on the thumbnail. */
function lockupMeta(n: Raw): string | undefined {
  const rows: Raw[] = n.metadata?.metadata?.metadata_rows ?? []
  const parts = rows.flatMap((r) => (r.metadata_parts ?? []) as Raw[]).map((p) => text(p.text))
  const overlays: Raw[] = n.content_image?.overlays ?? []
  const duration = overlays.flatMap((o) => (o.badges ?? []) as Raw[]).map((b) => b.text as string | undefined).find((t) => !!t && /^\d+(:\d{2}){1,2}$/.test(t))
  return [...parts, duration].filter(Boolean).join(' · ') || undefined
}

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
      authorAvatar: n.author?.thumbnails?.[0]?.url,
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
      meta: kind === 'video' ? lockupMeta(n) : undefined,
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

export function flatten(nodes: Raw[]): Item[] {
  const out: Item[] = []
  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue
    const item = toItem(n)
    if (item) out.push(item)
    else if (Array.isArray(n.items)) out.push(...flatten(n.items))
  }
  return out
}

/** Flattens a raw watch-next / channel node list into video Items, minus ads and shorts. */
export const toVideos = (nodes: Raw[] | null | undefined): Item[] =>
  flatten(stripAds(stripShorts(nodes ?? []))).filter((i) => i.kind === 'video')
