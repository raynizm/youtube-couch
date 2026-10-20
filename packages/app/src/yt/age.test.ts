import { describe, expect, it } from 'vitest'
import { ageMinutes, newestFirst } from './age'
import type { Item } from './types'

const v = (id: string, meta?: string): Item => ({ id, kind: 'video', title: id, thumb: '', meta })

describe('ageMinutes', () => {
  it('reads relative labels in any position', () => {
    expect(ageMinutes('1.2M views · 3 days ago · 12:34')).toBe(3 * 1440)
    expect(ageMinutes('Streamed 2 hours ago')).toBe(120)
    expect(ageMinutes('1 year ago')).toBe(525600)
  })
  it('is undefined without a label', () => {
    expect(ageMinutes('12:34')).toBeUndefined()
    expect(ageMinutes(undefined)).toBeUndefined()
  })
})

describe('newestFirst', () => {
  it('orders by age and keeps unknown ages last in their original order', () => {
    const out = newestFirst([v('old', '2 years ago'), v('x'), v('new', '5 minutes ago'), v('y', '12:00'), v('mid', '3 days ago')])
    expect(out.map((i) => i.id)).toEqual(['new', 'mid', 'old', 'x', 'y'])
  })
})
