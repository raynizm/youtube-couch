import { useState } from 'react'
import { search } from '../yt/client'
import type { Item } from '../yt/types'
import { Card } from './Card'
import { SearchIcon } from './icons'

// Category tiles mirror Pelagica's genre grid; each runs a search.
const CATEGORIES = ['Music', 'Gaming', 'News', 'Live', 'Podcasts', 'Movies', 'Science', 'Technology', 'Cooking', 'Sports', 'Comedy', 'Documentary']

export function Search({ onOpen }: { onOpen: (i: Item) => void }) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Item[]>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  const run = (query: string) => {
    if (!query.trim()) return
    setLoading(true)
    setError(undefined)
    search(query).then(
      (r) => (setItems(r), setLoading(false)),
      (e) => (setError(String(e.message ?? e)), setLoading(false)),
    )
  }

  return (
    <div className="screen padded">
      <div className="searchbar">
        <SearchIcon />
        <input
          data-focusable
          autoFocus
          placeholder="Search YouTube..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run(q)}
        />
      </div>
      {error && <div className="msg">Search failed: {error}</div>}
      {loading && <div className="msg">Searching…</div>}
      {!items && !loading && (
        <div className="tiles">
          {CATEGORIES.map((c) => (
            <button key={c} className="tile" data-focusable onClick={() => (setQ(c), run(c))}>
              {c}
            </button>
          ))}
        </div>
      )}
      {items?.length === 0 && !loading && <div className="msg">No results for “{q}”.</div>}
      {items && !loading && (
        <div className="grid">
          {items.map((i) => (
            <Card key={i.id} item={i} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  )
}
