import { useCallback, useEffect, useState } from 'react'
import { isBack } from '../nav/useSpatialNav'
import { useProgress, useWatchlist } from '../store'
import { useAuth } from '../yt/auth'
import { accountHistory, accountPlaylists, getPlaylistVideos, subscriptionsFeed } from '../yt/client'
import type { Item } from '../yt/types'
import { Card } from './Card'
import { ArrowLeft } from './icons'
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

const WATCHLIST_EMPTY = 'Nothing saved yet. Use the bookmark button on Home.'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="row">
      <div className="row-head">
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  )
}

function CardGrid({ items, onOpen }: { items: Item[]; onOpen: (i: Item) => void }) {
  return (
    <div className="grid">
      {items.map((i) => (
        <Card key={i.id} item={i} onOpen={onOpen} />
      ))}
    </div>
  )
}

// Videos of one account playlist, with a Back button. Back key also returns, unless another layer (details, player, sign-in) is on top.
function PlaylistVideos({ playlist, active, onBack, onOpen }: { playlist: Item; active: boolean; onBack: () => void; onOpen: (i: Item) => void }) {
  const fetcher = useCallback(() => getPlaylistVideos(playlist.id), [playlist.id])
  const { data, error } = useFeed(fetcher, playlist.id)

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => isBack(e) && onBack()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onBack])

  return (
    <div className="screen padded top">
      <button className="player-back" data-focusable aria-label="Back" onClick={onBack}>
        <ArrowLeft /> Back
      </button>
      <h2>{playlist.title}</h2>
      {error ? (
        <div className="msg">Failed to load: {error}</div>
      ) : !data ? (
        <div className="msg">Loading…</div>
      ) : data.length === 0 ? (
        <div className="msg">This playlist is empty.</div>
      ) : (
        <CardGrid items={data} onOpen={onOpen} />
      )}
    </div>
  )
}

function SignedInPlaylists({ active, onOpen }: { active: boolean; onOpen: (i: Item) => void }) {
  const watchlist = useWatchlist()
  const { data, error } = useFeed(accountPlaylists, true)
  const [opened, setOpened] = useState<Item>()
  const back = useCallback(() => setOpened(undefined), [])

  if (opened) return <PlaylistVideos playlist={opened} active={active} onBack={back} onOpen={onOpen} />
  return (
    <div className="screen padded top">
      <Section title="Watch later">
        {watchlist.length === 0 && <div className="msg">{WATCHLIST_EMPTY}</div>}
        <CardGrid items={watchlist} onOpen={onOpen} />
      </Section>
      <Section title="Your playlists">
        {error ? (
          <div className="msg">Failed to load: {error}</div>
        ) : !data ? (
          <div className="msg">Loading…</div>
        ) : data.length === 0 ? (
          <div className="msg">No playlists on your account yet.</div>
        ) : (
          <CardGrid items={data} onOpen={setOpened} />
        )}
      </Section>
    </div>
  )
}

// Signed out: the local "Watch later" list. Signed in: that list plus account playlists, which open in place.
// `active` is false while an overlay (details, player, sign-in) owns the Back key.
export function Playlists({ onOpen, active = true }: { onOpen: (i: Item) => void; active?: boolean }) {
  if (!useAuth().signedIn) return <LocalPlaylists onOpen={onOpen} />
  return <SignedInPlaylists active={active} onOpen={onOpen} />
}

function LocalPlaylists({ onOpen }: { onOpen: (i: Item) => void }) {
  return <Grid items={useWatchlist()} empty={WATCHLIST_EMPTY} onOpen={onOpen} />
}

export function SignInNotice({ what }: { what: string }) {
  return <div className="msg top">Sign in to see your {what}. Press the account button to sign in.</div>
}
