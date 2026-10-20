import type { Item } from '../yt/types'

export const isViewCount = (m: string) => /\b(views?|watching)\b/i.test(m)

/** Channel and age under a thumbnail. View counts ("1.2M views", "340 watching") are left out on purpose. */
export function cardSub(item: Item): string {
  const when = (item.meta?.split(' · ').slice(0, 2) ?? []).filter((m) => !isViewCount(m))
  return [item.author, ...when].filter(Boolean).join(' · ')
}
