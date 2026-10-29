import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isBack } from '../nav/useSpatialNav'
import { toggleWatchlist, useWatchlist } from '../store'
import { getChannelVideos, getDetails } from '../yt/client'
import { newestFirst } from '../yt/age'
import type { Details as DetailsData, Item } from '../yt/types'
import { ArrowLeft, BookmarkIcon, HomeIcon, PlayIcon, SearchIcon } from './icons'
import { CoverPreview } from './Hero'
import { DURATION, MetaLabels } from './MetaLabels'
import type { Tab } from './Nav'
import { RowView } from './RowView'
import { Ink, RowsSkeleton } from './Skeleton'
import { useRowSnap } from './useRowSnap'

function Meta({ text }: { text: string }) {
  return (
    <span className="details-meta">
      <MetaLabels text={text} spoken />
    </span>
  )
}

// Same markup and classes as the loaded screen, with placeholders in place of the content, shown until the whole screen can appear at once.
function TextSkeleton({ title, author, meta }: { title: string; author: string; meta: string }) {
  return (
    <div className="details-text skel-ghost" aria-hidden>
      <h1>
        <Ink>{title}</Ink>
      </h1>
      <div className="hero-actions">
        <div className="skel skel-round" />
        <div className="skel skel-round" />
        <div className="details-channel">
          {meta && <Meta text={meta} />}
          <div className="skel skel-round" />
          <div className="details-channel-name">
            <Ink>{author}</Ink>
          </div>
        </div>
      </div>
      <div className="skel-desc">
        {[100, 96, 70, 0, 92, 100, 64, 0, 98, 88, 100, 60, 94, 100, 72].map((w, i) => (
          <div key={i} className="skel-row">
            {w > 0 && <div className="skel" style={{ width: `${w}%` }} />}
          </div>
        ))}
      </div>
    </div>
  )
}

type Props = { item: Item; active: boolean; onPlay: (i: Item) => void; onOpen: (i: Item) => void; onClose: () => void; onTab: (t: Tab) => void }

export function Details({ item, active, onPlay, onOpen, onClose, onTab }: Props) {
  const [data, setData] = useState<DetailsData>()
  const [more, setMore] = useState<Item[]>([])
  const [failed, setFailed] = useState(false)
  const [moreDone, setMoreDone] = useState(false)
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
    setMoreDone(false)
    rows.current?.scrollTo({ top: 0 })
    getDetails(item.id).then(
      (d) => {
        if (!alive) return
        setData(d)
        if (!d.channel) return setMoreDone(true)
        getChannelVideos(d.channel.id).then(
          (v) => alive && (setMore(newestFirst(v.filter((x) => x.id !== item.id))), setMoreDone(true)),
          () => alive && setMoreDone(true),
        )
      },
      () => alive && setFailed(true),
    )
    return () => {
      alive = false
    }
  }, [item.id])

  // Nothing but the skeleton shows until the details and the channel row are in; a failed request shows what we have.
  const ready = failed || (!!data && moreDone)

  useRowSnap(rows, ready)

  useEffect(() => {
    if (active && ready) playBtn.current?.focus()
  }, [active, item.id, ready])

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
      el.style.maxHeight = 'none'
      const line = parseFloat(getComputedStyle(el).lineHeight)
      const lines = Math.max(1, Math.floor(el.clientHeight / line))
      el.style.setProperty('-webkit-line-clamp', String(lines))
      // Cap the box at whole lines, or a sliver of the next line shows under the ellipsis.
      el.style.maxHeight = `${lines * line}px`
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    if (el.parentElement) ro.observe(el.parentElement)
    return () => ro.disconnect()
  }, [data?.description, title, ready])

  return (
    <div className="details" data-screen>
      <div className="details-backdrop" aria-hidden>
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
            {ready ? (
              <>
                <img src={item.thumb} alt="" />
                {active && <CoverPreview key={item.id} videoId={item.id} leaving={false} />}
              </>
            ) : (
              <div className="skel skel-thumb" aria-hidden />
            )}
          </div>
          {ready ? (
            <div className="details-text">
              <h1>{title}</h1>
              <div className="hero-actions">
                <button ref={playBtn} className="btn icon" data-focusable data-default aria-label="Play" onClick={() => onPlay(play)}>
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
          ) : (
            <TextSkeleton title={title} author={item.author ?? ''} meta={meta} />
          )}
        </div>
      </div>
      <div className="details-rows" ref={rows}>
        {!ready && <RowsSkeleton rows={[{ title: item.author ? `More from ${item.author}` : 'More from this channel', labels: true }, { title: 'Related videos', labels: false }]} />}
        {failed && <div className="msg">Could not load more about this video.</div>}
        {ready && channel && more.length > 0 && (
          <RowView title={`More from ${channel.name}`} cards={more.map((i) => ({ item: i }))} arrows={false} loop labels onOpen={onOpen} />
        )}
        {ready && data && data.related.length > 0 && <RowView title="Related videos" cards={data.related.map((i) => ({ item: i }))} arrows={false} loop onOpen={onOpen} />}
      </div>
    </div>
  )
}
