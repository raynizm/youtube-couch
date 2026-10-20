import { describe, expect, it } from 'vitest'
import type { Item } from '../yt/types'
import { cardSub } from './cardSub'

const item = (over: Partial<Item>): Item => ({ id: 'aaaaaaaaaaa', kind: 'video', title: 't', thumb: '', ...over })

describe('cardSub', () => {
  it('drops the view count and keeps channel and age', () => {
    expect(cardSub(item({ author: 'Ann', meta: '1.2M views · 3 days ago · 12:34' }))).toBe('Ann · 3 days ago')
  })
  it('drops live viewer counts', () => {
    expect(cardSub(item({ author: 'Ann', meta: '340 watching · Streamed live' }))).toBe('Ann · Streamed live')
  })
  it('handles missing parts', () => {
    expect(cardSub(item({ meta: '5 views' }))).toBe('')
    expect(cardSub(item({ author: 'Ann' }))).toBe('Ann')
  })
})
