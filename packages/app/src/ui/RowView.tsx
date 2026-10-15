import { useRef } from 'react'
import type { Item } from '../yt/types'
import { Card } from './Card'
import { ChevronLeft, ChevronRight } from './icons'

export type CardInfo = { item: Item; progress?: number; subtitle?: string }

type RowProps = { title: string; cards: CardInfo[]; onOpen: (i: Item) => void; onPreview?: (i: Item) => void }

export function RowView({ title, cards, onOpen, onPreview }: RowProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const by = (dir: number) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: 'smooth' })
  return (
    <section className="row">
      <div className="row-head">
        <h2>{title}</h2>
        <div className="row-arrows">
          <button className="icon-btn" aria-label="Previous" tabIndex={-1} onClick={() => by(-1)}>
            <ChevronLeft />
          </button>
          <button className="icon-btn" aria-label="Next" tabIndex={-1} onClick={() => by(1)}>
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="row-items" ref={scroller}>
        {cards.map((c) => (
          <Card key={c.item.id} {...c} onOpen={onOpen} onPreview={onPreview} />
        ))}
      </div>
    </section>
  )
}
