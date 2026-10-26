import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isBack } from '../nav/useSpatialNav'
import { toggleWatchlist, useWatchlist } from '../store'
import { getChannelVideos, getDetails } from '../yt/client'
import type { Details as DetailsData, Item } from '../yt/types'
import { ArrowLeft, BookmarkIcon, ClockIcon, HomeIcon, PlayIcon, SearchIcon, UploadIcon } from './icons'
import { isViewCount } from './cardSub'
import { CoverPreview } from './Hero'
import type { Tab } from './Nav'
import { RowView } from './RowView'
import { useRowSnap } from './useRowSnap'

const DURATION = /^\d+(:\d{2}){1,2}$/

// "1.3M views · 8 hours ago": the upload date and duration become labels with an upload and a clock icon, the view count is left out; other parts stay plain text.
function Meta({ text }: { text: string }) {
  return (
    <span className="details-meta">
      {text.split(' · ').filter((m) => !isViewCount(m)).map((m) =>
        /\bago\b/i.test(m) ? (
          <span key={m} className="hero-label">
            <UploadIcon /> {m}
          </span>
        ) : DURATION.test(m) ? (
          <span key={m} className="hero-label">
            <ClockIcon /> {m}
          </span>
        ) : (
          <span key={m}>{m}</span>
        ),
      )}
    </span>
  )
}

type Props = { item: Item; active: boolean; onPlay: (i: Item) => void; onOpen: (i: Item) => void; onClose: () => void; onTab: (t: Tab) => void }

export function Details({ item, active, onPlay, onOpen, onClose, onTab }: Props) {
  const [data, setData] = useState<DetailsData>()
  const [more, setMore] = useState<Item[]>([])
  const [failed, setFailed] = useState(false)
  const rows = useRef<HTMLDivElement>(null)
  const desc = useRef<HTMLDivElement>(null)
  const playBtn = useRef<HTMLButtonElement>(null)
  const watchlist = useWatchlist()
  const saved = watchlist.some((i) => i.id === item.id)

  useEffect(() => {
    let alive = true
    setData(undefined)
    setFailed(false)
    setMore([])
    rows.current?.scrollTo({ top: 0 })
    getDetails(item.id).then(
      (d) => {
        if (!alive) return
        setData(d)
        if (d.channel) getChannelVideos(d.channel.id).then((v) => alive && setMore(v.filter((x) => x.id !== item.id)), () => {})
      },
      () => alive && setFailed(true),
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
  // The details request has no duration; it comes from the card that opened this page.
  const duration = (item.meta ?? '').split(' · ').find((m) => DURATION.test(m))
  const base = data?.meta || [item.author, ...(item.meta ?? '').split(' · ')].filter(Boolean).join(' · ')
  const meta = duration && !base.includes(duration) ? `${duration} · ${base}` : base
  const play = { ...item, title }

  // The description takes whatever height the title and buttons leave; clamp it to the lines that fit and end it with an ellipsis.
  useLayoutEffect(() => {
    const el = desc.current
    if (!el) return
    const fit = () => {
      const line = parseFloat(getComputedStyle(el).lineHeight)
      el.style.setProperty('-webkit-line-clamp', String(Math.max(1, Math.floor(el.clientHeight / line))))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [data?.description, title])

  return (
    <div className="details">
      <div className="details-backdrop">
        <img
          className="hero-img"
          src={`https://i.ytimg.com/vi/${item.id}/maxresdefault.jpg`}
          onError={(e) => ((e.target as HTMLImageElement).src = item.thumb)}
          alt=""
        />
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
          <div className="details-thumb">
            <img src={item.thumb} alt="" />
            {active && <CoverPreview key={item.id} videoId={item.id} leaving={false} />}
          </div>
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
                <div className="details-channel">
                  {meta && <Meta text={meta} />}
                  {channel.avatar ? <img src={channel.avatar} alt="" /> : <span className="avatar-fallback">{channel.name.slice(0, 1)}</span>}
                  <div className="details-channel-name">{channel.name}</div>
                </div>
              )}
              {!channel && meta && <Meta text={meta} />}
            </div>
            {data?.description && (
              <div className="details-desc" ref={desc}>
                {data.description}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="details-rows" ref={rows}>
        {!data && <div className="msg">{failed ? 'Could not load more about this video.' : 'Loading…'}</div>}
        {channel && more.length > 0 && (
          <RowView title={`More from ${channel.name}`} cards={more.map((i) => ({ item: i }))} arrows={false} onOpen={onOpen} />
        )}
        {data && data.related.length > 0 && <RowView title="Related" cards={data.related.map((i) => ({ item: i }))} arrows={false} onOpen={onOpen} />}
      </div>
    </div>
  )
}
