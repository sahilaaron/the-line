/**
 * Centralised kernel configuration for the research CRM. Keep tunables here
 * (not scattered across services) so queue behaviour is reproducible and a
 * run's configSnapshot can capture the exact values it ran under.
 */
export interface QueueConfig {
  /** How long a claimed job's lease lasts before it can be recovered (ms). */
  leaseMs: number;
  /** Origin priority order (earlier = handled first). Human beats frontier
   * beats random discovery. */
  originPriority: readonly ['manual', 'returned_correction', 'frontier', 'random_discovery'];
  /** Completeness heuristic: an entity is "sufficiently complete" only if it
   * has at least this many claims AND this many time associations. */
  completenessMinClaims: number;
  completenessMinTimeAssociations: number;
  /** Freshness: canonical entities older than this are considered stale (ms).
   * 0 disables staleness by age. */
  freshnessMaxAgeMs: number;
}

export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  leaseMs: 15 * 60 * 1000, // 15 minutes
  originPriority: ['manual', 'returned_correction', 'frontier', 'random_discovery'],
  completenessMinClaims: 2,
  completenessMinTimeAssociations: 1,
  freshnessMaxAgeMs: 0,
};

/** Human-priority origins are handled ahead of frontier/random. */
export const HUMAN_PRIORITY_ORIGINS = ['manual', 'returned_correction'] as const;
