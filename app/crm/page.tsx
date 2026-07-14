import Link from 'next/link';
import { getDevDb } from '@/src/db/client/dev';
import { entities, relationships, researchPackages, researchRuns } from '@/src/db/schema';
import { desc, eq } from 'drizzle-orm';
import { activeAgentCount } from '@/src/services/research/display-state';
import { createRunAction, manualCaptureAction } from './actions';
import AutoRefresh from './AutoRefresh';
import s from './crm.module.css';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ captured?: string; dev?: string }> }) {
  const { captured, dev } = await searchParams;
  const showDev = dev === '1';
  const db = getDevDb();
  try {
    const now = new Date();
    const [jobs, pkgs, runs, canonical, rels] = await Promise.all([
      db.query.researchJobs.findMany(),
      db.query.researchPackages.findMany({ orderBy: [desc(researchPackages.submittedAt)] }),
      db.query.researchRuns.findMany({ orderBy: [desc(researchRuns.startedAt)], limit: 5 }),
      db.select().from(entities).where(eq(entities.isSynthetic, false)),
      db.select().from(relationships).where(eq(relationships.isSynthetic, false)),
    ]);
    const activeRun = runs.find((r) => r.status === 'active' || r.status === 'stopping');
    const awaitingAgents = jobs.filter((j) => j.status === 'queued').length;
    const agents = activeAgentCount(jobs, now);
    const awaitingQa = pkgs.filter((p) => ['submitted', 'qa_pending'].includes(p.status));
    const readyForReview = pkgs.filter((p) => ['qa_complete', 'in_review'].includes(p.status));
    const returned = pkgs.filter((p) => p.status === 'returned');
    const failedJobs = jobs.filter((j) => j.status === 'failed');
    const promotions = pkgs.filter((p) => p.status === 'promoted').slice(0, 8);
    const queuedByOrigin = (o: string) => jobs.filter((j) => j.status === 'queued' && j.origin === o).length;

    return (
      <div>
        <AutoRefresh />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h1 className={s.h}>Research Studio</h1>
          <span className={`${s.pill} ${s.warn}`}>internal · private · not published</span>
        </div>
        <p className={s.sub}>Candidate research → private canonical graph. Approval promotes into the private graph; it does not publish to the public experience.</p>
        {captured && (
          <div className={s.card}>
            {captured === 'queued' && 'Topic queued as Awaiting Agent(s).'}
            {captured === 'already_queued' && 'Already queued — no duplicate created.'}
            {captured === 'already_canonical' && 'Already a sufficiently-complete canonical entity — skipped.'}
          </div>
        )}

        <div className={s.grid}>
          <Stat n={awaitingAgents} l="Awaiting Agent(s)" />
          <Stat n={agents} l="active agents" />
          <Stat n={queuedByOrigin('frontier')} l="frontier queued" />
          <Stat n={awaitingQa.length} l="awaiting QA" />
          <Stat n={readyForReview.length} l="ready for review" />
          <Stat n={returned.length} l="returned" />
          <Stat n={failedJobs.length} l="failed jobs" />
          <Stat n={canonical.length} l="canonical entities" />
          <Stat n={rels.length} l="canonical relationships" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '0.9rem', marginTop: '0.4rem' }}>
          <div>
            <h2 className={s.h}>Open a research batch</h2>
            <div className={s.card}>
              {activeRun ? (
                <div className={s.row}>
                  <span>Batch active · limit {activeRun.batchLimit} · {agents} agent(s) · <span className={`${s.pill} ${s.ok}`}>{activeRun.status}</span></span>
                  <Link href="/crm/queue" className={s.btn} style={{ textDecoration: 'none' }}>Queue &amp; Runs →</Link>
                </div>
              ) : (
                <form action={createRunAction} className={s.form}>
                  <div className={s.field}><label>Batch limit</label><input name="batchLimit" type="number" min={1} defaultValue={5} style={{ width: '6rem' }} /></div>
                  <button className={s.btn} type="submit">Open research batch</button>
                  <span className={s.muted} style={{ fontSize: '0.72rem' }}>Opening a batch does not launch Claude.</span>
                </form>
              )}
            </div>

            <h2 className={s.h}>Capture a topic</h2>
            <div className={s.card}>
              <form action={manualCaptureAction} className={s.form}>
                <div className={s.field}><label>Title</label><input name="title" placeholder="e.g. Toothpaste" /></div>
                <div className={s.field}><label>or URL</label><input name="url" placeholder="https://…" /></div>
                <div className={s.field}><label>Focus note</label><input name="focusNote" placeholder="optional" /></div>
                <div className={s.field}><label>Priority</label><input name="priority" type="number" min={0} max={100} defaultValue={0} style={{ width: '5rem' }} /></div>
                <button className={s.btn} type="submit">Add — becomes Awaiting Agent(s)</button>
              </form>
            </div>
          </div>

          <div>
            <h2 className={s.h}>Ready for review</h2>
            <div className={s.card}>
              {readyForReview.length === 0 && awaitingQa.length === 0 && <div className={s.empty}>Nothing waiting.</div>}
              {[...readyForReview, ...awaitingQa].map((p) => (
                <div key={p.id} className={s.row}>
                  <Link href={`/crm/packages/${p.id}`}>{p.centralLabel}</Link>
                  <span className={`${s.pill} ${['qa_complete', 'in_review'].includes(p.status) ? s.ok : s.hold}`}>{p.status}</span>
                </div>
              ))}
            </div>

            {returned.length > 0 && (<><h2 className={s.h}>Returned</h2><div className={s.card}>
              {returned.map((p) => <div key={p.id} className={s.row}><Link href={`/crm/packages/${p.id}`}>{p.centralLabel}</Link><span className={`${s.pill} ${s.warn}`}>returned</span></div>)}
            </div></>)}

            <h2 className={s.h}>Recent canonical promotions <span className={s.muted} style={{ fontSize: '0.7rem' }}>(private)</span></h2>
            <div className={s.card}>
              {promotions.length === 0 && <div className={s.empty}>No promotions yet.</div>}
              {promotions.map((p) => (
                <div key={p.id} className={s.row}>
                  <Link href={`/crm/entities/${p.centralSlug}`}>{p.centralLabel}</Link>
                  <span className={s.muted}>private canonical · {p.promotedAt?.toISOString().slice(0, 10)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={s.row} style={{ marginTop: '1rem' }}>
          <span className={s.muted} style={{ fontSize: '0.75rem' }}>
            <Link href="/crm/vocabulary" className={s.back}>Vocabulary →</Link> ·{' '}
            <Link href="/crm/queue" className={s.back}>Queue &amp; Runs →</Link>
            {showDev ? <> · <Link href="/crm" className={s.back}>hide dev fixtures</Link></> : <> · <Link href="/crm?dev=1" className={s.back}>show dev fixtures</Link></>}
          </span>
        </div>
      </div>
    );
  } catch {
    return (
      <div>
        <h1 className={s.h}>Research Studio</h1>
        <p className={s.sub}>Database not migrated yet. Run <code>npm run db:migrate</code> then <code>npm run db:seed:research</code>.</p>
      </div>
    );
  }
}

function Stat({ n, l }: { n: number; l: string }) {
  return (<div className={s.stat}><div className={s.n}>{n}</div><div className={s.l}>{l}</div></div>);
}
