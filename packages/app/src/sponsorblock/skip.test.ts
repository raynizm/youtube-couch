import { describe, expect, it } from 'vitest'
import { findSkip, type Segment } from './skip'

const segs: Segment[] = [
  { category: 'sponsor', segment: [10, 20] },
  { category: 'selfpromo', segment: [50, 60] },
  { category: 'music_offtopic', segment: [70, 80] },
]

describe('findSkip', () => {
  it('returns the segment end when inside an enabled category', () => {
    expect(findSkip(segs, 12, ['sponsor', 'selfpromo'])?.segment[1]).toBe(20)
  })
  it('ignores categories that are not enabled', () => {
    expect(findSkip(segs, 75, ['sponsor'])).toBeUndefined()
  })
  it('ignores times outside any segment', () => {
    expect(findSkip(segs, 30, ['sponsor', 'selfpromo'])).toBeUndefined()
  })
  it('does not re-skip right at the end boundary', () => {
    expect(findSkip(segs, 20, ['sponsor'])).toBeUndefined()
  })
})
