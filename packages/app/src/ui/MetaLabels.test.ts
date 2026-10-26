import { describe, expect, it } from 'vitest'
import { spokenDuration } from './MetaLabels'

describe('spokenDuration', () => {
  it('spells out minutes and seconds', () => {
    expect(spokenDuration('4:17')).toBe('4 min 17 sec')
    expect(spokenDuration('0:45')).toBe('0 min 45 sec')
  })
  it('folds hours into minutes', () => {
    expect(spokenDuration('1:07:28')).toBe('67 min 28 sec')
    expect(spokenDuration('2:00:05')).toBe('120 min 5 sec')
  })
})
