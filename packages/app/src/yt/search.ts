import type { Innertube } from 'youtubei.js'
import { stripAds } from '../filters/ads'
import { stripShorts } from '../filters/shorts'
import { flatten } from './items'
import type { Raw } from './raw'
import { getSession } from './session'
import type { Item } from './types'

type SearchFilters = Parameters<Innertube['search']>[1]

export async function search(query: string, filters?: SearchFilters): Promise<Item[]> {
  const yt = await getSession()
  const res = await yt.search(query, filters)
  return searchVideos(res)
}

const searchVideos = (res: { results?: unknown }): Item[] => flatten(stripAds(stripShorts((res.results ?? []) as Raw[]))).filter((i) => i.kind === 'video')

const MAX_SEARCH_PAGES = 4

/** Result pages of one query, read on demand: each `next` call returns new videos until `count` are in or the pages run out. */
export function searchFeed(query: string) {
  let res: Awaited<ReturnType<Innertube['search']>> | undefined
  let more = true
  const seen = new Set<string>()
  return {
    get done() {
      return !more
    },
    async next(count: number): Promise<Item[]> {
      const out: Item[] = []
      for (let page = 0; out.length < count && more && page < MAX_SEARCH_PAGES; page++) {
        res = res ? await res.getContinuation() : await (await getSession()).search(query)
        more = res.has_continuation
        for (const i of searchVideos(res)) if (!seen.has(i.id)) (seen.add(i.id), out.push(i))
      }
      return out
    },
  }
}
