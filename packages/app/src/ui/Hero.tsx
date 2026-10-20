import { useEffect, useRef, useState } from 'react'
import { toggleWatchlist, useWatchlist } from '../store'
import { playClip } from '../player/mseClip'
import { getPreviewClip, type PreviewClip } from '../yt/client'
import type { Item } from '../yt/types'
import { isViewCount } from './cardSub'
import { ArrowLeft, ArrowRight, BookmarkIcon, ClockIcon, PlayIcon, UploadIcon } from './icons'

const ROTATE_MS = 15000
const PREVIEW_DELAY_MS = 3000
// The clip fades out this long before the cover moves on to the next video.
const FADE_OUT_LEAD_MS = 3000
const SLIDE_MS = 1400

type Dir = 'next' | 'prev'

// Some browsers do not focus a button on click; do it so the selected style always applies.
const select = (e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.focus()

// Muted, looping clip that fades in over the thumbnail once frames are ready.
export function CoverPreview({ videoId, leaving }: { videoId: string; leaving: boolean }) {
  const [clip, setClip] = useState<PreviewClip>()
  const [ready, setReady] = useState(false)
  const el = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    let alive = true
    const t = setTimeout(() => getPreviewClip(videoId).then((c) => alive && setClip(c)), PREVIEW_DELAY_MS)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [videoId])

  useEffect(() => {
    if (!clip || !el.current) return
    // After data arrives, wait two frames so the element has painted at opacity 0; otherwise there is nothing to fade from.
    let raf1 = 0
    let raf2 = 0
    const stop = playClip(el.current, clip, () => {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setReady(true))
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      stop()
    }
  }, [clip])

  if (!clip) return null
  return <video ref={el} className={`hero-preview${ready && !leaving ? ' on' : ''}`} muted playsInline />
}

function Slide({ item, cls, leaving, onPlay }: { item: Item; cls: string; leaving: boolean; onPlay: (i: Item) => void }) {
  const watchlist = useWatchlist()
  const saved = watchlist.some((i) => i.id === item.id)
  return (
    <div className={`slide ${cls}`}>
      <div className="hero-media">
      <img
        className="hero-img"
        src={`https://i.ytimg.com/vi/${item.id}/maxresdefault.jpg`}
        onError={(e) => ((e.target as HTMLImageElement).src = item.thumb)}
        alt=""
      />
      <CoverPreview videoId={item.id} leaving={leaving} />
      <div className="hero-shade" />
      </div>
      <div className="hero-info">
        <h1>{item.title}</h1>
        <div className="hero-meta">
          {[item.author, ...(item.meta ?? '').split(' · ')]
            .filter((m): m is string => !!m && !isViewCount(m))
            .map((m) =>
              m === item.author ? (
                <span key={m} className="hero-label channel">
                  {item.authorAvatar ? <img className="hero-label-avatar" src={item.authorAvatar} alt="" /> : <span className="hero-label-avatar">{m.slice(0, 1)}</span>} {m}
                </span>
              ) : /\bago\b/i.test(m) ? (
                <span key={m} className="hero-label">
                  <UploadIcon /> {m}
                </span>
              ) : /^\d+(:\d{2}){1,2}$/.test(m) ? (
                <span key={m} className="hero-label">
                  <ClockIcon /> {m}
                </span>
              ) : (
                <span key={m}>{m}</span>
              ),
            )}
        </div>
        <div className="hero-actions">
          <button className="btn primary icon" data-focusable aria-label="Watch now" onClick={() => onPlay(item)}>
            <PlayIcon />
          </button>
          <button className="btn icon" data-focusable aria-label="Watchlist" onClick={() => toggleWatchlist(item)}>
            <BookmarkIcon filled={saved} />
          </button>
        </div>
      </div>
    </div>
  )
}

export function Hero({ items, focused, onPlay }: { items: Item[]; focused?: Item; onPlay: (i: Item) => void }) {
  const count = items.length
  // `prev` stays mounted while the outgoing slide animates away.
  const [state, setState] = useState<{ cur?: Item; prev?: Item; dir: Dir }>({ dir: 'next' })
  const shown = state.cur ?? items[0]

  const show = (item: Item, dir: Dir) =>
    setState((s) => (s.cur?.id === item.id ? s : { cur: item, prev: s.cur ?? items[0], dir }))
  const step = (delta: number, dir: Dir) => {
    const i = Math.max(0, items.findIndex((x) => x.id === shown?.id))
    show(items[(i + delta + count) % count], dir)
  }

  // A video focused in the lists below takes over the cover.
  useEffect(() => {
    if (focused) show(focused, 'next')
  }, [focused?.id])

  // Per video: play the clip, fade it out shortly before the end, then slide to the next one.
  // Paused while a list item is focused: the cover is previewing that item.
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    setLeaving(false)
    if (count < 2 || focused) return
    const fade = setTimeout(() => setLeaving(true), ROTATE_MS - FADE_OUT_LEAD_MS)
    const next = setTimeout(() => step(1, 'next'), ROTATE_MS)
    return () => {
      clearTimeout(fade)
      clearTimeout(next)
    }
  }, [count, shown?.id, !!focused])

  useEffect(() => {
    if (!state.prev) return
    const t = setTimeout(() => setState((s) => ({ ...s, prev: undefined })), SLIDE_MS)
    return () => clearTimeout(t)
  }, [state.prev?.id, state.cur?.id])

  if (!shown) return null
  const animating = !!state.prev
  return (
    <section className="hero">
      {animating && <Slide key={`out-${state.prev!.id}`} item={state.prev!} cls={`out-${state.dir}`} leaving onPlay={onPlay} />}
      <Slide key={shown.id} item={shown} cls={animating ? `in-${state.dir}` : ''} leaving={leaving} onPlay={onPlay} />
      <button className="hero-arrow left" data-focusable aria-label="Previous" onMouseDown={select} onClick={() => step(-1, 'prev')}>
        <ArrowLeft />
      </button>
      <button className="hero-arrow right" data-focusable aria-label="Next" onMouseDown={select} onClick={() => step(1, 'next')}>
        <ArrowRight />
      </button>
    </section>
  )
}
