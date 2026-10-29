import { MetaLabels } from './MetaLabels'

// Hidden text that takes the exact space of the real text and shows as a skeleton block, so nothing shifts when the content arrives.
export function Ink({ children }: { children: string }) {
  return <span className="skel-ink">{children}</span>
}

export function RowsSkeleton({ rows }: { rows: { title: string; labels: boolean }[] }) {
  return (
    <div className="skel-ghost" aria-hidden>
      {rows.map((r) => (
        <section key={r.title} className="row">
          <div className="row-head">
            <h2>
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
                      <MetaLabels text="12:34 · 3 weeks ago" />
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

