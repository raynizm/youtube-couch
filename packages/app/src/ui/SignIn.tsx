import { useEffect, useRef, useState } from 'react'
import { isBack } from '../nav/useSpatialNav'
import { startSignIn, type SignInCode } from '../yt/client'
import { QrCode } from './QrCode'

/** Verification URL with the code prefilled, so a phone scan lands ready to confirm. */
export function activationUrl({ url, code }: SignInCode): string {
  const base = /^https?:\/\//.test(url) ? url : `https://${url}`
  return `${base}${base.includes('?') ? '&' : '?'}user_code=${encodeURIComponent(code)}`
}

export function SignIn({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState<SignInCode>()
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const btn = useRef<HTMLButtonElement>(null)
  const closeRef = useRef(onClose)
  const doneRef = useRef(onDone)
  useEffect(() => {
    closeRef.current = onClose
    doneRef.current = onDone
  }, [onClose, onDone])

  const retry = () => {
    setCode(undefined)
    setError(undefined)
    setAttempt((n) => n + 1)
  }

  useEffect(() => {
    // `stale` covers our own cancel(): a cleaned-up attempt (unmount, StrictMode remount, retry) must not touch state.
    let stale = false
    const s = startSignIn((c) => !stale && setCode(c))
    s.done.then(
      () => !stale && doneRef.current(),
      (e) => !stale && setError(e instanceof Error && e.message ? e.message : 'Sign-in failed'),
    )
    return () => {
      stale = true
      s.cancel()
    }
  }, [attempt])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => isBack(e) && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    btn.current?.focus()
  }, [error])

  return (
    <div className="signin" data-modal>
      <h1>Sign in</h1>
      {error ? (
        <>
          <p className="signin-error">{error}</p>
          <div className="signin-actions">
            <button ref={btn} className="btn primary" data-focusable onClick={retry}>
              Retry
            </button>
            <button className="btn" data-focusable onClick={onClose}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          {code ? (
            <div className="signin-body">
              <QrCode text={activationUrl(code)} label={`Scan to sign in at ${code.url}`} />
              <div className="signin-steps">
                <p>
                  Scan the code with your phone, or go to <strong>{code.url}</strong> and enter
                </p>
                <div className="signin-code">{code.code}</div>
              </div>
            </div>
          ) : (
            <p className="signin-wait">Getting a code…</p>
          )}
          <div className="signin-actions">
            <button ref={btn} className="btn" data-focusable onClick={onClose}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  )
}
