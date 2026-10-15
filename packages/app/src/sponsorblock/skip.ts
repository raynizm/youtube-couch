export type Segment = { category: string; segment: [number, number] }

export const DEFAULT_CATEGORIES = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro', 'preview']

const API = 'https://sponsor.ajay.app/api/skipSegments'

const proxied = (url: string) => (import.meta.env.DEV ? `/__proxy?url=${encodeURIComponent(url)}` : url)

async function hashPrefix(id: string): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) return undefined
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id))
  return Array.from(new Uint8Array(buf).slice(0, 2), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Fetches segments for a video. Uses the privacy-preserving hash-prefix endpoint when available. */
export async function fetchSegments(videoId: string, categories = DEFAULT_CATEGORIES): Promise<Segment[]> {
  const cats = encodeURIComponent(JSON.stringify(categories))
  try {
    const prefix = await hashPrefix(videoId)
    const url = prefix
      ? `${API}/${prefix}?categories=${cats}&actionType=skip`
      : `${API}?videoID=${videoId}&categories=${cats}&actionType=skip`
    const res = await fetch(proxied(url))
    if (!res.ok) return []
    const data = await res.json()
    const entries = prefix ? (data as any[]).filter((d) => d.videoID === videoId) : [{ segments: data }]
    return entries.flatMap((e) => e.segments as Segment[])
  } catch {
    return []
  }
}

/** The enabled segment containing `time`, if any. End boundary is exclusive to avoid re-skipping. */
export function findSkip(segments: Segment[], time: number, enabled: string[]): Segment | undefined {
  return segments.find((s) => enabled.includes(s.category) && time >= s.segment[0] && time < s.segment[1])
}
