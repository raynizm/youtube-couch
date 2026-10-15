import { useEffect, type RefObject } from 'react'

const DURATION_MS = 650
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * Vertical scrolling that moves one row at a time with an ease-in/ease-out animation.
 * Wheel steps to the next or previous row, and focusing a card brings its row to the top.
 */
export function useRowSnap(ref: RefObject<HTMLElement | null>, ready: boolean) {
  useEffect(() => {
    const box = ref.current
    if (!box || !ready) return
    let raf = 0
    let target = box.scrollTop
    let busy = false

    const rowTops = () => Array.from(box.querySelectorAll<HTMLElement>('.row')).map((r) => r.offsetTop)
    const maxTop = () => box.scrollHeight - box.clientHeight

    const animateTo = (to: number) => {
      to = Math.max(0, Math.min(to, maxTop()))
      if (Math.abs(to - target) < 1 && busy) return
      cancelAnimationFrame(raf)
      target = to
      const from = box.scrollTop
      if (Math.abs(to - from) < 1) return
      const start = performance.now()
      busy = true
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION_MS)
        box.scrollTop = from + (to - from) * easeInOutCubic(t)
        if (t < 1) raf = requestAnimationFrame(tick)
        else busy = false
      }
      raf = requestAnimationFrame(tick)
    }

    const onWheel = (e: WheelEvent) => {
      if (!e.deltaY || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
      e.preventDefault()
      if (busy) return // swallow trackpad inertia so one gesture moves one row
      const tops = rowTops()
      const cur = tops.reduce((best, t, i) => (Math.abs(t - box.scrollTop) < Math.abs(tops[best] - box.scrollTop) ? i : best), 0)
      const next = Math.max(0, Math.min(tops.length - 1, cur + (e.deltaY > 0 ? 1 : -1)))
      animateTo(tops[next])
    }

    const onFocus = (e: FocusEvent) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('.row')
      if (row) animateTo(row.offsetTop)
    }

    box.addEventListener('wheel', onWheel, { passive: false })
    box.addEventListener('focusin', onFocus)
    return () => {
      cancelAnimationFrame(raf)
      box.removeEventListener('wheel', onWheel)
      box.removeEventListener('focusin', onFocus)
    }
  }, [ref, ready])
}
