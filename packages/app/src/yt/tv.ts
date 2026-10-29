// Pure parser for TVHTML5 browse responses. The library has no parser for these, so the
// feeds are read straight from the raw JSON. Every node may be null or odd: skip, never throw.
import type { Item, Row } from './types'

type Raw = Record<string, any>

const MAX_DEPTH = 40
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : [])
const obj = (v: unknown): Raw | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : undefined)

/** Text of a `simpleText` / `runs[]` node. */
export function textOf(t: unknown): string {
  const n = obj(t)
  if (!n) return typeof t === 'string' ? t : ''
  if (typeof n.simpleText === 'string') return n.simpleText
  return arr(n.runs)
    .map((r) => (typeof r?.text === 'string' ? r.text : ''))
    .join('')
}

const lineTexts = (line: Raw | undefined): string[] =>
  arr(line?.lineRenderer?.items)
    .map((i) => textOf(i?.lineItemRenderer?.text))
    .filter((t) => t && t !== '•')

/** Channel avatar of a tile, if its metadata has one (the exact node varies, so a few shapes are tried). */
function avatarOf(meta: Raw | undefined): string | undefined {
  const a = meta?.avatar
  const url = a?.thumbnails?.[0]?.url ?? a?.avatarViewModel?.image?.sources?.[0]?.url ?? a?.sources?.[0]?.url
  return typeof url === 'string' && url ? url : undefined
}

/** Maps one `tileRenderer` to an Item; undefined for shorts, unknown types or missing ids. */
export function tileToItem(tile: unknown): Item | undefined {
  const t = obj(tile)
  if (!t || typeof t.contentId !== 'string' || !t.contentId) return undefined
  const type = t.contentType
  if (type !== 'TILE_CONTENT_TYPE_VIDEO' && type !== 'TILE_CONTENT_TYPE_PLAYLIST') return undefined
  const id = t.contentId
  const meta = obj(t.metadata?.tileMetadataRenderer)
  const title = textOf(meta?.title)
  const thumbs = arr(t.header?.tileHeaderRenderer?.thumbnail?.thumbnails)
  const thumbUrl = typeof thumbs[0]?.url === 'string' ? thumbs[0].url : ''
  if (type === 'TILE_CONTENT_TYPE_PLAYLIST') {
    return { id, kind: 'playlist', title, thumb: thumbUrl }
  }
  const lines = arr(meta?.lines)
  const author = lineTexts(lines[0])[0]
  const overlays = arr(t.header?.tileHeaderRenderer?.thumbnailOverlays)
  const duration = textOf(overlays.map((o) => o?.thumbnailOverlayTimeStatusRenderer).find(Boolean)?.text)
  return {
    id,
    kind: 'video',
    title,
    thumb: thumbUrl || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    author: author || undefined,
    authorAvatar: avatarOf(meta),
    meta: [...lineTexts(lines[1]), duration].filter(Boolean).join(' · '),
  }
}

/** Every `tileRenderer` anywhere under `node`, in document order. Depth-capped and null-safe. */
export function collectTiles(node: unknown, depth = 0, out: Raw[] = []): Raw[] {
  if (!node || typeof node !== 'object' || depth > MAX_DEPTH) return out
  if (Array.isArray(node)) {
    for (const n of node) collectTiles(n, depth + 1, out)
    return out
  }
  for (const [k, v] of Object.entries(node as Raw)) {
    if (k === 'tileRenderer') {
      if (obj(v)) out.push(v as Raw)
    } else {
      collectTiles(v, depth + 1, out)
    }
  }
  return out
}

function dedupe(items: Item[]): Item[] {
  const seen = new Set<string>()
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
}

export const tilesToItems = (tiles: unknown): Item[] =>
  dedupe(arr(tiles).map((t) => tileToItem(t?.tileRenderer ?? t)).filter((i): i is Item => !!i))

/** All items from every tile found anywhere in the response. */
export const allItems = (data: unknown): Item[] => tilesToItems(collectTiles(data))

const surfaceShelves = (surface: Raw | undefined): Raw[] =>
  arr(surface?.content?.sectionListRenderer?.contents)

function shelvesToRows(shelves: Raw[]): Row[] {
  const rows: Row[] = []
  for (const s of shelves) {
    const shelf = obj(s?.shelfRenderer)
    if (!shelf) continue
    const title = textOf(shelf.headerRenderer?.shelfHeaderRenderer?.avatarLockup?.avatarLockupRenderer?.title)
    const items = tilesToItems(shelf.content?.horizontalListRenderer?.items)
    if (items.length) rows.push({ title, items })
  }
  return rows
}

/** FEwhat_to_watch -> one Row per shelf. */
export function parseHome(data: unknown): Row[] {
  const surface = (data as Raw)?.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer
  const rows = shelvesToRows(surfaceShelves(surface))
  if (rows.length) return rows
  const items = allItems(data)
  return items.length ? [{ title: 'Recommended', items }] : []
}

/** FEsubscriptions -> all tiles of the first ("All") tab, flattened. */
export function parseSubscriptions(data: unknown): Item[] {
  const nav = (data as Raw)?.contents?.tvBrowseRenderer?.content?.tvSecondaryNavRenderer
  const tab = arr(nav?.sections?.[0]?.tvSecondaryNavSectionRenderer?.tabs)[0]
  const shelves = surfaceShelves(tab?.tabRenderer?.content?.tvSurfaceContentRenderer)
  const items = dedupe(shelvesToRows(shelves).flatMap((r) => r.items))
  return items.length ? items : allItems(tab ?? data)
}

/** Channels listed after the "All" tab of FEsubscriptions: each tab is one subscribed channel. */
export function parseSubscribedChannels(data: unknown): { id: string; name: string; avatar?: string }[] {
  const nav = (data as Raw)?.contents?.tvBrowseRenderer?.content?.tvSecondaryNavRenderer
  const out: { id: string; name: string; avatar?: string }[] = []
  for (const section of arr(nav?.sections)) {
    for (const t of arr(section?.tvSecondaryNavSectionRenderer?.tabs).slice(0, 200)) {
      const tab = obj(t?.tabRenderer)
      const id = findBrowseId(tab?.endpoint ?? tab)
      const name = textOf(tab?.title)
      if (id && name && !out.some((c) => c.id === id)) out.push({ id, name, avatar: avatarOf(tab) })
    }
  }
  return out
}

/** First `browseId` of a channel (UC...) anywhere under `node`. */
function findBrowseId(node: unknown, depth = 0): string | undefined {
  if (!node || typeof node !== 'object' || depth > 8) return undefined
  for (const [k, v] of Object.entries(node as Raw)) {
    if (k === 'browseId' && typeof v === 'string' && v.startsWith('UC')) return v
    const found = findBrowseId(v, depth + 1)
    if (found) return found
  }
  return undefined
}

/** FEhistory / FEplaylist_aggregation -> grid tiles. */
export function parseGrid(data: unknown): Item[] {
  const grid = (data as Raw)?.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content?.gridRenderer
  const items = tilesToItems(grid?.items)
  return items.length ? items : allItems(data)
}
