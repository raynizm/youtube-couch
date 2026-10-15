import { useCallback, useState } from 'react'
import { useSpatialNav } from './nav/useSpatialNav'
import { Player } from './player/Player'
import { Details } from './ui/Details'
import { Home } from './ui/Home'
import { History, Playlists, SignInNotice } from './ui/Library'
import { Nav, type Tab } from './ui/Nav'
import { Search } from './ui/Search'
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
  const details = stack[stack.length - 1]
  useSpatialNav(!playing)
  const open = useCallback((i: Item) => i.kind === 'video' && setStack((s) => [...s, i]), [])
  const play = useCallback((i: Item) => setPlaying(i), [])
  const close = useCallback(() => setPlaying(undefined), [])
  const goTab = useCallback((t: Tab) => {
    setStack([])
    setTab(t)
  }, [])
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), [])

  return (
    <div className="shell">
      <Nav tab={tab} onTab={setTab} user="Guest" />
      <main>
        {tab === 'home' && <Home onOpen={open} onPlay={play} />}
        {tab === 'subscriptions' && <SignInNotice what="subscriptions" />}
        {tab === 'playlists' && <Playlists onOpen={open} />}
        {tab === 'history' && <History onOpen={open} />}
        {tab === 'search' && <Search onOpen={open} />}
      </main>
      {details && <Details item={details} active={!playing} onPlay={play} onOpen={open} onClose={back} onTab={goTab} />}
      {playing && <Player item={playing} onClose={close} />}
    </div>
  )
}
