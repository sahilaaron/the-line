/**
 * External-agent boundary CLI. A manually-launched Claude CoWork session uses
 * THESE commands (no Anthropic API billing) to participate in the daily flow:
 *
 *   npm run research:agent -- create-run --limit 5
 *   npm run research:agent -- claim --run <runId> [--worker cowork]
 *   npm run research:agent -- submit --job <jobId> --file package.json
 *   npm run research:agent -- qa --package <pkgId> --file qa.json
 *   npm run research:agent -- status
 *
 * A research session may READ jobs and WRITE packages; a QA session may READ a
 * package and WRITE qa results. Neither may promote or touch public curation —
 * only a human decision in the CRM promotes into the private canonical graph.
 */
import fs from 'node:fs';
import { getDevClient, getDevDb, closeDevClient } from '../db/client/dev';
import { createRun } from '../services/research/run';
import { claimNextJob } from '../services/research/queue';
import { submitPackage } from '../services/research/submit';
import { recordQa } from '../services/research/qa';
import { countJobsByStatus, countOpenJobsByOrigin, listPackagesByStatus } from '../db/repositories/research';
import { deterministicDiscoveryAdapter } from '../services/research/discovery';
import { activeRuns, claimNextForActiveRun, beginJob, heartbeatJob, releaseJob, failJob } from '../services/research/queue-admin';
import { jobDisplayState, activeAgentCount } from '../services/research/display-state';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const cmd = process.argv[2];
  await getDevClient().waitReady;
  const db = getDevDb();

  switch (cmd) {
    case 'create-run': {
      const limit = Number(arg('--limit') ?? '5');
      const run = await createRun(db, { batchLimit: limit, operator: arg('--operator') });
      console.log(JSON.stringify({ runId: run.id, batchLimit: run.batchLimit, status: run.status }, null, 2));
      break;
    }
    case 'claim': {
      const runId = arg('--run');
      if (!runId) throw new Error('claim requires --run <runId>');
      // A real Wikipedia discovery adapter would be injected here; the CLI
      // ships with a disabled/deterministic default so it never hits the net.
      const seeds = (arg('--seeds') ?? '').split('|').filter(Boolean).map((title) => ({ title }));
      const res = await claimNextJob(db, runId, {
        worker: arg('--worker') ?? 'cowork',
        discovery: seeds.length ? deterministicDiscoveryAdapter(seeds) : undefined,
      });
      console.log(JSON.stringify(res.job ? { jobId: res.job.id, title: res.job.centralTitle, url: res.job.centralUrl, origin: res.job.origin, focusNote: res.job.focusNote, recovered: res.recovered, fromDiscovery: res.fromDiscovery } : { job: null, reason: res.reason }, null, 2));
      break;
    }
    case 'submit': {
      const jobId = arg('--job');
      const file = arg('--file');
      if (!jobId || !file) throw new Error('submit requires --job <jobId> --file <path>');
      const envelope = JSON.parse(fs.readFileSync(file, 'utf8'));
      const res = await submitPackage(db, jobId, envelope, { submittedBy: arg('--by') ?? 'cowork' });
      console.log(JSON.stringify({ packageId: res.package.id, created: res.created, status: res.package.status }, null, 2));
      break;
    }
    case 'qa': {
      const pkgId = arg('--package');
      const file = arg('--file');
      if (!pkgId || !file) throw new Error('qa requires --package <pkgId> --file <path>');
      const contract = JSON.parse(fs.readFileSync(file, 'utf8'));
      const res = await recordQa(db, pkgId, contract);
      console.log(JSON.stringify({ qaResultId: res.result.id, recommendation: res.result.recommendation, heldItems: res.heldItems }, null, 2));
      break;
    }
    case 'status': {
      const now = new Date();
      const [byStatus, byOrigin, awaitingReview, runs] = await Promise.all([
        countJobsByStatus(db),
        countOpenJobsByOrigin(db),
        listPackagesByStatus(db, ['submitted', 'qa_pending', 'qa_complete', 'in_review']),
        activeRuns(db),
      ]);
      const openJobs = await db.query.researchJobs.findMany();
      console.log(JSON.stringify({
        activeRuns: runs.map((r) => ({ runId: r.id, status: r.status, batchLimit: r.batchLimit })),
        activeAgents: activeAgentCount(openJobs, now),
        jobs: byStatus,
        displayStates: openJobs.map((j) => ({ jobId: j.id, title: j.centralTitle, display: jobDisplayState(j, undefined, now) })),
        queuedByOrigin: byOrigin,
        packagesAwaitingReview: awaitingReview.length,
      }, null, 2));
      break;
    }
    case 'active-runs': {
      const runs = await activeRuns(db);
      console.log(JSON.stringify(runs.map((r) => ({ runId: r.id, status: r.status, batchLimit: r.batchLimit, claimed: r.claimedCount, completed: r.completedCount })), null, 2));
      break;
    }
    case 'claim-next-active': {
      const res = await claimNextForActiveRun(db, { worker: arg('--worker') ?? 'cowork' });
      if (res.ambiguousRunIds && res.ambiguousRunIds.length > 1) {
        console.error('[research:agent] multiple active runs — choose one with `claim --run <id>`:');
        for (const id of res.ambiguousRunIds) console.error('  ' + id);
        await closeDevClient();
        process.exit(2);
      }
      console.log(JSON.stringify(res.job ? { runId: res.runId, jobId: res.job.id, title: res.job.centralTitle, origin: res.job.origin } : { job: null, reason: res.reason }, null, 2));
      break;
    }
    case 'begin': {
      const j = await beginJob(db, arg('--job')!, arg('--worker') ?? 'cowork');
      console.log(JSON.stringify({ jobId: j.id, status: j.status, leaseExpiresAt: j.leaseExpiresAt }, null, 2));
      break;
    }
    case 'heartbeat': {
      const j = await heartbeatJob(db, arg('--job')!, arg('--worker') ?? 'cowork');
      console.log(JSON.stringify({ jobId: j.id, leaseExpiresAt: j.leaseExpiresAt }, null, 2));
      break;
    }
    case 'release': {
      const j = await releaseJob(db, arg('--job')!, arg('--worker') ?? 'cowork');
      console.log(JSON.stringify({ jobId: j.id, status: j.status }, null, 2));
      break;
    }
    case 'fail': {
      const j = await failJob(db, arg('--job')!, arg('--reason') ?? 'unspecified', arg('--worker') ?? 'cowork');
      console.log(JSON.stringify({ jobId: j.id, status: j.status, lastError: j.lastError }, null, 2));
      break;
    }
    default:
      console.log('commands: create-run | claim | claim-next-active | begin | heartbeat | release | fail | active-runs | submit | qa | status');
  }
  await closeDevClient();
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('[research:agent]', err.message ?? err);
  process.exit(1);
});
