import Link from 'next/link';
import { getDevDb } from '@/src/db/client/dev';
import { researchJobs, researchRuns } from '@/src/db/schema';
import { asc, desc, inArray } from 'drizzle-orm';
import { jobDisplayState, activeAgentCount } from '@/src/services/research/display-state';
import { researchAgentPrompt, qaAgentPrompt, claimCommand } from '@/src/services/research/prompts';
import { stopRunAction, editPriorityAction, editFocusNoteAction, cancelJobAction, requeueJobAction } from '../actions';
import CopyButton from '../CopyButton';
import AutoRefresh from '../AutoRefresh';
import s from '../crm.module.css';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const originPill: Record<string, string> = { manual: s.ok, returned_correction: s.warn, frontier: s.frontier, random_discovery: '' };

export default async function QueuePage() {
  const db = getDevDb();
  let activeRun: typeof researchRuns.$inferSelect | undefined;
  let jobs: (typeof researchJobs.$inferSelect)[] = [];
  let pkgByJob = new Map<string, string>();
  try {
    const runs = await db.query.researchRuns.findMany({ where: inArray(researchRuns.status, ['active', 'stopping']), orderBy: [desc(researchRuns.startedAt)] });
    activeRun = runs[0];
    jobs = await db.query.researchJobs.findMany({ orderBy: [desc(researchJobs.priority), asc(researchJobs.sequence)], limit: 100 });
    const pkgs = await db.query.researchPackages.findMany();
    pkgByJob = new Map(pkgs.map((p) => [p.jobId, p.status]));
  } catch {
    return <p className={s.sub}>Database not migrated. Run <code>npm run db:migrate</code>.</p>;
  }
  const now = new Date();
  const agents = activeAgentCount(jobs, now);

  return (
    <div>
      <AutoRefresh />
      <Link href="/crm" className={s.back}>← Dashboard</Link>
      <h1 className={s.h}>Queue &amp; Runs</h1>
      <p className={s.sub}>Research is run MANUALLY through Claude CoWork. Opening a batch does not launch Claude. Adding a topic only creates a queued job (<b>Awaiting Agent(s)</b>); a Claude CoWork agent you start must claim it and perform the research.</p>

      {activeRun ? (
        <div className={s.card}>
          <div className={s.row}>
            <span>
              Batch <code data-testid="run-id" style={{ fontSize: '0.75rem' }}>{activeRun.id}</code>{' '}
              <CopyButton text={activeRun.id} label="Copy Run ID" testid="copy-run-id" />
            </span>
            <span className={`${s.pill} ${activeRun.status === 'stopping' ? s.hold : s.ok}`}>{activeRun.status}</span>
          </div>
          <div className={s.row}>
            <span className={s.muted}>
              limit {activeRun.batchLimit} · claimed {activeRun.claimedCount} · completed {activeRun.completedCount} ·
              failed {activeRun.failedCount} · returned {activeRun.returnedCount} · <b data-testid="active-agents">{agents} active agent(s)</b>
            </span>
            <form action={stopRunAction}>
              <input type="hidden" name="runId" value={activeRun.id} />
              <button className={`${s.btn} ${s.ghost}`} type="submit">Stop batch safely</button>
            </form>
          </div>
          <div className={s.form} style={{ marginTop: '0.5rem', gap: '0.5rem' }}>
            <CopyButton text={researchAgentPrompt(activeRun.id, activeRun.batchLimit)} label="Copy Research Agent Prompt" testid="copy-research-prompt" />
            <CopyButton text={qaAgentPrompt()} label="Copy QA Agent Prompt" testid="copy-qa-prompt" />
            <CopyButton text={claimCommand(activeRun.id)} label="Copy Claim Command" testid="copy-claim-cmd" />
          </div>
        </div>
      ) : (
        <p className={s.sub}>No active batch. Open one from the dashboard.</p>
      )}

      <h2 className={s.h}>Jobs</h2>
      <div className={s.card}>
        {jobs.length === 0 && <div className={s.empty}>Queue is empty.</div>}
        {jobs.map((j) => {
          const display = jobDisplayState(j, pkgByJob.get(j.id), now);
          // Exact claimed worker comes from claimedByWorker (never parsed from
          // the internal workerLock token).
          const worker = j.claimedByWorker ?? null;
          const leaseMs = j.leaseExpiresAt ? j.leaseExpiresAt.getTime() - now.getTime() : null;
          const leaseFresh = leaseMs != null && leaseMs > 0;
          return (
            <div key={j.id} className={s.row} data-testid={`job-${j.id}`} style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className={`${s.pill} ${originPill[j.origin] ?? ''}`}>{j.origin}</span>{' '}
                {j.centralTitle}
                <span style={{ display: 'block', marginTop: 2 }}>
                  <code data-testid={`job-id-${j.id}`} style={{ fontSize: '0.68rem', color: '#8b93a3' }}>{j.id}</code>{' '}
                  <CopyButton text={j.id} label="Copy Job ID" testid={`copy-job-${j.id}`} />
                </span>
                <span className={s.muted} style={{ fontSize: '0.7rem', display: 'block', marginTop: 2 }}>
                  pri {j.priority} · attempts {j.attemptCount}
                  {worker ? ` · worker ${worker}` : ' · worker —'}
                  {j.leaseExpiresAt ? ` · lease ${leaseFresh ? 'fresh' : 'EXPIRED'} (exp ${j.leaseExpiresAt.toISOString().slice(11, 19)}Z)` : ' · no lease'}
                  {` · last activity ${j.updatedAt.toISOString().slice(0, 19).replace('T', ' ')}Z`}
                </span>
                {(j.lastError || j.focusNote) && (
                  <span className={s.muted} style={{ fontSize: '0.7rem', display: 'block', marginTop: 2 }}>
                    {j.focusNote ? `focus: ${j.focusNote}` : ''}
                    {j.lastError ? `${j.focusNote ? ' · ' : ''}reason: ${j.lastError}` : ''}
                  </span>
                )}
                {j.status === 'queued' && (
                  <form action={editFocusNoteAction} className={s.form} style={{ gap: '0.3rem', marginTop: 3 }}>
                    <input type="hidden" name="jobId" value={j.id} />
                    <input name="focusNote" defaultValue={j.focusNote ?? ''} placeholder="focus note (editable while queued)" data-testid={`focus-${j.id}`} style={{ fontSize: '0.7rem', width: '18rem' }} />
                    <button className={`${s.btn} ${s.ghost}`} type="submit" style={{ fontSize: '0.68rem' }} data-testid={`save-focus-${j.id}`}>save note</button>
                  </form>
                )}
              </span>
              <span className={`${s.pill} ${display === 'Awaiting Agent(s)' ? s.hold : ''}`} data-testid={`job-state-${j.id}`}>{display}</span>
              {j.status === 'queued' && (
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  <form action={editPriorityAction} style={{ display: 'inline-flex', gap: 2 }}>
                    <input type="hidden" name="jobId" value={j.id} />
                    <input name="priority" type="number" min={0} max={100} defaultValue={j.priority} style={{ width: '3.4rem', fontSize: '0.72rem' }} />
                    <button className={`${s.btn} ${s.ghost}`} type="submit" style={{ fontSize: '0.68rem' }}>set pri</button>
                  </form>
                  <form action={cancelJobAction}><input type="hidden" name="jobId" value={j.id} /><button className={`${s.btn} ${s.ghost}`} type="submit" style={{ fontSize: '0.68rem' }}>cancel</button></form>
                </span>
              )}
              {['failed', 'returned', 'cancelled'].includes(j.status) && (
                <form action={requeueJobAction}><input type="hidden" name="jobId" value={j.id} /><button className={`${s.btn} ${s.ghost}`} type="submit" style={{ fontSize: '0.68rem' }}>requeue</button></form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
