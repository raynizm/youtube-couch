import { newestFirst } from './age'
import { accountHome, subscriptionsFeed } from './library'
import { search } from './search'
import type { Item, Row } from './types'

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
    row('Latest videos', latest ?? []),
    row('Recommended videos', recommended ?? []),
    row('Movie trailers', movies ?? []),
    row('Series trailers', series ?? []),
    row('Music', music ?? []),
  ].filter((r) => r.items.length > 0)
}

function allRowItems(rows: Row[] | undefined): Item[] {
  const seen = new Set<string>()
  return (rows ?? []).flatMap((r) => r.items).filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
}
