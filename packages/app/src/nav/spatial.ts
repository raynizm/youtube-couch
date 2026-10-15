export type Box = { id: string; x: number; y: number; w: number; h: number }
export type Dir = 'up' | 'down' | 'left' | 'right'

const center = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })

/** Picks the closest box in direction `dir`; off-axis distance is penalised so rows/columns stay aligned. */
export function pickNext(from: Box, all: Box[], dir: Dir): string | undefined {
  const f = center(from)
  let best: { id: string; score: number } | undefined
  for (const b of all) {
    if (b.id === from.id) continue
    const c = center(b)
    const dx = c.x - f.x
    const dy = c.y - f.y
    const [main, cross] = dir === 'left' || dir === 'right' ? [dx, dy] : [dy, dx]
    const sign = dir === 'right' || dir === 'down' ? 1 : -1
    if (main * sign <= 0) continue
    const score = Math.abs(main) + Math.abs(cross) * 3
    if (!best || score < best.score) best = { id: b.id, score }
  }
  return best?.id
}
