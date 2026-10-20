import type { Item } from './types'

const UNIT_MINUTES: Record<string, number> = {
  second: 1 / 60,
  minute: 1,
  hour: 60,
  day: 1440,
  week: 10080,
  month: 43200,
  year: 525600,
}

/** Minutes since upload from a relative label ("3 days ago", "Streamed 2 hours ago"); undefined when there is none. */
export function ageMinutes(meta: string | undefined): number | undefined {
  for (const part of meta?.split(' · ') ?? []) {
    const m = /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i.exec(part)
    if (m) return Number(m[1]) * UNIT_MINUTES[m[2].toLowerCase()]
  }
  return undefined
}

/** Newest first. Items with no readable age keep their order and go last. */
export function newestFirst(items: Item[]): Item[] {
  return items
    .map((item, i) => ({ item, i, age: ageMinutes(item.meta) }))
    .sort((a, b) => (a.age ?? Infinity) - (b.age ?? Infinity) || a.i - b.i)
    .map((x) => x.item)
}
