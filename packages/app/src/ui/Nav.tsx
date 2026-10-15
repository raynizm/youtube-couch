import { HistoryIcon, HomeIcon, ListIcon, SearchIcon, UsersIcon } from './icons'

export type Tab = 'home' | 'subscriptions' | 'playlists' | 'history' | 'search'

const TABS = [
  { id: 'home', label: 'Home', icon: <HomeIcon /> },
  { id: 'subscriptions', label: 'Subscriptions', icon: <UsersIcon /> },
  { id: 'playlists', label: 'Playlists', icon: <ListIcon /> },
  { id: 'history', label: 'History', icon: <HistoryIcon /> },
] as const

export function Nav({ tab, onTab, user }: { tab: Tab; onTab: (t: Tab) => void; user: string }) {
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
        <span className="nav-user">
          <span className="avatar" />
          {user}
        </span>
      </div>
    </header>
  )
}
