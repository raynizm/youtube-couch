import { describe, expect, it } from 'vitest'
import { fragmentAt, parseSidx } from './sidx'

/** A sidx box: `refs` are [size, ticks] pairs. */
function sidx(version: 0 | 1, timescale: number, earliest: number, firstOffset: number, refs: [number, number][]): ArrayBuffer {
  const head = version === 0 ? 8 : 16
  const buf = new ArrayBuffer(8 + 4 + 4 + 4 + head + 4 + refs.length * 12)
  const v = new DataView(buf)
  v.setUint32(0, buf.byteLength)
  v.setUint32(4, 0x73696478)
  v.setUint8(8, version)
  v.setUint32(16, timescale)
  let p = 20
  if (version === 0) {
    v.setUint32(p, earliest)
    v.setUint32(p + 4, firstOffset)
  } else {
    v.setUint32(p + 4, earliest)
    v.setUint32(p + 12, firstOffset)
  }
  p += head
  v.setUint16(p + 2, refs.length)
  p += 4
  for (const [size, ticks] of refs) {
    v.setUint32(p, size)
    v.setUint32(p + 4, ticks)
    p += 12
  }
  return buf
}

const refs: [number, number][] = [
  [1000, 5000],
  [2000, 5000],
  [500, 2500],
]

describe('parseSidx', () => {
  it('lays fragments out one after another from the anchor', () => {
    expect(parseSidx(sidx(0, 1000, 0, 0, refs), 700)).toEqual([
      { start: 0, duration: 5, offset: 700, size: 1000 },
      { start: 5, duration: 5, offset: 1700, size: 2000 },
      { start: 10, duration: 2.5, offset: 3700, size: 500 },
    ])
  })

  it('applies the first offset and the earliest presentation time', () => {
    const [first] = parseSidx(sidx(0, 1000, 2000, 50, refs), 700)
    expect(first).toEqual({ start: 2, duration: 5, offset: 750, size: 1000 })
  })

  it('reads version 1 boxes', () => {
    expect(parseSidx(sidx(1, 1000, 0, 0, refs), 0).map((f) => f.size)).toEqual([1000, 2000, 500])
  })

  it('ignores the hierarchy bit in the size', () => {
    const buf = sidx(0, 1000, 0, 0, [[1000, 5000]])
    new DataView(buf).setUint32(32, 0x80000000 + 1000)
    expect(parseSidx(buf, 0)[0].size).toBe(1000)
  })

  it('throws when the data is not a sidx box', () => {
    expect(() => parseSidx(new ArrayBuffer(64), 0)).toThrow('No sidx box')
  })

  it('throws when the box is shorter than it claims', () => {
    expect(() => parseSidx(sidx(0, 1000, 0, 0, refs).slice(0, 40), 0)).toThrow('Bad sidx box')
  })
})

describe('fragmentAt', () => {
  const frags = parseSidx(sidx(0, 1000, 0, 0, refs), 0)

  it('finds the fragment holding a time', () => {
    expect(fragmentAt(frags, 0)).toBe(0)
    expect(fragmentAt(frags, 4.9)).toBe(0)
    expect(fragmentAt(frags, 5)).toBe(1)
    expect(fragmentAt(frags, 11)).toBe(2)
  })

  it('clamps to the last fragment past the end', () => {
    expect(fragmentAt(frags, 999)).toBe(2)
  })
})
