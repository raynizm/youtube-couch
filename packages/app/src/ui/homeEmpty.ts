import type { Row } from '../yt/types'

export const homeIsEmpty = (rows: Row[], resumeCount: number, watchlistCount: number) =>
  resumeCount === 0 && watchlistCount === 0 && rows.every((r) => r.items.length === 0)
