import { useRef, useState } from 'react'
import { searchFeed } from '../yt/client'
import type { Item } from '../yt/types'
import { Card } from './Card'
import { SearchIcon } from './icons'
import { GridSkeleton } from './Skeleton'
import { MIN_SKELETON_MS, wait } from './useFeed'
import { gridPosition, useLastRowLoader } from './useLastRowLoader'

// Category tiles mirror Pelagica's genre grid; each runs a search.
const CATEGORIES = ['Music', 'Gaming', 'News', 'Live', 'Podcasts', 'Movies', 'Science', 'Technology', 'Cooking', 'Sports', 'Comedy', 'Documentary']

const RESULT_COUNT = 24

export function Search({ onOpen }: { onOpen: (i: Item) => void }) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Item[]>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  const input = useRef<HTMLInputElement>(null)
  const feed = useRef<ReturnType<typeof searchFeed>>(undefined)

  const run = (query: string) => {
    if (!query.trim()) return
    setLoading(true)
    setError(undefined)
    const f = (feed.current = searchFeed(query))
    // Hold the skeleton for at least MIN_SKELETON_MS, even when the answer is fast.
    Promise.all([f.next(RESULT_COUNT), wait(MIN_SKELETON_MS)]).then(
      ([r]) => feed.current === f && (setItems(r), setLoading(false)),
      (e) => feed.current === f && (setError(String(e.message ?? e)), setLoading(false)),
    )
  }

  // Up from the first row of results goes straight to the search bar. The general rule would pick the nearest control by
  // position, which for cards outside the bar's width is a tab in the nav bar, or a card scrolled out of view above.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowUp') return
    const pos = gridPosition(e.currentTarget, (e.target as HTMLElement).closest('.card'))
    if (!pos || pos.index >= pos.columns) return
    e.preventDefault()
    e.stopPropagation()
    input.current?.focus()
  }

  const { loadingMore, onFocus } = useLastRowLoader(
    items?.length ?? 0,
    () => !!feed.current && !feed.current.done,
    async (count) => {
      const f = feed.current
      const more = (await f?.next(count)) ?? []
      if (feed.current === f) setItems((cur) => [...(cur ?? []), ...more])
    },
  )

  return (
    <div className="screen padded search lit-grid history">
      <div className="searchbar">
        <SearchIcon />
        <input
          ref={input}
          data-focusable
          autoFocus
          placeholder="Search YouTube..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run(q)}
        />
      </div>
      <div className="search-body" onFocus={onFocus} onKeyDown={onKeyDown}>
        {error && <div className="msg">Search failed: {error}</div>}
        {loading && <GridSkeleton labels />}
        {!items && !loading && (
          <div className="tiles">
            {CATEGORIES.map((c, i) => (
              <button key={c} className="tile" style={{ '--hue': (i * 360) / CATEGORIES.length + 210 } as React.CSSProperties} data-focusable onClick={() => (setQ(c), run(c))}>
                {c}
              </button>
            ))}
          </div>
        )}
        {items?.length === 0 && !loading && <div className="msg">No results for “{q}”.</div>}
        {items && !loading && (
          <div className="grid">
            {items.map((i) => (
              <Card key={i.id} item={i} labels spoken channel onOpen={onOpen} />
            ))}
          </div>
        )}
        {items && !loading && loadingMore > 0 && <GridSkeleton labels count={loadingMore} />}
      </div>
    </div>
  )
}
