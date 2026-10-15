export type Item = {
  id: string
  kind: 'video' | 'playlist' | 'channel'
  title: string
  thumb: string
  author?: string
  meta?: string
  /** Animated hover preview (silent, ~3s) when YouTube provides one. */
  preview?: string
}

export type Row = { title: string; items: Item[] }

export type Stream = { url: string; title: string; author?: string }

export type Caption = { label: string; lang: string; url: string }

export type Details = {
  title: string
  description: string
  meta: string
  channel?: { id: string; name: string; avatar?: string; subs?: string }
  related: Item[]
}
