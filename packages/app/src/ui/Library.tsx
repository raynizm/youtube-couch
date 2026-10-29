import { useCallback, useEffect, useRef, useState } from 'react'
import { isBack } from '../nav/useSpatialNav'
import { useProgress } from '../store'
import { useAuth } from '../yt/auth'
import { accountHistory, accountPlaylists, HISTORY_SIZE, getPlaylistVideos, subscriptionRows } from '../yt/client'
import type { Item, Row } from '../yt/types'
import { Card } from './Card'
import { ArrowLeft, HomeIcon, SearchIcon } from './icons'
import type { Tab } from './Nav'
import { RowView } from './RowView'
import { GridSkeleton, RowsSkeleton } from './Skeleton'
import { MIN_SKELETON_MS, useFeed } from './useFeed'
import { useRowSnap } from './useRowSnap'

function Grid({ items, empty, onOpen }: { items: Item[]; empty: string; onOpen: (i: Item) => void }) {
  return (
    <div className="screen padded top lit-grid history">
      {items.length === 0 && <div className="msg">{empty}</div>}
      <CardGrid items={items} labels onOpen={onOpen} />
    </div>
  )
}

// Loading / error / grid for an account feed.
export function FeedGrid({ fetcher, empty, onOpen }: { fetcher: () => Promise<Item[]>; empty: string; onOpen: (i: Item) => void }) {
  const { feedKey } = useAuth()
  const { data, error } = useFeed(fetcher, feedKey, MIN_SKELETON_MS)
  if (error) return <div className="msg">Failed to load: {error}</div>
  if (!data)
    return (
      <div className="screen padded top lit-grid history">
        <GridSkeleton labels />
      </div>
    )
  return <Grid items={data} empty={empty} onOpen={onOpen} />
}

function LocalHistory({ onOpen }: { onOpen: (i: Item) => void }) {
  const items = Object.values(useProgress())
    .sort((a, b) => b.ts - a.ts)
    .slice(0, HISTORY_SIZE)
    .map((h) => h.item)
  return <Grid items={items} empty="No watch history yet." onOpen={onOpen} />
}

export function History({ onOpen }: { onOpen: (i: Item) => void }) {
  if (!useAuth().signedIn) return <LocalHistory onOpen={onOpen} />
  return <FeedGrid fetcher={accountHistory} empty="No watch history yet." onOpen={onOpen} />
}

// Same layout as the loaded screen, with placeholder rows until the channels are in.
function ChannelRowsSkeleton() {
  return (
    <div className="screen subs">
      <div className="details-rows subs-rows">
        <RowsSkeleton rows={['Channel name', 'Another channel', 'Third channel'].map((title) => ({ title, labels: true }))} spoken />
      </div>
    </div>
  )
}

function ChannelRows({ rows, onOpen }: { rows: Row[]; onOpen: (i: Item) => void }) {
  const box = useRef<HTMLDivElement>(null)
  useRowSnap(box, true)
  if (rows.length === 0) return <div className="msg center">No subscriptions yet.</div>
  return (
    <div className="screen subs">
      <div className="details-rows subs-rows" ref={box}>
        {rows.map((r) => (
          <RowView key={r.title} title={r.title} cards={r.items.map((item) => ({ item }))} arrows={false} loop labels spoken onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

export function Subscriptions({ onOpen }: { onOpen: (i: Item) => void }) {
  if (!useAuth().signedIn) return <SignInNotice what="subscriptions" />
  return <SubscriptionRows onOpen={onOpen} />
}

function SubscriptionRows({ onOpen }: { onOpen: (i: Item) => void }) {
  const { data, error } = useFeed(subscriptionRows, useAuth().feedKey, MIN_SKELETON_MS)
  if (error) return <div className="msg center">Failed to load: {error}</div>
  if (!data) return <ChannelRowsSkeleton />
  return <ChannelRows rows={data} onOpen={onOpen} />
}

function CardGrid({ items, labels, upload, onOpen }: { items: Item[]; labels?: boolean; upload?: boolean; onOpen: (i: Item) => void }) {
  return (
    <div className="grid">
      {items.map((i, n) => (
        <Card key={`${i.id}:${n}`} item={i} labels={labels} spoken={labels} channel={labels} upload={upload} onOpen={onOpen} />
      ))}
    </div>
  )
}

// Videos of one account playlist, with a Back button. Back key also returns, unless another layer (details, player, sign-in) is on top.
function PlaylistVideos({ playlist, active, onBack, onOpen, onTab }: { playlist: Item; active: boolean; onBack: () => void; onOpen: (i: Item) => void; onTab: (t: Tab) => void }) {
  const fetcher = useCallback(() => getPlaylistVideos(playlist.id), [playlist.id])
  const { data, error } = useFeed(fetcher, playlist.id)

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => isBack(e) && onBack()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onBack])

  return (
    <div className="screen padded top lit-grid history playlist-videos">
      <div className="details-topbar">
        <button className="player-back" data-focusable aria-label="Back" onClick={onBack}>
          <ArrowLeft /> Back
        </button>
        <button className="round" data-focusable aria-label="Home" onClick={() => onTab('home')}>
          <HomeIcon />
        </button>
        <button className="round" data-focusable aria-label="Search" onClick={() => onTab('search')}>
          <SearchIcon />
        </button>
      </div>
      <h2 className="playlist-title">{playlist.title}</h2>
      {error ? (
        <div className="msg">Failed to load: {error}</div>
      ) : !data ? (
        <div className="msg">Loading…</div>
      ) : data.length === 0 ? (
        <div className="msg">This playlist is empty.</div>
      ) : (
        <CardGrid items={data} labels upload={false} onOpen={onOpen} />
      )}
    </div>
  )
}

function SignedInPlaylists({ active, onOpen, onTab }: { active: boolean; onOpen: (i: Item) => void; onTab: (t: Tab) => void }) {
  const { data, error } = useFeed(accountPlaylists, useAuth().feedKey, MIN_SKELETON_MS)
  const [opened, setOpened] = useState<Item>()
  const back = useCallback(() => setOpened(undefined), [])

  if (opened) return <PlaylistVideos playlist={opened} active={active} onBack={back} onOpen={onOpen} onTab={onTab} />
  return (
    <div className="screen padded top lit-grid">
      {error ? (
        <div className="msg">Failed to load: {error}</div>
      ) : !data ? (
        <GridSkeleton stack />
      ) : data.length === 0 ? (
        <div className="msg">No playlists on your account yet.</div>
      ) : (
        <CardGrid items={data} onOpen={setOpened} />
      )}
    </div>
  )
}

// Account playlists, which open in place.
// `active` is false while an overlay (details, player, sign-in) owns the Back key.
export function Playlists({ onOpen, onTab, active = true }: { onOpen: (i: Item) => void; onTab: (t: Tab) => void; active?: boolean }) {
  if (!useAuth().signedIn) return <SignInNotice what="playlists" />
  return <SignedInPlaylists active={active} onOpen={onOpen} onTab={onTab} />
}

// Centred in the middle of the screen: a heading and a hint.
function Notice({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="signin-notice">
      <h2>{title}</h2>
      <p>{hint}</p>
    </div>
  )
}

export function SignInNotice({ what }: { what: string }) {
  return <Notice title={`Sign in to see your ${what}.`} hint="Press the account button to sign in." />
}
