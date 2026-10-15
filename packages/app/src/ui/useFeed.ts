import { useEffect, useState } from 'react'

type State<T> = { key: unknown; data?: T; error?: string }

// Runs fetcher whenever key (or fetcher identity; pass a stable function) changes. Results arriving after key changed or unmount are dropped,
// and a result belonging to a previous key is never returned (data/error undefined = loading).
export function useFeed<T>(fetcher: () => Promise<T>, key: unknown): { data?: T; error?: string } {
  const [state, setState] = useState<State<T>>({ key })

  useEffect(() => {
    let cancelled = false
    fetcher().then(
      (data) => !cancelled && setState({ key, data }),
      (e) => !cancelled && setState({ key, error: String(e?.message ?? e) }),
    )
    return () => {
      cancelled = true
    }
  }, [fetcher, key])

  return state.key === key ? state : {}
}
