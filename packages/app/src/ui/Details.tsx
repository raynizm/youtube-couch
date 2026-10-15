import { useEffect, useRef, useState } from 'react'
import { isBack } from '../nav/useSpatialNav'
import { toggleBell, toggleSub, toggleWatchlist, useProgress, useSubs, useWatched, useWatchlist } from '../store'
import { getChannelVideos, getDetails } from '../yt/client'
import type { Details as DetailsData, Item } from '../yt/types'
import { ArrowLeft, BellIcon, BookmarkIcon, CheckCircleIcon, ClockIcon, EyeIcon, HomeIcon, PlayIcon, SearchIcon, UserCheckIcon, UserPlusIcon } from './icons'
import { CoverPreview } from './Hero'
import type { Tab } from './Nav'
import { RowView } from './RowView'
import { useRowSnap } from './useRowSnap'

type Props = { item: Item; active: boolean; onPlay: (i: Item) => void; onOpen: (i: Item) => void; onClose: () => void; onTab: (t: Tab) => void }

export function Details({ item, active, onPlay, onOpen, onClose, onTab }: Props) {
  const [data, setData] = useState<DetailsData>()
  const [more, setMore] = useState<Item[]>([])
  const rows = useRef<HTMLDivElement>(null)
  const playBtn = useRef<HTMLButtonElement>(null)
  const watchlist = useWatchlist()
  const progress = useProgress()[item.id]
  const watched = useWatched()[item.id]
  const status = progress ? 'progress' : watched ? 'watched' : 'new'
  const label = { progress: `In progress · ${Math.round((progress?.pos ?? 0) / (progress?.dur || 1) * 100)}%`, watched: 'Watched', new: 'Not watched' }[status]
  const sub = useSubs()[data?.channel?.id ?? '']
  const saved = watchlist.some((i) => i.id === item.id)

  useEffect(() => {
    let alive = true
    setData(undefined)
    setMore([])
    rows.current?.scrollTo({ top: 0 })
    getDetails(item.id).then(
      (d) => {
        if (!alive) return
        setData(d)
        if (d.channel) getChannelVideos(d.channel.id).then((v) => alive && setMore(v.filter((x) => x.id !== item.id)), () => {})
      },
      () => {},
    )
    return () => {
      alive = false
    }
  }, [item.id])

  useRowSnap(rows, !!data)

  useEffect(() => {
    if (active) playBtn.current?.focus()
  }, [active, item.id])

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => isBack(e) && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onClose])

  const title = data?.title || item.title
  const channel = data?.channel
  const meta = data?.meta || [item.author, ...(item.meta ?? '').split(' · ')].filter(Boolean).join(' · ')
  const play = { ...item, title }

  return (
    <div className="details">
      <div className="details-backdrop">
        <img
          className="hero-img"
          src={`https://i.ytimg.com/vi/${item.id}/maxresdefault.jpg`}
          onError={(e) => ((e.target as HTMLImageElement).src = item.thumb)}
          alt=""
        />
        {active && <CoverPreview key={item.id} videoId={item.id} leaving={false} />}
        <div className="hero-shade" />
      </div>
      <div className="details-hero">
        <div className="details-topbar">
          <button className="player-back" data-focusable aria-label="Back" onClick={onClose}>
            <ArrowLeft /> Back
          </button>
          <button className="round" data-focusable aria-label="Home" onClick={() => onTab('home')}>
            <HomeIcon />
          </button>
          <button className="round" data-focusable aria-label="Search" onClick={() => onTab('search')}>
            <SearchIcon />
          </button>
        </div>
        <div className="details-mid">
          <img className="details-thumb" src={item.thumb} alt="" />
          <div className="details-text">
            <h1>{title}</h1>
            <div className="hero-actions">
              <button ref={playBtn} className="btn icon" data-focusable aria-label="Play" onClick={() => onPlay(play)}>
                <PlayIcon />
              </button>
              <button className="btn icon" data-focusable aria-label="Watchlist" onClick={() => toggleWatchlist(play)}>
                <BookmarkIcon filled={saved} />
              </button>
              {channel && (
                <>
                  <button
                    className="btn icon"
                    data-focusable
                    aria-label={sub ? 'Subscribed' : 'Subscribe'}
                    aria-pressed={!!sub}
                    onClick={() => toggleSub(channel.id, { name: channel.name, avatar: channel.avatar })}
                  >
                    {sub ? <UserCheckIcon /> : <UserPlusIcon />}
                  </button>
                  <button
                    className="btn icon"
                    data-focusable
                    aria-label={sub?.bell ? 'Notifications on' : 'Notifications off'}
                    aria-pressed={!!sub?.bell}
                    onClick={() => toggleBell(channel.id, { name: channel.name, avatar: channel.avatar })}
                  >
                    <BellIcon filled={!!sub?.bell} />
                  </button>
                </>
              )}
              <span className={`watch-icon ${status}`} role="img" aria-label={label} title={label}>
                {status === 'watched' ? <CheckCircleIcon /> : status === 'progress' ? <ClockIcon /> : <EyeIcon />}
              </span>
              {channel && (
                <div className="details-channel">
                  {meta && <span className="details-meta">{meta}</span>}
                  {channel.avatar ? <img src={channel.avatar} alt="" /> : <span className="avatar-fallback">{channel.name.slice(0, 1)}</span>}
                  <div>
                    <div className="details-channel-name">{channel.name}</div>
                    {channel.subs && <div className="details-channel-subs">{channel.subs}</div>}
                  </div>
                </div>
              )}
              {!channel && meta && <span className="details-meta">{meta}</span>}
            </div>
            {data?.description && (
              <div
                className="details-desc"
                tabIndex={0}
                data-focusable
                onKeyDown={(e) => {
                  // Scroll the text with Up/Down while it can still move; otherwise let D-pad navigation take over.
                  const el = e.currentTarget
                  const dy = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
                  if (!dy) return
                  const room = dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0
                  if (!room) return
                  e.stopPropagation()
                  e.preventDefault()
                  el.scrollBy({ top: dy * 72, behavior: 'smooth' })
                }}
              >
                {data.description}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="details-rows" ref={rows}>
        {!data && <div className="msg">Loading…</div>}
        {channel && more.length > 0 && (
          <RowView title={`More from ${channel.name}`} cards={more.map((i) => ({ item: i }))} onOpen={onOpen} />
        )}
        {data && data.related.length > 0 && <RowView title="Related" cards={data.related.map((i) => ({ item: i }))} onOpen={onOpen} />}
      </div>
    </div>
  )
}
