import { isViewCount } from './cardSub'
import { ClockIcon, UploadIcon } from './icons'

export const DURATION = /^\d+(:\d{2}){1,2}$/

/** "4:17" becomes "4 min 17 sec"; hours are folded into minutes, so "1:07:28" becomes "67 min 28 sec". */
export function spokenDuration(d: string): string {
  const [sec, min, hr = 0] = d.split(':').map(Number).reverse()
  return `${hr * 60 + min} min ${sec} sec`
}

/** Duration and upload date from a "1.3M views · 8 hours ago · 4:17" style string, as label pills; everything else is left out. */
export function MetaLabels({ text, spoken = false, upload = true }: { text: string; spoken?: boolean; upload?: boolean }) {
  const parts = text.split(' · ')
  const duration = parts.find((m) => DURATION.test(m))
  const uploaded = parts.find((m) => /\bago\b/i.test(m) && !isViewCount(m))
  return (
    <>
      {duration && (
        <span className="hero-label">
          <ClockIcon /> {spoken ? spokenDuration(duration) : duration}
        </span>
      )}
      {upload && uploaded && (
        <span className="hero-label upload">
          <UploadIcon /> {uploaded}
        </span>
      )}
    </>
  )
}
