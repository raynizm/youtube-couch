type Node = { type?: string; [key: string]: unknown }

const AD_FIELDS = ['adPlacements', 'playerAds', 'adSlots', 'adBreakHeartbeatParams']
const AD_TYPES = new Set(['AdSlot', 'PromotedSparklesWeb', 'PromotedVideo', 'DisplayAd', 'InFeedAdLayout'])

/** Removes ad data from a player response so the player never schedules ads. */
export function stripPlayerAds<T extends Record<string, unknown>>(res: T): T {
  const copy: Record<string, unknown> = { ...res }
  for (const field of AD_FIELDS) delete copy[field]
  return copy as T
}

/** Drops ad and promoted items from a feed, recursing into `items`. */
export function stripAds<T extends Node>(nodes: T[]): T[] {
  const out: T[] = []
  for (const node of nodes) {
    if (node.type && AD_TYPES.has(node.type)) continue
    out.push(Array.isArray(node.items) ? { ...node, items: stripAds(node.items as Node[]) } : node)
  }
  return out
}
