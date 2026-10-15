import { HistoryIcon, HomeIcon, ListIcon, SearchIcon, UsersIcon } from './icons'

export type Tab = 'home' | 'subscriptions' | 'playlists' | 'history' | 'search'

const TABS = [
  { id: 'home', label: 'Home', icon: <HomeIcon /> },
  { id: 'subscriptions', label: 'Subscriptions', icon: <UsersIcon /> },
  { id: 'playlists', label: 'Playlists', icon: <ListIcon /> },
  { id: 'history', label: 'History', icon: <HistoryIcon /> },
] as const

type Auth = { signedIn: boolean; name?: string; avatar?: string }

export function Nav({ tab, onTab, auth, onAccount }: { tab: Tab; onTab: (t: Tab) => void; auth: Auth; onAccount: () => void }) {
  return (
    <header className="nav">
      <div className="nav-pill">
        {TABS.map((t) => (
          <button key={t.id} data-focusable className={tab === t.id ? 'active' : ''} onClick={() => onTab(t.id)}>
            {t.icon}
            {t.label}
          </button>
        ))}
        <button data-focusable className={tab === 'search' ? 'active' : ''} aria-label="Search" onClick={() => onTab('search')}>
          <SearchIcon />
        </button>
        <button data-focusable className="nav-user" onClick={onAccount}>
          {auth.signedIn && auth.avatar ? <img className="nav-avatar" src={auth.avatar} alt="" /> : <span className="avatar" />}
          {auth.signedIn ? auth.name || 'Account' : 'Sign in'}
        </button>
      </div>
    </header>
  )
}
