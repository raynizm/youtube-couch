type Node = { type?: string; [key: string]: unknown }

const SHORT_TYPES = new Set(['ReelItem', 'ReelShelf', 'ShortsLockupView', 'ShortsShelf'])

export function isShortItem(node: Node): boolean {
  if (node.type && SHORT_TYPES.has(node.type)) return true
  const url = (node.endpoint as { metadata?: { url?: string } } | undefined)?.metadata?.url
  return typeof url === 'string' && url.startsWith('/shorts/')
}

function isShortsContainer(node: Node): boolean {
  const content = node.content as Node | undefined
  return !!content && isShortItem(content)
}

/** Drops Shorts items and shelves from a feed, recursing into `items`. */
export function stripShorts<T extends Node>(nodes: T[]): T[] {
  const out: T[] = []
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    if (isShortItem(node) || isShortsContainer(node)) continue
    if (Array.isArray(node.items)) {
      out.push({ ...node, items: stripShorts(node.items as Node[]) })
    } else {
      out.push(node)
    }
  }
  return out
}
