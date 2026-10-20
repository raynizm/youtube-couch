import type { Item } from '../yt/types'

/** Channel and age under a thumbnail. View counts ("1.2M views", "340 watching") are left out on purpose. */
export function cardSub(item: Item): string {
  const when = (item.meta?.split(' · ').slice(0, 2) ?? []).filter((m) => !/\b(views?|watching)\b/i.test(m))
  return [item.author, ...when].filter(Boolean).join(' · ')
}
