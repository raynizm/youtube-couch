import { describe, expect, it } from 'vitest'
import { fromProxyHeaders, scopeBearer, scopeProfile, toProxyHeaders } from './proxyHeaders'

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

describe('scopeBearer', () => {
  const enc = (o: unknown) => new TextEncoder().encode(JSON.stringify(o)).buffer as ArrayBuffer
  const hdrs = () => new Headers({ authorization: 'Bearer secret', 'content-type': 'application/json' })

  it('keeps the bearer for a TVHTML5 body', () => {
    expect(scopeBearer(hdrs(), enc({ context: { client: { clientName: 'TVHTML5' } } })).get('authorization')).toBe('Bearer secret')
  })

  it('strips the bearer for other clients', () => {
    for (const clientName of ['WEB', 'MWEB', 'ANDROID', 'IOS', 'TVHTML5_SIMPLY']) {
      expect(scopeBearer(hdrs(), enc({ context: { client: { clientName } } })).has('authorization')).toBe(false)
    }
  })

  it('strips on non-JSON, empty or missing bodies, and keeps other headers', () => {
    for (const body of [new TextEncoder().encode('not json').buffer as ArrayBuffer, new ArrayBuffer(0), undefined, enc(null), enc({})]) {
      const h = scopeBearer(hdrs(), body)
      expect(h.has('authorization')).toBe(false)
      expect(h.get('content-type')).toBe('application/json')
    }
  })

  it('accepts string bodies and leaves header-less requests alone', () => {
    expect(scopeBearer(hdrs(), '{"context":{"client":{"clientName":"TVHTML5"}}}').has('authorization')).toBe(true)
    expect(scopeBearer(new Headers(), undefined).has('authorization')).toBe(false)
  })
})

describe('scopeProfile', () => {
  const enc = (o: unknown) => new TextEncoder().encode(JSON.stringify(o)).buffer as ArrayBuffer
  const dec = (b?: ArrayBuffer) => JSON.parse(new TextDecoder().decode(b))

  it('keeps the profile for TVHTML5', () => {
    const body = enc({ context: { client: { clientName: 'TVHTML5' }, user: { onBehalfOfUser: '9' } } })
    expect(dec(scopeProfile(body)).context.user.onBehalfOfUser).toBe('9')
  })

  it('removes the profile for other clients and keeps the rest', () => {
    const body = enc({ videoId: 'v', context: { client: { clientName: 'WEB' }, user: { onBehalfOfUser: '9', lockedSafetyMode: false } } })
    const out = dec(scopeProfile(body))
    expect(out.context.user).toEqual({ lockedSafetyMode: false })
    expect(out.videoId).toBe('v')
  })

  it('passes through bodies without a profile, non-JSON and missing bodies', () => {
    const plain = enc({ context: { client: { clientName: 'WEB' } } })
    expect(scopeProfile(plain)).toBe(plain)
    const junk = new TextEncoder().encode('nope').buffer as ArrayBuffer
    expect(scopeProfile(junk)).toBe(junk)
    expect(scopeProfile(undefined)).toBeUndefined()
  })
})
