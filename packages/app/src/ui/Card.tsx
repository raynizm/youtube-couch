import { memo } from 'react'
import type { Item } from '../yt/types'
import { cardSub } from './cardSub'
import { PlayIcon } from './icons'
import { MetaLabels } from './MetaLabels'

type Props = { item: Item; onOpen: (i: Item) => void; onPreview?: (i: Item) => void; progress?: number; subtitle?: string; labels?: boolean }

export const Card = memo(function Card({ item, onOpen, onPreview, progress, subtitle, labels }: Props) {
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
      {labels ? (
        <>
          <span className="card-title one-line">{item.title}</span>
          <span className="card-labels">
            <MetaLabels text={item.meta ?? ''} />
          </span>
        </>
      ) : (
        <>
          <span className="card-title">{item.title}</span>
          <span className="card-sub">{subtitle ?? cardSub(item)}</span>
        </>
      )}
    </button>
  )
})
