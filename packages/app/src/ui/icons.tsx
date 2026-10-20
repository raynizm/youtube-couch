import type { ReactNode } from 'react'

const svg = (d: ReactNode, fill = false) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
)

export const HomeIcon = () => svg(<><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></>)
export const UsersIcon = () => svg(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>)
export const ListIcon = () => svg(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />)
export const HistoryIcon = () => svg(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>)
export const LibraryIcon = () => svg(<><path d="M4 4v16M9 4v16M14 6l5 14" /></>)
export const SearchIcon = () => svg(<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>)
export const PlayIcon = () => svg(<path d="M6 4v16l14-8z" />)
export const BookmarkIcon = ({ filled }: { filled?: boolean }) => svg(<path d="M6 3h12v18l-6-4-6 4z" />, filled)
export const ChevronLeft = () => svg(<path d="m15 18-6-6 6-6" />)
export const ChevronRight = () => svg(<path d="m9 18 6-6-6-6" />)
export const ArrowLeft = () => svg(<path d="M19 12H5m7-7-7 7 7 7" />)
export const ArrowRight = () => svg(<path d="M5 12h14m-7-7 7 7-7 7" />)
export const PauseIcon = () => svg(<path d="M7 4v16M17 4v16" />)
export const Back10Icon = () => svg(<><path d="M3 12a9 9 0 1 1 3 6.7" /><path d="M3 5v7h7" /></>)
export const Fwd10Icon = () => svg(<><path d="M21 12a9 9 0 1 0-3 6.7" /><path d="M21 5v7h-7" /></>)
export const SubtitlesIcon = () => svg(<><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M7 11h3M13 11h4M7 15h5M15 15h2" /></>)
export const EyeIcon = () => svg(<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>)
export const CheckCircleIcon = () => svg(<><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16 9.5" /></>)
export const ClockIcon = () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>)
export const BellIcon = ({ filled }: { filled?: boolean }) => svg(<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9zM10.3 21a1.9 1.9 0 0 0 3.4 0" />, filled)
export const UserPlusIcon = () => svg(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" /></>)
export const UserCheckIcon = () => svg(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 11.5l2 2 4-4" /></>)
export const Logo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2C7 2 3 5.6 3 10c0 2 .8 3.8 2.2 5.2L4 22l5-2.7c.9.2 1.9.3 3 .3 5 0 9-3.6 9-8s-4-9.6-9-9.6z" />
  </svg>
)
export const UploadIcon = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />)
