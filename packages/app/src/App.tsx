import { useCallback, useState } from 'react'
import { useSpatialNav } from './nav/useSpatialNav'
import { Player } from './player/Player'
import { AccountMenu } from './ui/AccountMenu'
import { Details } from './ui/Details'
import { Home } from './ui/Home'
import { History, Playlists, Subscriptions } from './ui/Library'
import { Nav, type Tab } from './ui/Nav'
import { ProfilePicker } from './ui/ProfilePicker'
import { Search } from './ui/Search'
import { SignIn } from './ui/SignIn'
import { useAuth } from './yt/auth'
import { signOut } from './yt/client'
import type { Item } from './yt/types'

const fromHash = (): Item | undefined => {
  const id = /^#watch=([\w-]{11})$/.exec(location.hash)?.[1]
  return id ? { id, kind: 'video', title: '', thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` } : undefined
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [playing, setPlaying] = useState<Item | undefined>(fromHash)
  // Stack of detail pages: opening a related video pushes, Back pops.
  const [stack, setStack] = useState<Item[]>([])
  const [signingIn, setSigningIn] = useState(false)
  const [menu, setMenu] = useState(false)
  const [choosing, setChoosing] = useState<'login' | 'manual'>()
  const auth = useAuth()
  // Losing auth (401, failed refresh) must not leave the menu armed for the next sign-in.
  if (menu && !auth.signedIn) setMenu(false)
  if (choosing && !auth.signedIn) setChoosing(undefined)
  const details = stack[stack.length - 1]
  useSpatialNav(!playing)
  const open = useCallback((i: Item) => i.kind === 'video' && setStack((s) => [...s, i]), [])
  const play = useCallback((i: Item) => setPlaying(i), [])
  const close = useCallback(() => setPlaying(undefined), [])
  const goTab = useCallback((t: Tab) => {
    setStack([])
    setTab(t)
  }, [])
  const onAccount = useCallback(() => (auth.signedIn ? setMenu(true) : setSigningIn(true)), [auth.signedIn])
  const closeMenu = useCallback(() => setMenu(false), [])
  const confirmSignOut = useCallback(() => {
    void signOut()
    setMenu(false)
  }, [])
  const modal = signingIn || menu || choosing
  const closeSignIn = useCallback(() => setSigningIn(false), [])
  // A fresh login asks who is watching; the picker stays silent when the login has only one profile.
  const signedIn = useCallback(() => {
    setSigningIn(false)
    setChoosing('login')
  }, [])
  const switchAccount = useCallback(() => {
    setMenu(false)
    setChoosing('manual')
  }, [])
  const closeChoosing = useCallback(() => setChoosing(undefined), [])
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), [])

  return (
    <div className="shell">
      <Nav tab={tab} onTab={setTab} auth={auth} onAccount={onAccount} />
      <main>
        {tab === 'home' && <Home onOpen={open} onPlay={play} />}
        {tab === 'subscriptions' && <Subscriptions onOpen={open} />}
        {tab === 'playlists' && <Playlists onOpen={open} active={!details && !playing && !modal} />}
        {tab === 'history' && <History onOpen={open} />}
        {tab === 'search' && <Search onOpen={open} />}
      </main>
      {details && <Details item={details} active={!playing && !modal} onPlay={play} onOpen={open} onClose={back} onTab={goTab} />}
      {signingIn && <SignIn onClose={closeSignIn} onDone={signedIn} />}
      {choosing && auth.signedIn && <ProfilePicker silent={choosing === 'login'} onClose={closeChoosing} />}
      {menu && auth.signedIn && <AccountMenu name={auth.name} onSwitch={switchAccount} onSignOut={confirmSignOut} onClose={closeMenu} />}
      {playing && <Player item={playing} onClose={close} />}
    </div>
  )
}
