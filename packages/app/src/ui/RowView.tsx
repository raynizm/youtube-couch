import { memo, useEffect, useLayoutEffect, useRef } from 'react'
import type { Item } from '../yt/types'
import { Card } from './Card'
import { ChevronLeft, ChevronRight } from './icons'

export type CardInfo = { item: Item; progress?: number; subtitle?: string }

type RowProps = {
  title: string
  /** Channel avatar shown before the title; an empty string shows the title's first letter instead. */
  avatar?: string
  cards: CardInfo[]
  onOpen: (i: Item) => void
  onPreview?: (i: Item) => void
  /** Mouse-only previous/next buttons beside the title; Home leaves them out. */
  arrows?: boolean
  /** Endless row: scrolling past the last card carries on with the first. */
  loop?: boolean
  /** Cards show only duration and upload-date labels under the thumbnail, no title. */
  labels?: boolean
  /** With labels: durations read "4 min 17 sec". */
  spoken?: boolean
}

// Looping needs a set of cards wider than the screen (8 cards at 16rem each is 128rem, a screen is 120rem).
const MIN_LOOP_CARDS = 8
const SETTLE_MS = 150

export const RowView = memo(function RowView({ title, avatar, cards, onOpen, onPreview, arrows = true, loop = false, labels = false, spoken = false }: RowProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const n = cards.length
  const looping = loop && n >= MIN_LOOP_CARDS
  const by = (dir: number) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: 'smooth' })

  // A looping row renders its cards three times and always rests in the middle copy. Whenever it
  // settles in an outer copy it jumps one copy's width back, and focus moves to the same card there:
  // the picture is identical, so the jump is invisible.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!looping || !el) return
    const first = el.children[n] as HTMLElement
    const r = first.getBoundingClientRect()
    const s = el.getBoundingClientRect()
    jump(el, el.scrollLeft + r.left - s.left - (s.width - r.width) / 2)
  }, [looping, n])

  useEffect(() => {
    const el = scroller.current
    if (!looping || !el) return
    let timer: ReturnType<typeof setTimeout>
    const recentre = () => {
      const first = el.children[0].getBoundingClientRect()
      const second = el.children[n].getBoundingClientRect()
      const set = second.left - first.left
      const s = el.getBoundingClientRect()
      const mid = s.left + s.width / 2 - first.left
      const delta = mid >= 2 * set ? -set : mid < set ? set : 0
      if (!delta) return
      const active = document.activeElement as HTMLElement | null
      const idx = active ? Array.prototype.indexOf.call(el.children, active) : -1
      jump(el, el.scrollLeft + delta)
      if (idx >= 0) (el.children[(idx % n) + n] as HTMLElement).focus({ preventScroll: true })
    }
    const onScroll = () => {
      clearTimeout(timer)
      timer = setTimeout(recentre, SETTLE_MS)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(timer)
      el.removeEventListener('scroll', onScroll)
    }
  }, [looping, n])

  const copies = looping ? [0, 1, 2] : [0]
  return (
    <section className="row">
      <div className="row-head">
        <h2>
          {avatar !== undefined && (avatar ? <img className="row-avatar" src={avatar} alt="" /> : <span className="row-avatar">{title.slice(0, 1)}</span>)}
          {title}
        </h2>
        {arrows && (
          <div className="row-arrows">
            <button className="icon-btn" aria-label="Previous" tabIndex={-1} onClick={() => by(-1)}>
              <ChevronLeft />
            </button>
            <button className="icon-btn" aria-label="Next" tabIndex={-1} onClick={() => by(1)}>
              <ChevronRight />
            </button>
          </div>
        )}
      </div>
      <div
        className={looping ? 'row-items scrolled' : 'row-items'}
        ref={scroller}
        onScroll={looping ? undefined : (e) => e.currentTarget.classList.toggle('scrolled', e.currentTarget.scrollLeft > 8)}
      >
        {copies.flatMap((copy) => cards.map((c) => <Card key={`${copy}:${c.item.id}`} {...c} labels={labels} spoken={spoken} onOpen={onOpen} onPreview={onPreview} />))}
      </div>
    </section>
  )
})

/** Moves the scroll position instantly, even though rows normally scroll smoothly. */
function jump(el: HTMLElement, left: number) {
  const prev = el.style.scrollBehavior
  el.style.scrollBehavior = 'auto'
  el.scrollLeft = left
  el.style.scrollBehavior = prev
}
