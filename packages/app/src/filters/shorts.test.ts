import { describe, expect, it } from 'vitest'
import { isShortItem, stripShorts } from './shorts'

describe('isShortItem', () => {
  it('flags reel items', () => {
    expect(isShortItem({ type: 'ReelItem', id: 'a' })).toBe(true)
    expect(isShortItem({ type: 'ShortsLockupView', id: 'a' })).toBe(true)
  })
  it('flags videos linking to /shorts/', () => {
    const item = { type: 'Video', endpoint: { metadata: { url: '/shorts/abc' } } }
    expect(isShortItem(item)).toBe(true)
  })
  it('keeps normal videos', () => {
    const item = { type: 'Video', endpoint: { metadata: { url: '/watch?v=abc' } } }
    expect(isShortItem(item)).toBe(false)
  })
})

describe('stripShorts', () => {
  it('removes shorts shelves and short items, keeps the rest', () => {
    const feed = [
      { type: 'ReelShelf', items: [{ type: 'ReelItem' }] },
      { type: 'RichSection', content: { type: 'ReelShelf' } },
      { type: 'Shelf', title: 'Mix', items: [{ type: 'ReelItem' }, { type: 'Video', id: 'v1' }] },
      { type: 'Video', id: 'v2' },
    ]
    expect(stripShorts(feed)).toEqual([
      { type: 'Shelf', title: 'Mix', items: [{ type: 'Video', id: 'v1' }] },
      { type: 'Video', id: 'v2' },
    ])
  })
})

describe('stripShorts null safety', () => {
  it('skips null nodes, including nested', () => {
    expect(stripShorts([null, { type: 'Video' }, { type: 'Row', items: [undefined, { type: 'ReelItem' }, { type: 'Video' }] }] as any)).toEqual([
      { type: 'Video' },
      { type: 'Row', items: [{ type: 'Video' }] },
    ])
  })
})
