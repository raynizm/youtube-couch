import { useProgress, useWatchlist } from '../store'
import { useAuth } from '../yt/auth'
import { accountHistory, subscriptionsFeed } from '../yt/client'
import type { Item } from '../yt/types'
import { Card } from './Card'
import { useFeed } from './useFeed'

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

// Loading / error / grid for an account feed.
export function FeedGrid({ fetcher, empty, onOpen }: { fetcher: () => Promise<Item[]>; empty: string; onOpen: (i: Item) => void }) {
  const { signedIn } = useAuth()
  const { data, error } = useFeed(fetcher, signedIn)
  if (error) return <div className="msg">Failed to load: {error}</div>
  if (!data) return <div className="msg">Loading…</div>
  return <Grid items={data} empty={empty} onOpen={onOpen} />
}

function LocalHistory({ onOpen }: { onOpen: (i: Item) => void }) {
  const items = Object.values(useProgress())
    .sort((a, b) => b.ts - a.ts)
    .map((h) => h.item)
  return <Grid items={items} empty="No watch history yet." onOpen={onOpen} />
}

export function History({ onOpen }: { onOpen: (i: Item) => void }) {
  if (!useAuth().signedIn) return <LocalHistory onOpen={onOpen} />
  return <FeedGrid fetcher={accountHistory} empty="No watch history yet." onOpen={onOpen} />
}

export function Subscriptions({ onOpen }: { onOpen: (i: Item) => void }) {
  if (!useAuth().signedIn) return <SignInNotice what="subscriptions" />
  return <FeedGrid fetcher={subscriptionsFeed} empty="No new videos from your subscriptions." onOpen={onOpen} />
}

// Local "Watch later" playlist until account playlists arrive with login.
export function Playlists({ onOpen }: { onOpen: (i: Item) => void }) {
  return <Grid items={useWatchlist()} empty="Nothing saved yet. Use the bookmark button on Home." onOpen={onOpen} />
}

export function SignInNotice({ what }: { what: string }) {
  return <div className="msg top">Sign in to see your {what}. Press the account button to sign in.</div>
}
