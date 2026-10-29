import { useEffect } from 'react'
import { pickNext, pickSameSide, type Dir } from './spatial'

const KEYS: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
// Tizen remote Back = 10009, Android TV Back arrives as Escape/Backspace in WebView.
export const isBack = (e: KeyboardEvent) => e.key === 'Escape' || e.key === 'Backspace' || e.keyCode === 10009

/** D-pad navigation across every `[data-focusable]` element in the document. */
export function useSpatialNav(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const dir = KEYS[e.key]
      if (!dir) return
      const active = document.activeElement as HTMLElement | null
      if (active?.tagName === 'INPUT' && (dir === 'left' || dir === 'right')) return
      // An open modal owns the D-pad, then a full-screen page (Details) covering the tabs: only its own controls are reachable.
      const modals = document.querySelectorAll('[data-modal]')
      const scope = modals[modals.length - 1] ?? document.querySelector('[data-screen]') ?? document
      const els = Array.from(scope.querySelectorAll<HTMLElement>('[data-focusable]'))
      if (!els.length) return
      e.preventDefault()
      if (!active || !els.includes(active)) return (scope.querySelector<HTMLElement>('[data-default]') ?? els[0]).focus()
      const boxes = els.map((el, i) => {
        const r = el.getBoundingClientRect()
        return { id: String(i), x: r.left, y: r.top, w: r.width, h: r.height }
      })
      const from = boxes[els.indexOf(active)]
      // Down from the nav bar lands on the cover's prev/next arrow on the same side before it reaches the rows.
      const arrowIds = active.closest('.nav') && dir === 'down' ? els.flatMap((el, i) => (el.classList.contains('hero-arrow') ? [String(i)] : [])) : []
      const next = arrowIds.length
        ? pickSameSide(from.x + from.w / 2, window.innerWidth / 2, boxes.filter((b) => arrowIds.includes(b.id)))
        : pickNext(from, boxes, dir)
      if (next !== undefined) {
        const el = els[Number(next)]
        const strip = el.closest<HTMLElement>('.row-items')
        if (strip) {
          // Home lists scroll vertically by row (see useRowSnap), so only center the card horizontally here.
          el.focus({ preventScroll: true })
          const r = el.getBoundingClientRect()
          const s = strip.getBoundingClientRect()
          strip.scrollTo({ left: strip.scrollLeft + r.left - s.left - (s.width - r.width) / 2, behavior: 'smooth' })
        } else {
          // One scroll only: the default focus scroll would fight the one below and look choppy.
          el.focus({ preventScroll: true })
          el.scrollIntoView({ block: 'nearest', inline: 'center' })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
