import { useProgress, useWatchlist } from '../store'
import type { Item } from '../yt/types'
import { Card } from './Card'

function Grid({ items, empty, onOpen }: { items: Item[]; empty: string; onOpen: (i: Item) => void }) {
  return (
    <div className="screen padded top">
      {items.length === 0 && <div className="msg">{empty}</div>}
      <div className="grid">
        {items.map((i) => (
          <Card key={i.id} item={i} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

export function History({ onOpen }: { onOpen: (i: Item) => void }) {
  const items = Object.values(useProgress())
    .sort((a, b) => b.ts - a.ts)
    .map((h) => h.item)
  return <Grid items={items} empty="No watch history yet." onOpen={onOpen} />
}

// Local "Watch later" playlist until account playlists arrive with login.
export function Playlists({ onOpen }: { onOpen: (i: Item) => void }) {
  return <Grid items={useWatchlist()} empty="Nothing saved yet. Use the bookmark button on Home." onOpen={onOpen} />
}

export function SignInNotice({ what }: { what: string }) {
  return <div className="msg top">Sign in to see your {what}. Account sign-in is coming soon.</div>
}
