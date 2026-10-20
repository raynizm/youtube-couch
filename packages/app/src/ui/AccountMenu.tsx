import { useEffect, useRef } from 'react'
import { isBack } from '../nav/useSpatialNav'

export function AccountMenu({
  name,
  onSwitch,
  onSignOut,
  onClose,
}: {
  name?: string
  onSwitch: () => void
  onSignOut: () => void
  onClose: () => void
}) {
  const cancel = useRef<HTMLButtonElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => isBack(e) && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    cancel.current?.focus()
  }, [])

  return (
    <div className="signin" data-modal>
      <h1>{name || 'Account'}</h1>
      <div className="signin-actions">
        <button className="btn" data-focusable onClick={onSwitch}>
          Switch profile
        </button>
        <button className="btn" data-focusable onClick={onSignOut}>
          Sign out
        </button>
        <button ref={cancel} className="btn primary" data-focusable onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
