import { useEffect, useRef, useState } from 'react'
import { DEFAULT_CATEGORIES, fetchSegments, findSkip, type Segment } from '../sponsorblock/skip'
import { getAdaptiveStream, getCaptions, getStream } from '../yt/client'
import { getProgress, saveProgress } from '../store'
import type { AdaptiveStream, Caption, Item, Stream } from '../yt/types'
import { isBack } from '../nav/useSpatialNav'
import { ArrowLeft, Back10Icon, Fwd10Icon, PauseIcon, PlayIcon, SubtitlesIcon } from '../ui/icons'
import { attachAdaptive } from './adaptive'

const HIDE_MS = 3500

const fmt = (t: number) => {
  if (!isFinite(t)) return '0:00'
  const s = Math.floor(t)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

type Props = { item: Item; onClose: () => void }

export function Player({ item, onClose }: Props) {
  const videoId = item.id
  const video = useRef<HTMLVideoElement>(null)
  const segments = useRef<Segment[]>([])
  // The separate video and audio tracks give the best picture; the combined stream is the fallback when they cannot be used.
  const [adaptive, setAdaptive] = useState<AdaptiveStream>()
  const [stream, setStream] = useState<Stream>()
  const [error, setError] = useState<string>()
  const [toast, setToast] = useState<string>()
  const backBtn = useRef<HTMLButtonElement>(null)
  const [captions, setCaptions] = useState<Caption[]>([])
  const [subIdx, setSubIdx] = useState(-1)
  const [menu, setMenu] = useState<'subs'>()
  const [paused, setPaused] = useState(false)
  const [time, setTime] = useState({ cur: 0, dur: 0 })
  const [chrome, setChrome] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const ready = !!(adaptive || stream)
  const title = adaptive?.title ?? stream?.title ?? ''

  // Show the back button on any input, hide it again after a quiet moment.
  const wake = () => {
    setChrome(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setChrome(false), HIDE_MS)
  }
  useEffect(() => {
    wake()
    return () => clearTimeout(hideTimer.current)
  }, [])

  useEffect(() => {
    let alive = true
    const combined = () => getStream(videoId).then((s) => alive && setStream(s), (e) => alive && setError(String(e.message ?? e)))
    getAdaptiveStream(videoId).then((a) => (a ? alive && setAdaptive(a) : combined()), () => combined())
    fetchSegments(videoId).then((s) => (segments.current = s))
    getCaptions(videoId).then((c) => alive && setCaptions(c))
    return () => {
      alive = false
    }
  }, [videoId])

  // Falls back to the combined stream, which plays through the element's own src.
  const fallBack = () => {
    setAdaptive(undefined)
    getStream(videoId).then(setStream, (e) => setError(String(e.message ?? e)))
  }
  useEffect(() => {
    const v = video.current
    if (adaptive && v) return attachAdaptive(v, adaptive, fallBack)
  }, [adaptive])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = video.current
      wake()
      if (isBack(e)) return onClose()
      // D-pad: Up reaches the back button, Enter on it activates it.
      if (e.key === 'ArrowUp') return void backBtn.current?.focus()
      if (document.activeElement === backBtn.current) {
        if (e.key === 'ArrowDown') backBtn.current?.blur()
        return
      }
      if (!v) return
      if (e.key === 'ArrowRight') v.currentTime += 10
      else if (e.key === 'ArrowLeft') v.currentTime -= 10
      else if (e.key === 'Enter' || e.key === ' ') v.paused ? v.play() : v.pause()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const lastSave = useRef(0)
  const onLoaded = () => {
    const p = getProgress(videoId)
    if (video.current && p && p.pos > 5) video.current.currentTime = p.pos
  }
  const onTimeUpdate = () => {
    const v = video.current
    if (!v) return
    setTime({ cur: v.currentTime, dur: v.duration })
    if (Date.now() - lastSave.current > 5000 && v.currentTime > 1) {
      lastSave.current = Date.now()
      saveProgress({ ...item, title: item.title || title }, v.currentTime, v.duration)
    }
    const hit = findSkip(segments.current, v.currentTime, DEFAULT_CATEGORIES)
    if (hit) {
      v.currentTime = hit.segment[1]
      setToast(`Skipped ${hit.category}`)
      setTimeout(() => setToast(undefined), 2500)
    }
  }

  const toggle = () => {
    const v = video.current
    if (v) v.paused ? v.play() : v.pause()
  }
  const skip = (d: number) => {
    if (video.current) video.current.currentTime += d
  }
  const pickSub = (i: number) => {
    setSubIdx(i)
    setMenu(undefined)
    const tracks = video.current?.textTracks
    if (tracks) for (let k = 0; k < tracks.length; k++) tracks[k].mode = k === i ? 'showing' : 'hidden'
  }
  const toggleMenu = (m: 'subs') => setMenu((cur) => (cur === m ? undefined : m))

  return (
    <div className="player" onMouseMove={wake}>
      <button ref={backBtn} className={`player-back${chrome || error || !ready ? '' : ' hidden'}`} aria-label="Back" onClick={onClose}>
        <ArrowLeft /> Back
      </button>
      {error && <div className="player-msg">Cannot play: {error}</div>}
      {!error && !ready && <div className="player-msg">Loading…</div>}
      {ready && (
        <>
          <video ref={video} src={stream?.url} autoPlay onClick={toggle} onPlay={() => setPaused(false)} onPause={() => setPaused(true)} onEnded={() => saveProgress({ ...item, title: item.title || title }, 1, 1)} onLoadedMetadata={onLoaded} onTimeUpdate={onTimeUpdate} onError={() => (adaptive ? fallBack() : setError('Playback failed'))}>
            {captions.map((c) => (
              <track key={c.lang + c.label} kind="subtitles" label={c.label} srcLang={c.lang} src={c.url} />
            ))}
          </video>
          <div className={`player-title${chrome ? '' : ' hidden'}`}>{title}</div>
          <div className={`player-controls${chrome ? '' : ' hidden'}`}>
            <input
              className="player-seek"
              type="range"
              min={0}
              max={time.dur || 0}
              step={1}
              value={time.cur}
              aria-label="Seek"
              style={{ '--pct': `${time.dur ? (time.cur / time.dur) * 100 : 0}%` } as React.CSSProperties}
              onChange={(e) => {
                if (video.current) video.current.currentTime = Number(e.target.value)
              }}
            />
            <div className="player-buttons">
              <button aria-label="Back 10 seconds" onClick={() => skip(-10)}><Back10Icon /></button>
              <button aria-label={paused ? 'Play' : 'Pause'} onClick={toggle}>{paused ? <PlayIcon /> : <PauseIcon />}</button>
              <button aria-label="Forward 10 seconds" onClick={() => skip(10)}><Fwd10Icon /></button>
              <span className="player-time">{fmt(time.cur)} / {fmt(time.dur)}</span>
              <span className="grow" />
              <div className="player-menu-wrap">
                {menu === 'subs' && (
                  <div className="player-menu">
                    <button className={subIdx < 0 ? 'on' : ''} onClick={() => pickSub(-1)}>Off</button>
                    {captions.map((c, i) => (
                      <button key={c.lang + c.label} className={subIdx === i ? 'on' : ''} onClick={() => pickSub(i)}>{c.label}</button>
                    ))}
                    {!captions.length && <span className="player-menu-empty">No subtitles</span>}
                  </div>
                )}
                <button aria-label="Subtitles" onClick={() => toggleMenu('subs')}><SubtitlesIcon /></button>
              </div>
            </div>
          </div>
        </>
      )}
      {toast && <div className="player-toast">{toast}</div>}
    </div>
  )
}
