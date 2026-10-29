/** One media fragment of a DASH MP4: the seconds it covers and the bytes it occupies in the file. */
export type Fragment = { start: number; duration: number; offset: number; size: number }

const SIDX = 0x73696478 // 'sidx'

const u64 = (v: DataView, at: number) => v.getUint32(at) * 2 ** 32 + v.getUint32(at + 4)

/**
 * Reads the fragment table of a `sidx` box. `buf` starts at the box; `anchor` is the file offset of the first byte after it,
 * which the first fragment's offset is measured from.
 */
export function parseSidx(buf: ArrayBuffer, anchor: number): Fragment[] {
  const v = new DataView(buf)
  if (v.byteLength < 32 || v.getUint32(4) !== SIDX) throw new Error('No sidx box')
  const version = v.getUint8(8)
  let p = 16 // box header (8), version and flags (4), reference id (4)
  const timescale = v.getUint32(p)
  p += 4
  let time: number
  let offset: number
  if (version === 0) {
    time = v.getUint32(p)
    offset = anchor + v.getUint32(p + 4)
    p += 8
  } else {
    time = u64(v, p)
    offset = anchor + u64(v, p + 8)
    p += 16
  }
  const count = v.getUint16(p + 2) // after 2 reserved bytes
  p += 4
  if (!timescale || p + count * 12 > v.byteLength) throw new Error('Bad sidx box')
  const out: Fragment[] = []
  for (let i = 0; i < count; i++, p += 12) {
    const size = v.getUint32(p) & 0x7fffffff
    const ticks = v.getUint32(p + 4)
    out.push({ start: time / timescale, duration: ticks / timescale, offset, size })
    offset += size
    time += ticks
  }
  return out
}

/** Index of the fragment holding second `t`: the last one starting at or before it. */
export function fragmentAt(frags: Fragment[], t: number): number {
  let at = 0
  for (let i = 0; i < frags.length && frags[i].start <= t; i++) at = i
  return at
}
