import { useEffect, useMemo, useRef, useState } from 'react'
import { useProgress, useWatchlist } from '../store'
import { accountHome, homeRows } from '../yt/client'
import type { Item } from '../yt/types'
import { useAuth } from '../yt/auth'
import { homeIsEmpty } from './homeEmpty'
import { Hero } from './Hero'
import { useFeed } from './useFeed'
import { useRowSnap } from './useRowSnap'
import { RowView, type CardInfo } from './RowView'

const fmtLeft = (secs: number) => {
  const m = Math.max(1, Math.round(secs / 60))
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m left` : `${m}m left`
}

export function Home({ onOpen, onPlay }: { onOpen: (i: Item) => void; onPlay: (i: Item) => void }) {
  const { signedIn } = useAuth()
  const { data: rows, error } = useFeed(signedIn ? accountHome : homeRows, signedIn)
  const progress = useProgress()
  const watchlist = useWatchlist()

  // The cover previews whichever card is hovered or focused; short delay so scrolling past does not flicker it.
  const [focused, setFocused] = useState<Item>()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const preview = (i: Item) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setFocused(i), 250)
  }
  const leaveLists = () => {
    clearTimeout(timer.current)
    setFocused(undefined)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  const box = useRef<HTMLDivElement>(null)
  useRowSnap(box, !!rows)

  const heroItems = useMemo(() => (rows ?? []).flatMap((r) => r.items.slice(0, 2)).slice(0, 6), [rows])
  const resume: CardInfo[] = Object.values(progress)
    .sort((a, b) => b.ts - a.ts)
    .map((p) => ({ item: p.item, progress: p.dur ? p.pos / p.dur : 0, subtitle: fmtLeft(p.dur - p.pos) }))

  if (error) return <div className="msg">Failed to load: {error}</div>
  if (!rows) return <div className="msg">Loading…</div>

  if (homeIsEmpty(rows, resume.length, watchlist.length)) return <div className="msg">Nothing to show yet.</div>

  const rowProps = { onOpen, onPreview: preview }
  return (
    <div className="screen home">
      {heroItems.length > 0 && <Hero items={heroItems} focused={focused} onPlay={onPlay} />}
      <div
        className="home-rows"
        ref={box}
        onMouseLeave={leaveLists}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && leaveLists()}
      >
        {resume.length > 0 && <RowView title="Continue Watching" cards={resume} {...rowProps} />}
        {watchlist.length > 0 && <RowView title="Watchlist" cards={watchlist.map((item) => ({ item }))} {...rowProps} />}
        {rows.map((r) => (
          <RowView key={r.title} title={r.title} cards={r.items.map((item) => ({ item }))} {...rowProps} />
        ))}
      </div>
    </div>
  )
}
