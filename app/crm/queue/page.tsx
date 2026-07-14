import Link from 'next/link';
import { getDevDb } from '@/src/db/client/dev';
import { getQueueView } from '@/src/db/queries/crm';
import { stopRunAction } from '../actions';
import s from '../crm.module.css';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const originPill: Record<string, string> = { manual: s.ok, returned_correction: s.warn, frontier: s.frontier, random_discovery: '' };

export default async function QueuePage() {
  const db = getDevDb();
  let data: Awaited<ReturnType<typeof getQueueView>>;
  try {
    data = await getQueueView(db);
  } catch {
    return <p className={s.sub}>Database not migrated. Run <code>npm run db:migrate</code>.</p>;
  }
  return (
    <div>
      <Link href="/crm" className={s.back}>← Dashboard</Link>
      <h1 className={s.h}>Queue &amp; Runs</h1>
      {data.activeRun ? (
        <div className={s.card}>
          <div className={s.row}>
            <span>
              Run <span className={s.muted}>{data.activeRun.id.slice(0, 8)}</span> · limit {data.activeRun.batchLimit} ·
              claimed {data.activeRun.claimedCount} · completed {data.activeRun.completedCount} · returned {data.activeRun.returnedCount}{' '}
              <span className={`${s.pill} ${data.activeRun.status === 'stopping' ? s.hold : s.ok}`}>{data.activeRun.status}</span>
            </span>
            <form action={stopRunAction}>
              <input type="hidden" name="runId" value={data.activeRun.id} />
              <button className={`${s.btn} ${s.ghost}`} type="submit">Stop safely</button>
            </form>
          </div>
        </div>
      ) : (
        <p className={s.sub}>No active run. Start one from the dashboard.</p>
      )}

      <h2 className={s.h}>Jobs</h2>
      <div className={s.card}>
        {data.jobs.length === 0 && <div className={s.empty}>Queue is empty.</div>}
        {data.jobs.map((j) => (
          <div key={j.id} className={s.row}>
            <span>
              <span className={`${s.pill} ${originPill[j.origin] ?? ''}`}>{j.origin}</span>{' '}
              {j.centralTitle}
              {j.focusNote && <span className={s.muted}> — {j.focusNote}</span>}
            </span>
            <span className={s.muted}>
              {j.matchStatus ? `${j.matchStatus} · ` : ''}
              <span className={s.pill}>{j.status}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
