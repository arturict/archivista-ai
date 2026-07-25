export function WorkspacePageSkeleton({
  kind = 'table'
}: {
  kind?: 'dashboard' | 'table';
}) {
  return <div className="page workspace-page-skeleton" aria-busy="true" aria-label="Loading page">
    <header className="skeleton-head">
      <span className="skeleton-eyebrow" />
      <span className="skeleton-title" />
      <span className="skeleton-copy" />
    </header>
    {kind === 'dashboard' ? <>
      <div className="skeleton-grid">
        {Array.from({ length: 4 }, (_, index) => <article className="skeleton-card" key={index}>
          <span className="skeleton-card-label" />
          <span className="skeleton-card-value" />
          <span className="skeleton-card-copy" />
        </article>)}
      </div>
      <div className="skeleton-grid">
        {Array.from({ length: 4 }, (_, index) => <article className="skeleton-card skeleton-card-detail" key={index}>
          <span className="skeleton-card-label" />
          <span className="skeleton-card-line" />
          <span className="skeleton-card-line is-short" />
        </article>)}
      </div>
    </> : <>
      <div className="skeleton-toolbar">
        <span />
        <span />
      </div>
      <div className="skeleton-table">
        {Array.from({ length: 7 }, (_, index) => <div className="skeleton-row" key={index}>
          <span className="skeleton-row-check" />
          <span className="skeleton-row-title" />
          <span className="skeleton-row-tags" />
          <span className="skeleton-row-meta" />
          <span className="skeleton-row-action" />
        </div>)}
      </div>
    </>}
  </div>;
}
