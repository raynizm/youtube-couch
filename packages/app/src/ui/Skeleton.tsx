import { MetaLabels } from './MetaLabels'

// Hidden text that takes the exact space of the real text and shows as a skeleton block, so nothing shifts when the content arrives.
export function Ink({ children }: { children: string }) {
  return <span className="skel-ink">{children}</span>
}

export function RowsSkeleton({ rows, spoken = false, avatars = false }: { rows: { title: string; labels: boolean }[]; spoken?: boolean; avatars?: boolean }) {
  return (
    <div className="skel-ghost" aria-hidden>
      {rows.map((r) => (
        <section key={r.title} className="row">
          <div className="row-head">
            <h2>
              {avatars && <span className="skel row-avatar" />}
              <Ink>{r.title}</Ink>
            </h2>
          </div>
          <div className="row-items">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="card">
                <div className="skel card-img" />
                {r.labels ? (
                  <>
                    <span className="card-title one-line">
                      <Ink>Placeholder video title</Ink>
                    </span>
                    <span className="card-labels">
                      <MetaLabels text="12:34 · 3 weeks ago" spoken={spoken} />
                    </span>
                  </>
                ) : (
                  <>
                    <span className="card-title">
                      <Ink>Placeholder related video title that runs onto a second line</Ink>
                    </span>
                    <span className="card-sub">
                      <Ink>Channel name · 1.2M views</Ink>
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}


/** Placeholder cards for a grid screen; `stack` draws the stacked-thumbnail look of playlists, `labels` the channel and duration row of video cards. */
export function GridSkeleton({ stack = false, labels = false, count = 12 }: { stack?: boolean; labels?: boolean; count?: number }) {
  return (
    <div className="grid skel-ghost" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card">
          <span className={stack ? 'card-stack' : 'card-wrap'}>
            <div className="skel card-img" />
          </span>
          {labels ? (
            <>
              <span className="card-title one-line">
                <Ink>Placeholder video title</Ink>
              </span>
              <span className="card-labels">
                <span className="card-channel">
                  <Ink>Channel name</Ink>
                </span>
                <MetaLabels text="12:34" spoken />
              </span>
            </>
          ) : (
            <>
              <span className="card-title one-line">
                <Ink>Placeholder playlist title</Ink>
              </span>
              <span className="card-sub">
                <Ink>Channel name</Ink>
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
