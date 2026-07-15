import Link from 'next/link';
import { getDevDb } from '@/src/db/client/dev';
import { getPackageDetail } from '@/src/db/queries/crm';
import { projectPackageGraph } from '@/src/services/research/graph-projection';
import { getRelationshipVocabulary } from '@/src/services/research/vocabulary';
import { qaIsStale, listPackageRevisions } from '@/src/services/research/edit';
import { decisionAction } from '../../actions';
import s from '../../crm.module.css';
import PackageStudio from './studio/PackageStudio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function payload(p: unknown): Record<string, unknown> {
  return (p ?? {}) as Record<string, unknown>;
}

export default async function PackageReview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  // Developer mode is an EXPLICIT server-side input (?dev=1). It is the only way
  // synthetic candidates enter the projection; a client control can never
  // reveal data the server did not authorize.
  const devMode = sp.dev === '1' || sp.dev === 'true';
  const db = getDevDb();
  const detail = await getPackageDetail(db, id).catch(() => undefined);
  if (!detail) return <p className={s.sub}>Package not found.</p>;
  const { package: pkg, sections, decisions } = detail;
  const graph = await projectPackageGraph(db, id, { includeSynthetic: devMode });
  const vocabulary = await getRelationshipVocabulary(db);
  // The canonical match picker searches server-side on demand (non-synthetic,
  // kind-compatible, scalable) — no bulk row preload here.
  const qaInvalidated = await qaIsStale(db, id);
  const revisions = await listPackageRevisions(db, id);
  const decided = ['approved', 'approved_with_holds', 'returned', 'marked_duplicate', 'rejected', 'promoted'].includes(pkg.status);
  const central = sections.entity.find((e) => payload(e.payload).role === 'central');

  const allItems = [
    ...sections.entity, ...sections.time, ...sections.relationship, ...sections.claim,
    ...sections.source, ...sections.media, ...sections.question, ...sections.next_entity,
  ].map((i) => ({ id: i.id, itemId: i.id, section: i.section, localRef: i.localRef, payload: payload(i.payload) }));

  return (
    <div>
      <Link href="/crm" className={s.back}>← Dashboard</Link>
      <h1 className={s.h}>{pkg.centralLabel}</h1>
      <p className={s.sub}>
        <span data-testid="pkg-status" className={`${s.pill} ${pkg.status === 'promoted' ? s.ok : ''}`}>{pkg.status}</span>{' '}
        <span className={`${s.pill} ${s.warn}`}>private — not published</span>{' '}
        central match: {central ? String(central.matchStatus ?? '—') : '—'}
        {pkg.status === 'promoted' && pkg.promotedEntityId && <> · <Link href={`/crm/entities/${pkg.centralSlug}`}>view canonical record →</Link></>}
      </p>

      {graph ? (
        <PackageStudio graph={graph as never} items={allItems} vocabulary={vocabulary as never} devMode={devMode} packageId={id} packageStatus={pkg.status} qaInvalidated={qaInvalidated} />
      ) : (
        <p className={s.sub}>No graph could be projected for this package.</p>
      )}

      {/* Package-level decision (final action, package-level even with per-item holds) */}
      {!decided ? (
        <div className={s.card} style={{ marginTop: '0.9rem' }}>
          <h2 className={s.h} style={{ marginTop: 0 }}>Package decision</h2>
          <p className={s.muted} style={{ marginTop: '-0.3rem' }}>
            Holds are set per node/edge in the graph inspector. One decision applies to the whole package.
            Approval promotes accepted material into the PRIVATE canonical graph — it does not publish.
          </p>
          {qaInvalidated && <p className={`${s.pill} ${s.hold}`}>Approval blocked: re-run QA after edits.</p>}
          <form action={decisionAction} className={s.form}>
            <input type="hidden" name="packageId" value={id} />
            <input name="instructions" placeholder="return instructions" style={{ fontSize: '0.8rem' }} />
            <input name="reason" placeholder="rejection reason" style={{ fontSize: '0.8rem' }} />
            <input name="duplicateOfSlug" placeholder="duplicate-of slug" style={{ fontSize: '0.8rem' }} />
            <button className={s.btn} name="decision" value="approve" type="submit">Approve as submitted</button>
            <button className={s.btn} name="decision" value="approve_with_holds" type="submit" data-testid="approve-holds">Approve, exclude held</button>
            <button className={`${s.btn} ${s.ghost}`} name="decision" value="return" type="submit">Return</button>
            <button className={`${s.btn} ${s.ghost}`} name="decision" value="mark_duplicate" type="submit">Mark duplicate</button>
            <button className={`${s.btn} ${s.danger}`} name="decision" value="reject" type="submit">Reject</button>
          </form>
        </div>
      ) : (
        <div className={s.card} data-testid="decision-recorded" style={{ marginTop: '0.9rem' }}>
          <b>Decision recorded.</b>{' '}
          {decisions[0] && <span className={s.muted}>{decisions[0].decision} by {decisions[0].reviewer ?? '—'}</span>}
          {pkg.status === 'marked_duplicate' && (
            <p className={s.muted} data-testid="duplicate-target" style={{ marginTop: '0.5rem' }}>
              Marked as a duplicate of <b>{String((decisions[0]?.decisionSnapshot as { duplicateOfSlug?: string } | undefined)?.duplicateOfSlug ?? '—')}</b>.
              {' '}— This package&rsquo;s subject was not promoted. The duplicate was recorded, but no entities or relationships were merged.
            </p>
          )}
        </div>
      )}

      <details style={{ marginTop: '0.9rem' }}>
        <summary className={s.muted} style={{ cursor: 'pointer' }}>Edit history ({revisions.length})</summary>
        <div className={s.card}>
          {revisions.length === 0 && <div className={s.empty}>No edits yet.</div>}
          {revisions.map((r) => (
            <div key={r.id} className={s.itemline}>
              <span className={s.ref}>{r.editKind}</span>
              <span style={{ flex: 1 }} className={s.muted}>{r.editor} · {r.createdAt.toISOString().slice(0, 19).replace('T', ' ')}{r.invalidatedQa ? ' · invalidated QA' : ''}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
