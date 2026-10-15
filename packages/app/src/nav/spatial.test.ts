import { describe, expect, it } from 'vitest'
import { pickNext, type Box } from './spatial'

const box = (id: string, x: number, y: number, w = 100, h = 100): Box => ({ id, x, y, w, h })

describe('pickNext', () => {
  const items = [box('a', 0, 0), box('b', 200, 0), box('c', 0, 200), box('d', 200, 200), box('far', 600, 10)]
  it('moves right to the nearest aligned item', () => {
    expect(pickNext(items[0], items, 'right')).toBe('b')
  })
  it('moves down', () => {
    expect(pickNext(items[0], items, 'down')).toBe('c')
  })
  it('moves left', () => {
    expect(pickNext(items[3], items, 'left')).toBe('c')
  })
  it('returns undefined when nothing lies that way', () => {
    expect(pickNext(items[0], items, 'up')).toBeUndefined()
  })
})
