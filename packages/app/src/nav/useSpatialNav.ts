import { useEffect } from 'react'
import { pickNext, type Dir } from './spatial'

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
      // An open modal owns the D-pad: only its own controls are reachable.
      const scope = document.querySelector('[data-modal]') ?? document
      const els = Array.from(scope.querySelectorAll<HTMLElement>('[data-focusable]'))
      if (!els.length) return
      e.preventDefault()
      if (!active || !els.includes(active)) return els[0].focus()
      const boxes = els.map((el, i) => {
        const r = el.getBoundingClientRect()
        return { id: String(i), x: r.left, y: r.top, w: r.width, h: r.height }
      })
      const from = boxes[els.indexOf(active)]
      const next = pickNext(from, boxes, dir)
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
          el.focus()
          el.scrollIntoView({ block: 'nearest', inline: 'center' })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
