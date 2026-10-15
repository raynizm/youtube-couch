import { expect, test } from 'vitest'
import { homeIsEmpty } from './homeEmpty'

test('empty only when feed has no items and no local rows', () => {
  expect(homeIsEmpty([], 0, 0)).toBe(true)
  expect(homeIsEmpty([{ title: 'a', items: [] }], 0, 0)).toBe(true)
  expect(homeIsEmpty([], 1, 0)).toBe(false)
  expect(homeIsEmpty([], 0, 1)).toBe(false)
  expect(homeIsEmpty([{ title: 'a', items: [{ id: 'x' } as never] }], 0, 0)).toBe(false)
})
