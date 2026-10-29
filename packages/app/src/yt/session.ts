import { Innertube, Utils, type OAuth2Tokens } from 'youtubei.js'
import { clearAuth, loadCredentials, loadProfileId, saveAccount, saveCredentials, type Account } from './auth'
import { scopeBearer, scopeProfile, toProxyHeaders } from './proxyHeaders'
import type { Raw } from './raw'

// Dev and preview servers proxy on the page's own origin; the TizenBrew build points at the proxy its service runs on the TV.
const PROXY_BASE: string = import.meta.env.VITE_PROXY_BASE ?? ''
export const proxied = (url: string) => `${PROXY_BASE}/__proxy?url=${encodeURIComponent(url)}`

// Browser fetch cannot set User-Agent or reach YouTube cross-origin, so route through the proxy.
async function proxyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const req = new Request(input as RequestInfo, init)
  const headers = toProxyHeaders(init, input)
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : scopeProfile(await req.arrayBuffer())
  scopeBearer(headers, body)
  return fetch(proxied(req.url), { method: req.method, headers, body })
}

let session: Promise<Innertube> | undefined
let current: Innertube | undefined
const resetSession = () => {
  session = undefined
  current = undefined
}
// A stale session (cancelled sign-in, pre-signOut) must not touch newer state.
const resetIfCurrent = (yt: Innertube) => {
  if (current === yt) resetSession()
}

/** True only for an OAuth2Error that means the server refused the credentials (not a transient failure). */
function isAuthRejection(e: unknown): boolean {
  if (!(e instanceof Utils.OAuth2Error)) return false
  const status = /(\d{3})\s*$/.exec(e.message)?.[1]
  if (status) return status === '400' || status === '401'
  const info = (e as { info?: Raw }).info
  if (info && (info.error || info.error_code)) return true
  return /invalid tokens|no tokens available|invalid_grant/i.test(e.message)
}

const isUnauthorized = (e: unknown) => e instanceof Error && /status code 401\b/.test(e.message)

/** Makes every request act as the given page id; undefined goes back to the primary account. */
export function applyProfile(yt: Innertube, id: string | undefined) {
  const user = yt.session.context?.user
  if (!user) return
  if (id) user.onBehalfOfUser = id
  else delete user.onBehalfOfUser
}

async function createSession(): Promise<Innertube> {
  const yt = await Innertube.create({
    fetch: proxyFetch as typeof fetch,
    retrieve_player: false,
    generate_session_locally: true,
  })
  current = yt
  yt.session.on('update-credentials', ({ credentials }) => {
    if (credentials && current === yt) saveCredentials(credentials)
  })
  yt.session.on('auth-error', () => {
    if (current !== yt) return
    clearAuth()
    resetSession()
  })
  // A refresh the server REJECTS (HTTP 400/401, invalid_grant) throws an OAuth2Error, and a 401 on an
  // authenticated request throws an InnertubeError; both mean the credentials are dead. Network
  // failures, 5xx and 429 keep the stored credentials.
  const dropAuth = () => {
    if (current !== yt) return
    clearAuth()
    resetSession()
  }
  const http = yt.session.http
  const rawFetch = http.fetch.bind(http)
  http.fetch = async (...args: Parameters<typeof rawFetch>) => {
    try {
      return await rawFetch(...args)
    } catch (e) {
      if (isAuthRejection(e) || (yt.session.logged_in && isUnauthorized(e))) dropAuth()
      throw e
    }
  }
  const tokens = loadCredentials()
  if (tokens) {
    try {
      await yt.session.signIn(tokens)
      applyProfile(yt, loadProfileId())
    } catch (e) {
      if (!isAuthRejection(e)) throw e
      clearAuth()
    }
  }
  return yt
}

export const getSession = () => (session ??= createSession().catch((e) => {
  resetSession()
  throw e
}))

export type SignInCode = { code: string; url: string }

/**
 * Starts the device-code flow. Limitation: the library's code poller (setInterval ~5s, up to ~30min)
 * keeps running after cancel/retry; state stays correct because that session is discarded.
 * `cancel` silences every handler and rejects `done`.
 */
export function startSignIn(onCode: (c: SignInCode) => void): { done: Promise<void>; cancel: () => void } {
  let cancelled = false
  let stop: () => void = () => {}
  let fail: (e: Error) => void = () => {}
  const done = new Promise<void>((resolve, reject) => {
    fail = reject
    getSession().then((yt) => {
      if (cancelled) return
      const s = yt.session
      const onPending = (d: { user_code: string; verification_url: string }) => {
        if (!cancelled) onCode({ code: d.user_code, url: d.verification_url })
      }
      const onAuth = async (data: { credentials?: OAuth2Tokens }) => {
        if (cancelled) return
        cleanup()
        // The library's own once('auth') handler (logged_in = true) was registered after ours and
        // runs synchronously later in this same emit; one microtask turn lets it finish first.
        await Promise.resolve()
        try {
          const credentials = data.credentials
          if (!credentials) throw new Error('Sign-in returned no credentials')
          let account: Account = { name: 'Account' }
          try {
            const info = (await yt.account.getInfo()) as unknown as Raw
            const first = info.contents?.contents?.[0]
            const name = first?.account_name?.text
            if (name) account = { name, avatar: first?.account_photo?.[0]?.url ?? info.account_photo?.[0]?.url }
          } catch {
            /* keep the generic name */
          }
          if (cancelled) return
          saveCredentials(credentials)
          saveAccount(account)
          resolve()
        } catch (e) {
          resetIfCurrent(yt)
          reject(e instanceof Error ? e : new Error('Sign-in failed'))
        }
      }
      const onError = (e: unknown) => {
        if (cancelled) return
        cleanup()
        resetIfCurrent(yt)
        reject(e instanceof Error ? e : new Error('Sign-in failed'))
      }
      function cleanup() {
        s.off('auth-pending', onPending)
        s.off('auth', onAuth)
        s.off('auth-error', onError)
      }
      stop = () => {
        cleanup()
        resetIfCurrent(yt)
      }
      s.on('auth-pending', onPending)
      s.on('auth', onAuth)
      s.on('auth-error', onError)
      s.signIn().catch(onError)
    }, reject)
  })
  return {
    done,
    cancel: () => {
      if (cancelled) return
      cancelled = true
      stop()
      fail(new Error('Sign-in cancelled'))
    },
  }
}

const REVOKE_TIMEOUT_MS = 5000

/** Signs out locally at once; revoking the token on the server is best effort in the background. */
export async function signOut(): Promise<void> {
  const pending = session
  clearAuth()
  resetSession()
  if (!pending) return
  void pending
    .then((yt) =>
      Promise.race([yt.session.signOut(), new Promise<void>((resolve) => setTimeout(resolve, REVOKE_TIMEOUT_MS))]),
    )
    .catch(() => {})
}

/** A browse request to the TV client; returns the raw response body. */
export const tvBrowse = async (args: string | { continuation: string }): Promise<unknown> => {
  const yt = await getSession()
  const body = typeof args === 'string' ? { browseId: args } : args
  const res = (await yt.actions.execute('/browse', { ...body, client: 'TV' } as any)) as unknown as Raw
  return res?.data
}
