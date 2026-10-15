import { describe, expect, it } from 'vitest'
import { fromProxyHeaders, toProxyHeaders } from './proxyHeaders'

describe('toProxyHeaders', () => {
  it('reads referer from a plain object', () => {
    expect(toProxyHeaders({ headers: { Referer: 'https://www.youtube.com/tv' } }).get('x-referer')).toBe('https://www.youtube.com/tv')
  })
  it('reads referer from a Headers instance', () => {
    const h = new Headers()
    h.set('Content-Type', 'application/json')
    const out = toProxyHeaders({ headers: h })
    expect(out.get('content-type')).toBe('application/json')
  })
  it('reads referer from an array of pairs', () => {
    expect(toProxyHeaders({ headers: [['referer', 'https://a.youtube.com/']] }).get('x-referer')).toBe('https://a.youtube.com/')
  })
  it('reads referer from a Request-like input', () => {
    const input = { headers: new Map([['referer', 'https://www.youtube.com/tv']]) } as any
    expect(toProxyHeaders(undefined, input).get('x-referer')).toBe('https://www.youtube.com/tv')
  })
  it('init wins over input', () => {
    const input = { headers: new Map([['referer', 'https://old/']]) } as any
    expect(toProxyHeaders({ headers: { referer: 'https://new/' } }, input).get('x-referer')).toBe('https://new/')
  })
  it('maps user-agent to x-ua', () => {
    const out = toProxyHeaders({ headers: { 'User-Agent': 'Cobalt' } })
    expect(out.get('x-ua')).toBe('Cobalt')
    expect(out.has('user-agent')).toBe(false)
  })
  it('emits no x-referer when absent', () => {
    expect(toProxyHeaders({ headers: { a: 'b' } }).has('x-referer')).toBe(false)
    expect(toProxyHeaders().has('x-referer')).toBe(false)
  })
})

describe('fromProxyHeaders', () => {
  it('maps x-referer and x-ua back, drops cookie/origin/referer/sec-*', () => {
    const out = fromProxyHeaders({
      'x-referer': 'https://www.youtube.com/tv',
      'x-ua': 'Cobalt',
      referer: 'http://localhost/',
      cookie: 'a=b',
      origin: 'http://localhost',
      'sec-fetch-mode': 'cors',
      authorization: 'Bearer t',
    })
    expect(out).toEqual({ referer: 'https://www.youtube.com/tv', 'user-agent': 'Cobalt', authorization: 'Bearer t' })
  })
  it('has no referer without x-referer', () => {
    expect(fromProxyHeaders({ referer: 'http://localhost/' })).toEqual({})
  })
})
