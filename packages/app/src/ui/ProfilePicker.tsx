import { useEffect, useRef, useState } from 'react'
import { isBack } from '../nav/useSpatialNav'
import { listProfiles, selectProfile } from '../yt/client'
import type { Profile } from '../yt/profiles'

/**
 * "Who's watching?" Renders nothing while loading. With fewer than two profiles (or an unreadable
 * list) a `silent` picker, used right after login, just closes; a picker the user asked for says so.
 */
export function ProfilePicker({ silent, onClose }: { silent: boolean; onClose: () => void }) {
  const [profiles, setProfiles] = useState<Profile[]>()
  const [notice, setNotice] = useState<string>()
  const first = useRef<HTMLButtonElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    let stale = false
    listProfiles().then(
      (list) => {
        if (stale) return
        if (list.length >= 2) setProfiles(list)
        else if (silent) closeRef.current()
        else setNotice(list.length ? 'This account has no other profiles.' : 'Could not read the profile list.')
      },
      () => {
        if (stale) return
        if (silent) closeRef.current()
        else setNotice('Could not load profiles.')
      },
    )
    return () => {
      stale = true
    }
  }, [silent])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => isBack(e) && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    first.current?.focus()
  }, [profiles, notice])

  if (notice) {
    return (
      <div className="signin" data-modal>
        <h1>Switch profile</h1>
        <p className="signin-error">{notice}</p>
        <div className="signin-actions">
          <button ref={first} className="btn primary" data-focusable onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    )
  }
  if (!profiles) return null
  const start = Math.max(0, profiles.findIndex((p) => p.selected))
  const pick = (p: Profile) => {
    // A failed switch leaves the current profile in place; close either way.
    void selectProfile(p).finally(() => closeRef.current())
  }

  return (
    <div className="signin" data-modal>
      <h1>Who's watching?</h1>
      <div className="profiles">
        {profiles.map((p, i) => (
          <button
            key={p.id ?? p.name}
            ref={i === start ? first : undefined}
            className="profile"
            data-focusable
            onClick={() => pick(p)}
          >
            {p.avatar ? <img className="profile-avatar" src={p.avatar} alt="" /> : <span className="profile-avatar avatar-fallback">{p.name.slice(0, 1)}</span>}
            <span className="profile-name">{p.name}</span>
            {p.byline && <span className="profile-byline">{p.byline}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
