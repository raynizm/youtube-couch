import { useCallback, useRef, useState } from 'react'
import type { Item } from '../yt/types'
import { MIN_SKELETON_MS, wait } from './useFeed'
import { useLastRowLoader } from './useLastRowLoader'

/** Videos read on demand: each `next` call returns the following ones, and `done` says when there are no more. */
export type Feed = { done: boolean; next: (count: number) => Promise<Item[]> }

/**
 * A card grid fed page by page. `start` reads the first `pageSize` videos of a feed, holding the skeleton for at least
 * MIN_SKELETON_MS; after that, focusing the last row of cards loads more (see useLastRowLoader). Starting another feed
 * makes the earlier one's answers be ignored.
 */
export function usePagedFeed(pageSize: number) {
  const [items, setItems] = useState<Item[]>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const feed = useRef<Feed>(undefined)

  const start = useCallback(
    (f: Feed) => {
      feed.current = f
      setLoading(true)
      setError(undefined)
      Promise.all([f.next(pageSize), wait(MIN_SKELETON_MS)]).then(
        ([r]) => feed.current === f && (setItems(r), setLoading(false)),
        (e) => feed.current === f && (setError(String(e?.message ?? e)), setLoading(false)),
      )
    },
    [pageSize],
  )

  const { loadingMore, onFocus } = useLastRowLoader(
    items?.length ?? 0,
    () => !!feed.current && !feed.current.done,
    async (count) => {
      const f = feed.current
      const more = (await f?.next(count)) ?? []
      if (feed.current === f) setItems((cur) => [...(cur ?? []), ...more])
    },
  )

  return { items, loading, error, loadingMore, onFocus, start }
}
