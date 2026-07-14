/**
 * Cycle 8B — HONEST derived display states for the CoWork queue. The persisted
 * state machine is authoritative; these are display-only projections so the UI
 * never implies Claude was launched. An unclaimed queued job is exactly
 * "Awaiting Agent(s)". A claimed/researching job whose lease has expired has no
 * live agent, so it also reads "Awaiting Agent(s)".
 */
import type { ResearchJob } from '../../db/schema';

export const AWAITING_AGENTS = 'Awaiting Agent(s)';

export function leaseExpired(job: Pick<ResearchJob, 'leaseExpiresAt'>, now: Date): boolean {
  return job.leaseExpiresAt != null && job.leaseExpiresAt.getTime() <= now.getTime();
}

/** True when a job is genuinely being worked by a live agent right now. */
export function hasLiveAgent(job: Pick<ResearchJob, 'status' | 'leaseExpiresAt'>, now: Date): boolean {
  return (job.status === 'claimed' || job.status === 'researching') && !leaseExpired(job, now);
}

/** Derived, honest display state. `pkgStatus` disambiguates a submitted job
 * between Awaiting QA and Ready for review. */
export function jobDisplayState(
  job: Pick<ResearchJob, 'status' | 'leaseExpiresAt'>,
  pkgStatus: string | undefined,
  now: Date = new Date(),
): string {
  switch (job.status) {
    case 'queued':
      return AWAITING_AGENTS;
    case 'claimed':
      return hasLiveAgent(job, now) ? 'Claimed' : AWAITING_AGENTS;
    case 'researching':
      return hasLiveAgent(job, now) ? 'Researching' : AWAITING_AGENTS;
    case 'submitted':
      return pkgStatus === 'qa_complete' || pkgStatus === 'in_review' ? 'Ready for review' : 'Awaiting QA';
    case 'completed':
      return 'Completed';
    case 'returned':
      return 'Returned';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return job.status;
  }
}

/** Active agent count = jobs with an unexpired claimed/researching lease. */
export function activeAgentCount(jobs: Pick<ResearchJob, 'status' | 'leaseExpiresAt'>[], now: Date = new Date()): number {
  return jobs.filter((j) => hasLiveAgent(j, now)).length;
}

/** The honest progression order for display. */
export const JOB_PROGRESSION = [
  AWAITING_AGENTS, 'Claimed', 'Researching', 'Submitted', 'Awaiting QA', 'Ready for review', 'Completed',
] as const;
