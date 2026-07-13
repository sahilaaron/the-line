import Link from 'next/link';
import { getDevDb } from '@/src/db/client/dev';
import { getDashboard } from '@/src/db/queries/crm';
import { createRunAction, stopRunAction, manualCaptureAction } from './actions';
import s from './crm.module.css';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Dashboard() {
  const db = getDevDb();
  let data: Awaited<ReturnType<typeof getDashboard>> | null = null;
  try {
    data = await getDashboard(db);
  } catch {
    return (
      <div>
        <h1 className={s.h}>Research Control</h1>
        <p className={s.sub}>
          Database not migrated yet. Run <code>npm run db:migrate</code> then{' '}
          <code>npm run db:seed:research</code> to load the Steam Engine demo.
        </p>
      </div>
    );
  }
  const activeRun = data.runs.find((r) => r.status === 'active' || r.status === 'stopping');

  return (
    <div>
      <h1 className={s.h}>Research Control</h1>
      <p className={s.sub}>Candidate research → private canonical graph. Publication stays a separate step.</p>

      <div className={s.grid}>
        <Stat n={sum(data.jobsByStatus)} l="jobs total" />
        <Stat n={data.queuedByOrigin['manual'] ?? 0} l="manual queued" />
        <Stat n={data.queuedByOrigin['frontier'] ?? 0} l="frontier queued" />
        <Stat n={data.queuedByOrigin['random_discovery'] ?? 0} l="random queued" />
        <Stat n={data.awaitingQa.length} l="awaiting QA" />
        <Stat n={data.awaitingReview.length} l="awaiting review" />
      </div>

      <h2 className={s.h}>Start a run</h2>
      <div className={s.card}>
        {activeRun ? (
          <div className={s.row}>
            <span>
              Run active · batch limit {activeRun.batchLimit} · claimed {activeRun.claimedCount} ·
              completed {activeRun.completedCount}{' '}
              <span className={`${s.pill} ${activeRun.status === 'stopping' ? s.hold : s.ok}`}>{activeRun.status}</span>
            </span>
            <form action={stopRunAction}>
              <input type="hidden" name="runId" value={activeRun.id} />
              <button className={`${s.btn} ${s.ghost}`} type="submit">Stop run safely</button>
            </form>
          </div>
        ) : (
          <form action={createRunAction} className={s.form}>
            <div className={s.field}>
              <label>Batch limit</label>
              <input name="batchLimit" type="number" min={1} defaultValue={5} style={{ width: '6rem' }} />
            </div>
            <button className={s.btn} type="submit">Start run</button>
          </form>
        )}
      </div>

      <h2 className={s.h}>Capture a topic</h2>
      <div className={s.card}>
        <form action={manualCaptureAction} className={s.form}>
          <div className={s.field}><label>Title</label><input name="title" placeholder="e.g. Spinning jenny" /></div>
          <div className={s.field}><label>or URL</label><input name="url" placeholder="https://en.wikipedia.org/…" /></div>
          <div className={s.field}><label>Focus note</label><input name="focusNote" placeholder="optional" /></div>
          <div className={s.field}><label>Priority</label><input name="priority" type="number" min={0} max={100} defaultValue={0} style={{ width: '5rem' }} /></div>
          <button className={s.btn} type="submit">Add to queue</button>
        </form>
      </div>

      <h2 className={s.h}>Packages awaiting review</h2>
      <div className={s.card}>
        {data.awaitingReview.length === 0 && data.awaitingQa.length === 0 && <div className={s.empty}>Nothing waiting.</div>}
        {[...data.awaitingReview, ...data.awaitingQa].map((p) => (
          <div key={p.id} className={s.row}>
            <Link href={`/crm/packages/${p.id}`}>{p.centralLabel}</Link>
            <span className={`${s.pill} ${p.status === 'qa_complete' ? s.ok : s.hold}`}>{p.status}</span>
          </div>
        ))}
      </div>

      <h2 className={s.h}>Recent canonical promotions</h2>
      <div className={s.card}>
        {data.promotions.length === 0 && <div className={s.empty}>No promotions yet.</div>}
        {data.promotions.map((p) => (
          <div key={p.id} className={s.row}>
            <Link href={`/crm/entities/${p.centralSlug}`}>{p.centralLabel}</Link>
            <span className={s.muted}>private canonical · {p.promotedAt?.toISOString().slice(0, 10)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div className={s.stat}>
      <div className={s.n}>{n}</div>
      <div className={s.l}>{l}</div>
    </div>
  );
}
function sum(rec: Record<string, number>): number {
  return Object.values(rec).reduce((a, b) => a + b, 0);
}
