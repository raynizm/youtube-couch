import { useEffect, useState } from 'react'

type State<T> = { key: unknown; data?: T; error?: string }

/** Skeletons stay up at least this long, so a fast response does not flash them. */
export const MIN_SKELETON_MS = 1000

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** False until `ms` after mount or after `key` changed. */
export function useElapsed(ms: number, key: unknown): boolean {
  const [elapsed, setElapsed] = useState<{ key: unknown } | undefined>()
  useEffect(() => {
    const t = setTimeout(() => setElapsed({ key }), ms)
    return () => clearTimeout(t)
  }, [ms, key])
  return elapsed?.key === key
}

// Runs fetcher whenever key (or fetcher identity; pass a stable function) changes. Results arriving after key changed or unmount are dropped,
// and a result belonging to a previous key is never returned (data/error undefined = loading).
// `minMs` holds a successful result back until that long after the request started.
export function useFeed<T>(fetcher: () => Promise<T>, key: unknown, minMs = 0): { data?: T; error?: string } {
  const [state, setState] = useState<State<T>>({ key })

  useEffect(() => {
    let cancelled = false
    const minWait = wait(minMs)
    fetcher().then(
      (data) => minWait.then(() => !cancelled && setState({ key, data })),
      (e) => !cancelled && setState({ key, error: String(e?.message ?? e) }),
    )
    return () => {
      cancelled = true
    }
  }, [fetcher, key, minMs])

  return state.key === key ? state : {}
}
