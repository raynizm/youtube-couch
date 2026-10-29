import { fetchRange } from '../yt/client'
import type { AdaptiveStream, MediaTrack } from '../yt/types'
import { type Fragment, fragmentAt, parseSidx } from './sidx'

/** Seconds of media kept buffered ahead of the playhead, and behind it before old data is dropped. */
const AHEAD_S = 30
const BEHIND_S = 30
const RETRIES = 2
/** A playhead this close to a buffered range counts as inside it. */
const EDGE_S = 0.1

type Loader = {
  track: MediaTrack
  sb: SourceBuffer
  frags: Fragment[]
  /** The fragment to fetch next. */
  next: number
  /** Bumped on a seek out of the buffer, so answers to requests made before it are dropped. */
  gen: number
  ctl: AbortController
  busy: boolean
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Plays separate video and audio files (DASH fragmented MP4) in a <video> through MediaSource. Each file's `sidx` index says
 * where its fragments are; fragments are fetched one by one, ahead of the playhead, and a seek out of the buffer restarts from
 * the fragment holding the new position. `onFail` is called once if playback cannot continue. Returns a cleanup function.
 */
export function attachAdaptive(video: HTMLVideoElement, stream: AdaptiveStream, onFail: (e: Error) => void): () => void {
  const ms = new MediaSource()
  const objectUrl = URL.createObjectURL(ms)
  let dead = false
  let loaders: Loader[] = []

  const fail = (e: unknown) => {
    if (dead) return
    dead = true
    onFail(e instanceof Error ? e : new Error('Playback failed'))
  }

  /** Seconds buffered from the playhead on, 0 when it is outside the buffer. */
  const bufferedAhead = (l: Loader) => {
    const t = video.currentTime
    for (let i = 0; i < l.sb.buffered.length; i++) {
      if (l.sb.buffered.start(i) - EDGE_S <= t && t <= l.sb.buffered.end(i) + EDGE_S) return Math.max(0, l.sb.buffered.end(i) - t)
    }
    return 0
  }
  const isBuffered = (l: Loader, t: number) => {
    for (let i = 0; i < l.sb.buffered.length; i++) if (l.sb.buffered.start(i) - EDGE_S <= t && t <= l.sb.buffered.end(i) + EDGE_S) return true
    return false
  }

  const get = async (l: Loader, start: number, end: number): Promise<ArrayBuffer> => {
    for (let attempt = 0; ; attempt++) {
      const signal = l.ctl.signal
      try {
        return await fetchRange(l.track.url, start, end, signal)
      } catch (e) {
        if (signal.aborted || attempt >= RETRIES) throw e
        await delay(500 * (attempt + 1))
      }
    }
  }

  /** Runs one operation on the buffer and waits for it to finish. */
  const operate = async (l: Loader, op: () => void) => {
    while (l.sb.updating) await new Promise((r) => l.sb.addEventListener('updateend', r, { once: true }))
    await new Promise<void>((resolve, reject) => {
      const done = () => (l.sb.removeEventListener('error', err), resolve())
      const err = () => (l.sb.removeEventListener('updateend', done), reject(new Error('Buffer error')))
      l.sb.addEventListener('updateend', done, { once: true })
      l.sb.addEventListener('error', err, { once: true })
      try {
        op()
      } catch (e) {
        l.sb.removeEventListener('updateend', done)
        l.sb.removeEventListener('error', err)
        reject(e)
      }
    })
  }

  const evict = (l: Loader, before: number) => {
    if (l.sb.buffered.length && before > l.sb.buffered.start(0)) return operate(l, () => l.sb.remove(0, before))
  }

  const append = async (l: Loader, data: ArrayBuffer) => {
    // Drop what is well behind the playhead before it fills the buffer.
    await evict(l, video.currentTime - BEHIND_S)
    try {
      await operate(l, () => l.sb.appendBuffer(data))
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'QuotaExceededError')) throw e
      await evict(l, video.currentTime - 5)
      await operate(l, () => l.sb.appendBuffer(data))
    }
  }

  const pump = async (l: Loader) => {
    if (l.busy || dead) return
    l.busy = true
    try {
      while (!dead && l.next < l.frags.length && bufferedAhead(l) < AHEAD_S) {
        const gen = l.gen
        const f = l.frags[l.next]
        let data: ArrayBuffer
        try {
          data = await get(l, f.offset, f.offset + f.size - 1)
        } catch (e) {
          if (gen !== l.gen) continue
          throw e
        }
        if (dead) return
        if (gen !== l.gen) continue
        await append(l, data)
        if (gen === l.gen) l.next++
      }
      // Everything is in: close the stream so the player knows where the end is.
      if (!dead && loaders.every((x) => x.next >= x.frags.length && !x.sb.updating) && ms.readyState === 'open') ms.endOfStream()
    } catch (e) {
      fail(e)
    } finally {
      l.busy = false
    }
  }

  const pumpAll = () => loaders.forEach((l) => void pump(l))

  const onSeeking = () => {
    const t = video.currentTime
    for (const l of loaders) {
      if (isBuffered(l, t)) continue
      l.gen++
      l.ctl.abort()
      l.ctl = new AbortController()
      l.next = fragmentAt(l.frags, t)
    }
    pumpAll()
  }

  /** Adds a buffer for the track, reads its init segment and index, and appends the init segment. */
  const open = async (track: MediaTrack): Promise<Loader> => {
    const l: Loader = { track, sb: ms.addSourceBuffer(track.mime), frags: [], next: 0, gen: 0, ctl: new AbortController(), busy: false }
    const head = await get(l, 0, track.index.end)
    l.frags = parseSidx(head.slice(track.index.start, track.index.end + 1), track.index.end + 1)
    await operate(l, () => l.sb.appendBuffer(head.slice(0, track.init.end + 1)))
    return l
  }

  ms.addEventListener(
    'sourceopen',
    () => {
      ms.duration = stream.duration
      Promise.all([open(stream.video), open(stream.audio)]).then((opened) => {
        if (dead) return
        loaders = opened
        video.addEventListener('seeking', onSeeking)
        video.addEventListener('timeupdate', pumpAll)
        video.addEventListener('waiting', pumpAll)
        pumpAll()
      }, fail)
    },
    { once: true },
  )

  video.src = objectUrl
  video.play().catch(() => {})

  return () => {
    dead = true
    video.removeEventListener('seeking', onSeeking)
    video.removeEventListener('timeupdate', pumpAll)
    video.removeEventListener('waiting', pumpAll)
    loaders.forEach((l) => l.ctl.abort())
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(objectUrl)
  }
}
