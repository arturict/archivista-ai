import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileText, MessageSquareText } from 'lucide-react';
import { requireUser } from '@/lib/server/auth';
import { workspaceFor } from '@/lib/server/workspace';
import * as actionSync from '@root/services/actionSyncService';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Document source' };

function plain(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Not set';
  return String(value);
}

export default async function DocumentSourcePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const workspace = workspaceFor(user);
  const rawId = Number((await params).id);
  if (!Number.isSafeInteger(rawId) || rawId <= 0) notFound();

  let document: Record<string, unknown>;
  try {
    document = await actionSync.getPaperlessDocument(workspace.householdId, workspace.memberId, rawId);
  } catch {
    notFound();
  }

  const title = String(document.title || `Document #${rawId}`);
  const content = String(document.content || '').trim();
  const tagIds = Array.isArray(document.tags) ? document.tags.map(String) : [];

  return <div className="page document-source-page">
    <header className="page-head">
      <div>
        <p className="eyebrow">Paperless source · Document #{rawId}</p>
        <h1>{title}</h1>
        <p className="lede">Read-only OCR and metadata from the Paperless account linked to this workspace.</p>
      </div>
      <div className="workspace-actions">
        <Link className="button" href="/documents"><ArrowLeft aria-hidden="true" /> Documents</Link>
        <Link className="button primary" href="/companion"><MessageSquareText aria-hidden="true" /> Ask Tagvico</Link>
      </div>
    </header>

    <section className="document-source-layout">
      <article className="workspace-card document-source-content">
        <div className="workspace-card-head">
          <div><p className="eyebrow">Source text</p><h2>OCR preview</h2></div>
          <FileText aria-hidden="true" />
        </div>
        {content
          ? <pre>{content}</pre>
          : <div className="empty"><h2>No OCR text is available</h2><p>Verify the original in Paperless if this source is image-only.</p></div>}
      </article>

      <aside className="workspace-card document-source-metadata">
        <div className="workspace-card-head"><div><p className="eyebrow">Paperless metadata</p><h2>Source details</h2></div></div>
        <dl>
          <div><dt>Document ID</dt><dd>#{rawId}</dd></div>
          <div><dt>Created</dt><dd>{plain(document.created)}</dd></div>
          <div><dt>Modified</dt><dd>{plain(document.modified)}</dd></div>
          <div><dt>Correspondent ID</dt><dd>{plain(document.correspondent)}</dd></div>
          <div><dt>Document type ID</dt><dd>{plain(document.document_type)}</dd></div>
          <div><dt>Tag IDs</dt><dd>{tagIds.length ? tagIds.join(', ') : 'None'}</dd></div>
        </dl>
        <p className="workspace-muted">This view is read-only. It does not expose credentials or provider payloads.</p>
      </aside>
    </section>
  </div>;
}
