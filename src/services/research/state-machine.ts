/**
 * Explicit state machines for runs, jobs and packages. UI never invents
 * state; every transition goes through assertTransition so illegal moves
 * fail loudly and the kernel stays auditable.
 */
import type {
  ResearchJob,
  ResearchPackage,
  ResearchRun,
} from '../../db/schema';

export type RunStatus = ResearchRun['status'];
export type JobStatus = ResearchJob['status'];
export type PackageStatus = ResearchPackage['status'];

export const RUN_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  active: ['active', 'stopping', 'stopped', 'completed', 'failed'],
  stopping: ['stopping', 'stopped', 'completed', 'failed'],
  stopped: [],
  completed: [],
  failed: [],
};

export const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued: ['claimed', 'cancelled'],
  claimed: ['researching', 'submitted', 'queued', 'failed', 'cancelled'], // submit may skip researching; -> queued = lease recovery
  researching: ['submitted', 'queued', 'failed', 'cancelled'],
  submitted: ['completed', 'returned', 'failed'],
  returned: ['queued', 'cancelled'],
  completed: [],
  failed: ['queued'], // a failed job may be retried
  cancelled: [],
};

export const PACKAGE_TRANSITIONS: Record<PackageStatus, PackageStatus[]> = {
  draft: ['submitted'],
  submitted: ['qa_pending', 'qa_complete', 'in_review', 'returned', 'rejected'],
  qa_pending: ['qa_complete', 'in_review', 'returned'],
  qa_complete: ['in_review', 'returned'],
  in_review: ['approved', 'approved_with_holds', 'returned', 'merged', 'rejected'],
  approved: ['promoted'],
  approved_with_holds: ['promoted'],
  returned: [],
  merged: [],
  rejected: [],
  promoted: [],
};

export function canTransition<T extends string>(
  table: Record<T, T[]>,
  from: T,
  to: T,
): boolean {
  return table[from]?.includes(to) ?? false;
}

export function assertTransition<T extends string>(
  table: Record<T, T[]>,
  from: T,
  to: T,
  label: string,
): void {
  if (from === to) return; // idempotent no-op re-assertion
  if (!canTransition(table, from, to)) {
    throw new Error(`illegal ${label} transition: ${from} -> ${to}`);
  }
}
