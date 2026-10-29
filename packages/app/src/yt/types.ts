export type Item = {
  id: string
  kind: 'video' | 'playlist' | 'channel'
  title: string
  thumb: string
  author?: string
  /** Channel avatar, when the source response carries one. */
  authorAvatar?: string
  meta?: string
  /** Animated hover preview (silent, ~3s) when YouTube provides one. */
  preview?: string
}

export type Row = { title: string; items: Item[]; /** Channel avatar, for rows that are one channel's videos. */ avatar?: string }

export type Stream = { url: string; title: string; author?: string }

export type ByteRange = { start: number; end: number }

/** One DASH fragmented MP4 file (video only or audio only), with where its init segment and `sidx` index sit. */
export type MediaTrack = { url: string; mime: string; init: ByteRange; index: ByteRange; height?: number }

/** Separate video and audio tracks for a MediaSource: the way to get above the combined stream's resolution. */
export type AdaptiveStream = { video: MediaTrack; audio: MediaTrack; duration: number; title: string; author?: string }

export type Caption = { label: string; lang: string; url: string }

export type Details = {
  title: string
  description: string
  meta: string
  channel?: { id: string; name: string; avatar?: string; subs?: string }
  related: Item[]
}
