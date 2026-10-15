import { useSyncExternalStore } from 'react'
import type { Item } from './yt/types'

export type Progress = { item: Item; pos: number; dur: number; ts: number }

const EVT = 'bluefin-store'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable or full: ignore */
  }
  window.dispatchEvent(new Event(EVT))
}

const cache = new Map<string, { raw: string | null; value: unknown }>()

// useSyncExternalStore needs a stable snapshot, so memoise by raw string.
function snapshot<T>(key: string, fallback: T): T {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(key)
  } catch {
    /* ignore */
  }
  const hit = cache.get(key)
  if (hit && hit.raw === raw) return hit.value as T
  const value = raw ? (JSON.parse(raw) as T) : fallback
  cache.set(key, { raw, value })
  return value
}

function useKey<T>(key: string, fallback: T): T {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVT, cb)
      return () => window.removeEventListener(EVT, cb)
    },
    () => snapshot(key, fallback),
  )
}

const EMPTY_LIST: Item[] = []
const EMPTY_MAP: Record<string, Progress> = {}
export type Sub = { name: string; avatar?: string; bell: boolean }
const EMPTY_SUBS: Record<string, Sub> = {}
const EMPTY_FLAGS: Record<string, true> = {}

export const useWatchlist = () => useKey<Item[]>('bluefin.watchlist', EMPTY_LIST)
export const useProgress = () => useKey<Record<string, Progress>>('bluefin.progress', EMPTY_MAP)

export const useWatched = () => useKey<Record<string, true>>('bluefin.watched', EMPTY_FLAGS)

export const useSubs = () => useKey<Record<string, Sub>>('bluefin.subs', EMPTY_SUBS)

// Local only until sign-in lands; the Subscriptions tab does not read these yet.
export function toggleSub(id: string, info: { name: string; avatar?: string }) {
  const all = read<Record<string, Sub>>('bluefin.subs', {})
  if (all[id]) delete all[id]
  else all[id] = { ...info, bell: false }
  write('bluefin.subs', all)
}

// Turning the bell on for an unsubscribed channel subscribes to it.
export function toggleBell(id: string, info: { name: string; avatar?: string }) {
  const all = read<Record<string, Sub>>('bluefin.subs', {})
  write('bluefin.subs', { ...all, [id]: { ...info, ...all[id], bell: !all[id]?.bell } })
}

export function toggleWatchlist(item: Item) {
  const list = read<Item[]>('bluefin.watchlist', [])
  write('bluefin.watchlist', list.some((i) => i.id === item.id) ? list.filter((i) => i.id !== item.id) : [item, ...list])
}

export function getProgress(id: string): Progress | undefined {
  return read<Record<string, Progress>>('bluefin.progress', {})[id]
}

export function saveProgress(item: Item, pos: number, dur: number) {
  const all = read<Record<string, Progress>>('bluefin.progress', {})
  // Finished videos drop out of "Continue watching".
  if (dur > 0 && pos / dur > 0.95) {
    delete all[item.id]
    write('bluefin.watched', { ...read<Record<string, true>>('bluefin.watched', {}), [item.id]: true })
  } else all[item.id] = { item, pos, dur, ts: Date.now() }
  write('bluefin.progress', all)
}
