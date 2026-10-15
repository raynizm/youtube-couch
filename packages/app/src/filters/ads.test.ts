import { describe, expect, it } from 'vitest'
import { stripAds, stripPlayerAds } from './ads'

describe('stripPlayerAds', () => {
  it('removes ad fields from a player response', () => {
    const res = { videoDetails: { videoId: 'x' }, adPlacements: [1], playerAds: [2], adSlots: [3], adBreakHeartbeatParams: 'a' }
    expect(stripPlayerAds(res)).toEqual({ videoDetails: { videoId: 'x' } })
  })
})

describe('stripAds', () => {
  it('drops ad renderers from feeds', () => {
    const feed = [{ type: 'AdSlot' }, { type: 'PromotedSparklesWeb' }, { type: 'Video', id: 'v' }]
    expect(stripAds(feed)).toEqual([{ type: 'Video', id: 'v' }])
  })
})

describe('stripAds null safety', () => {
  it('skips null nodes, including nested', () => {
    expect(stripAds([null, { type: 'Video' }, { type: 'Row', items: [undefined, { type: 'AdSlot' }, { type: 'Video' }] }] as any)).toEqual([
      { type: 'Video' },
      { type: 'Row', items: [{ type: 'Video' }] },
    ])
  })
})
