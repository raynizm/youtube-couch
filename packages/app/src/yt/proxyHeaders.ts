// Browsers silently drop forbidden header names (Referer, User-Agent) once they are on a
// Request/Headers object, so the caller's values are read from the raw fetch args and carried
// through the proxy under x-referer / x-ua.

type HeaderSource = { headers?: unknown } | undefined

function readHeader(src: HeaderSource, name: string): string | undefined {
  const h = src?.headers
  if (!h) return undefined
  if (Array.isArray(h)) {
    const pair = (h as [string, string][]).find((p) => String(p[0]).toLowerCase() === name)
    return pair ? String(pair[1]) : undefined
  }
  if (typeof (h as Headers).get === 'function') return (h as Headers).get(name) ?? undefined
  for (const [k, v] of Object.entries(h as Record<string, unknown>)) {
    if (k.toLowerCase() === name && v != null) return String(v)
  }
  return undefined
}

/** Headers to send to /__proxy. `init` wins over `input` when both carry a value. */
export function toProxyHeaders(init?: RequestInit, input?: unknown): Headers {
  const headers = new Headers((input as Request | undefined)?.headers)
  new Headers(init?.headers).forEach((v, k) => headers.set(k, v))
  // Take the caller's values before the Headers objects above can drop them.
  const referer = readHeader(init, 'referer') ?? readHeader(input as HeaderSource, 'referer')
  const ua = readHeader(init, 'user-agent') ?? readHeader(input as HeaderSource, 'user-agent')
  headers.delete('referer')
  headers.delete('user-agent')
  if (referer) headers.set('x-referer', referer)
  if (ua) headers.set('x-ua', ua)
  return headers
}

const DROPPED = ['host', 'origin', 'referer', 'cookie', 'connection', 'accept-encoding']

/** Server side: filters incoming proxy request headers and maps x-referer / x-ua back. */
export function fromProxyHeaders(incoming: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(incoming)) {
    if (typeof v === 'string' && !DROPPED.includes(k) && !k.startsWith('sec-')) out[k] = v
  }
  if (out['x-ua']) out['user-agent'] = out['x-ua']
  delete out['x-ua']
  if (out['x-referer']) out.referer = out['x-referer']
  delete out['x-referer']
  return out
}
