import { memo } from 'react'
import type { Item } from '../yt/types'
import { cardSub } from './cardSub'
import { PlayIcon } from './icons'

type Props = { item: Item; onOpen: (i: Item) => void; onPreview?: (i: Item) => void; progress?: number; subtitle?: string }

export const Card = memo(function Card({ item, onOpen, onPreview, progress, subtitle }: Props) {
  return (
    <button
      className="card"
      data-focusable
      onClick={() => onOpen(item)}
      onMouseEnter={() => onPreview?.(item)}
      onFocus={() => onPreview?.(item)}
    >
      <span className="card-img">
        <img src={item.thumb} alt="" loading="lazy" />
        <span className="card-play">
          <PlayIcon />
        </span>
        {progress !== undefined && (
          <span className="card-progress">
            <span style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </span>
        )}
      </span>
      <span className="card-title">{item.title}</span>
      <span className="card-sub">{subtitle ?? cardSub(item)}</span>
    </button>
  )
})
