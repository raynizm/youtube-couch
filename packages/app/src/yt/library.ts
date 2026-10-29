import { newestFirst } from './age'
import type { Raw } from './raw'
import { getSession, tvBrowse } from './session'
import { allItems, continuationToken, parseGrid, parseHome, parseSubscribedChannels, parseSubscriptions } from './tv'
import type { Item, Row } from './types'
import { channelVideos } from './video'

/** Personalised home (TV client): one row per shelf. */
export async function accountHome(): Promise<Row[]> {
  return parseHome(await tvBrowse('FEwhat_to_watch'))
}

export async function subscriptionsFeed(): Promise<Item[]> {
  return parseSubscriptions(await tvBrowse('FEsubscriptions'))
}

const SUB_ROW_SIZE = 10
const SUB_FETCH_PARALLEL = 6

/** Items grouped into one row per author, alphabetical, newest first inside a row. */
function groupByAuthor(items: Item[]): Row[] {
  const by = new Map<string, Item[]>()
  for (const i of items) by.set(i.author ?? 'Other', [...(by.get(i.author ?? 'Other') ?? []), i])
  return [...by]
    .map(([title, list]) => ({ title, items: newestFirst(list).slice(0, SUB_ROW_SIZE), avatar: list.find((i) => i.authorAvatar)?.authorAvatar }))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
}

/** Subscribed channels from the web client's FEchannels page, for when the TV response lists none. */
async function webSubscribedChannels(): Promise<{ id: string; name: string; avatar?: string }[]> {
  try {
    const feed = await (await getSession()).getChannelsFeed()
    return (feed.channels as unknown as Raw[])
      .map((c) => ({ id: String(c.id ?? c.author?.id ?? ''), name: String(c.author?.name ?? c.title?.text ?? c.title ?? ''), avatar: c.author?.thumbnails?.[0]?.url as string | undefined }))
      .filter((c) => c.id && c.name)
  } catch {
    return []
  }
}

/** Runs `fn` over `items`, at most SUB_FETCH_PARALLEL at a time; results keep the order of `items`. */
async function inParallel<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(SUB_FETCH_PARALLEL, items.length) }, worker))
  return out
}

/** The channel behind each author in the feed, found through one of their videos. Authors whose video cannot be looked up are left out. */
async function channelsOfFeed(items: Item[]): Promise<{ id: string; name: string }[]> {
  const yt = await getSession()
  const byAuthor = new Map<string, Item>()
  for (const i of items) if (i.author && !byAuthor.has(i.author)) byAuthor.set(i.author, i)
  const found = await inParallel([...byAuthor], async ([name, video]) => {
    for (const client of ['ANDROID', 'WEB'] as const) {
      try {
        const id = (await yt.getBasicInfo(video.id, { client })).basic_info.channel_id
        if (id) return { id, name }
      } catch {
        // try the next client
      }
    }
    return undefined
  })
  return found.filter((c): c is { id: string; name: string } => !!c)
}

/**
 * One row per subscribed channel with its latest uploads. The channels come from the subscriptions page, else from the web
 * client's channel list, else from the authors in the feed. If no channel loads, the feed grouped by author stands in.
 */
export async function subscriptionRows(): Promise<Row[]> {
  const data = await tvBrowse('FEsubscriptions')
  const feed = parseSubscriptions(data)
  let channels = parseSubscribedChannels(data)
  if (!channels.length) channels = await webSubscribedChannels()
  if (!channels.length) channels = await channelsOfFeed(feed)
  console.info(`subscriptions: ${channels.length} channels`)
  const feedAvatar = new Map(feed.flatMap((i) => (i.author && i.authorAvatar ? [[i.author, i.authorAvatar] as const] : [])))
  const rows = await inParallel(channels, async (c): Promise<Row | undefined> => {
    const loaded = await channelVideos(c.id).catch(() => undefined)
    const items = loaded?.items.slice(0, SUB_ROW_SIZE) ?? []
    return items.length ? { title: c.name, items, avatar: ('avatar' in c ? (c.avatar as string | undefined) : undefined) ?? feedAvatar.get(c.name) ?? loaded?.avatar } : undefined
  })
  const found = rows.filter((r): r is Row => !!r).sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
  return found.length ? found : groupByAuthor(feed)
}

export async function accountPlaylists(): Promise<Item[]> {
  return parseGrid(await tvBrowse('FEplaylist_aggregation')).filter((i) => i.kind === 'playlist')
}

export const HISTORY_SIZE = 50

const HISTORY_MAX_PAGES = 5

/** The account's watch history, read on demand: each `next` call returns the following videos, following continuation pages as needed. */
export function historyFeed() {
  let data: unknown
  let started = false
  let more = true
  let buffer: Item[] = []
  const seen = new Set<string>()
  return {
    get done() {
      return !more && buffer.length === 0
    },
    async next(count: number): Promise<Item[]> {
      for (let page = 0; buffer.length < count && more && page < HISTORY_MAX_PAGES; page++) {
        const token = started ? continuationToken(data) : undefined
        if (started && !token) {
          more = false
          break
        }
        data = await tvBrowse(started ? { continuation: token! } : 'FEhistory')
        const items = started ? allItems(data) : parseGrid(data)
        started = true
        const fresh = items.filter((i) => i.kind === 'video' && !seen.has(i.id))
        for (const i of fresh) seen.add(i.id)
        buffer = [...buffer, ...fresh]
        if (!fresh.length) more = false
      }
      return buffer.splice(0, count)
    },
  }
}

export const accountHistory = (): Promise<Item[]> => historyFeed().next(HISTORY_SIZE)

/** Playlist browse shape was not captured, so every tile in the response is collected. */
export async function getPlaylistVideos(id: string): Promise<Item[]> {
  return allItems(await tvBrowse(`VL${id}`)).filter((i) => i.kind === 'video')
}
