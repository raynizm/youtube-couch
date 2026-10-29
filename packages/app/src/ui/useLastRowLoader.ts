import { useState } from 'react'
import { MIN_SKELETON_MS, wait } from './useFeed'

/** Focusing a card in the last row loads this many more rows. */
export const MORE_ROWS = 2

/** Number of columns the card grid currently has, and the index of `card` among its cards. */
export function gridPosition(root: HTMLElement, card: Element | null): { columns: number; index: number } | undefined {
  const grid = root.querySelector<HTMLElement>('.grid:not(.skel-ghost)')
  if (!grid || !card) return undefined
  return { columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length, index: Array.prototype.indexOf.call(grid.children, card) }
}

/**
 * Focus handler for a container holding one card grid: when a card in the last of `length` cards' rows takes focus,
 * `load` is called for MORE_ROWS rows' worth of cards. `loadingMore` is that card count while it runs (at least MIN_SKELETON_MS),
 * for a skeleton to fill the space meanwhile.
 */
export function useLastRowLoader(length: number, canLoad: () => boolean, load: (count: number) => Promise<void>) {
  const [loadingMore, setLoadingMore] = useState(0)
  const onFocus = (e: React.FocusEvent<HTMLElement>) => {
    if (loadingMore || !length || !canLoad()) return
    const pos = gridPosition(e.currentTarget, (e.target as HTMLElement).closest('.card'))
    if (!pos || pos.index < length - pos.columns) return
    const count = pos.columns * MORE_ROWS
    setLoadingMore(count)
    Promise.all([load(count), wait(MIN_SKELETON_MS)])
      .catch(() => undefined)
      .finally(() => setLoadingMore(0))
  }
  return { loadingMore, onFocus }
}
