import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { curatedHome } from '../yt/client'
import type { Item } from '../yt/types'
import { useAuth } from '../yt/auth'
import { Hero } from './Hero'
import { useFeed } from './useFeed'
import { useRowSnap } from './useRowSnap'
import { newestFirst } from '../yt/age'
import { RowView } from './RowView'

export function Home({ onOpen, onPlay }: { onOpen: (i: Item) => void; onPlay: (i: Item) => void }) {
  const { signedIn, feedKey } = useAuth()
  const fetchRows = useCallback(() => curatedHome(signedIn), [signedIn])
  const { data: rows, error } = useFeed(fetchRows, feedKey)

  // The cover previews whichever card is hovered or focused; short delay so scrolling past does not flicker it.
  const [focused, setFocused] = useState<Item>()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // Stable identities: every focus change re-renders Home, and the rows (hundreds of cards, tripled when looping) must not follow.
  const preview = useCallback((i: Item) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setFocused(i), 250)
  }, [])
  const leaveLists = useCallback(() => {
    clearTimeout(timer.current)
    setFocused(undefined)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])

  const box = useRef<HTMLDivElement>(null)
  useRowSnap(box, !!rows)

  const heroItems = useMemo(() => (rows ?? []).flatMap((r) => r.items.slice(0, 2)).slice(0, 6), [rows])
  const cardRows = useMemo(() => (rows ?? []).map((r) => ({ title: r.title, cards: newestFirst(r.items).map((item) => ({ item })) })), [rows])

  if (error) return <div className="msg">Failed to load: {error}</div>
  if (!rows) return <div className="msg">Loading…</div>

  if (rows.length === 0) return <div className="msg">Nothing to show yet.</div>

  return (
    <div className="screen home">
      {heroItems.length > 0 && <Hero items={heroItems} focused={focused} onPlay={onPlay} />}
      <div
        className="home-rows"
        ref={box}
        onMouseLeave={leaveLists}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && leaveLists()}
      >
        {cardRows.map((r) => (
          <RowView key={r.title} title={r.title} cards={r.cards} arrows={false} loop onOpen={onOpen} onPreview={preview} />
        ))}
      </div>
    </div>
  )
}
