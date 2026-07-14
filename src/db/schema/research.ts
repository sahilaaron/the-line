/**
 * Cycle 8A — research STAGING schema. Raw/candidate work, bot provenance, QA
 * findings, review decisions and immutable package snapshots. Research agents
 * PROPOSE historical truth here; nothing here is public. Promotion
 * (services/research/promotion.ts) is the only path into the canonical graph,
 * and it never writes yol_* / editorial curation.
 *
 * Design: canonical truth stays fully normalized (base tables). STAGING is
 * deliberately allowed validated-JSON payloads (research_package_items.payload)
 * plus an immutable submission envelope (research_packages.envelope): staging
 * is transient, Zod-validated and reviewed per-section — never joined like canon.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import {
  humanDecisionEnum,
  newId,
  qaFlagSeverityEnum,
  qaFlagStateEnum,
  qaRecommendationEnum,
  researchItemDecisionEnum,
  researchJobOriginEnum,
  researchJobStatusEnum,
  researchPackageSectionEnum,
  researchPackageStatusEnum,
  researchRunStatusEnum,
  packageEditKindEnum,
} from './shared';
import { entities } from './entities';

/** Research run — one operator batch with a hard limit and safe stop. */
export const researchRuns = pgTable(
  'research_runs',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    batchLimit: integer('batch_limit').notNull(),
    status: researchRunStatusEnum('status').notNull().default('active'),
    /** Sticky stop request: once true, no NEW claims are allowed. */
    stopRequested: boolean('stop_requested').notNull().default(false),
    operator: text('operator'),
    configSnapshot: jsonb('config_snapshot').$type<Record<string, unknown>>(),
    claimedCount: integer('claimed_count').notNull().default(0),
    completedCount: integer('completed_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    returnedCount: integer('returned_count').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    stoppedAt: timestamp('stopped_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('research_runs_status_idx').on(t.status),
    check('research_runs_batch_limit_positive', sql`${t.batchLimit} >= 1`),
    check('research_runs_counts_nonneg', sql`${t.claimedCount} >= 0 AND ${t.completedCount} >= 0`),
  ],
);

/** Research job — one central seed entity. Queue priority:
 *  human (manual/returned) > frontier > random_discovery. Worker lock + lease
 *  make an abandoned claim recoverable. */
export const researchJobs = pgTable(
  'research_jobs',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    centralTitle: text('central_title').notNull(),
    centralUrl: text('central_url'),
    focusNote: text('focus_note'),
    origin: researchJobOriginEnum('origin').notNull().default('manual'),
    priority: integer('priority').notNull().default(0),
    /** Monotonic tiebreaker for stable order inside a priority group. */
    sequence: integer('sequence').notNull(),
    status: researchJobStatusEnum('status').notNull().default('queued'),
    claimedByRunId: text('claimed_by_run_id').references(() => researchRuns.id, {
      onDelete: 'set null',
    }),
    workerLock: text('worker_lock'),
    /** Cycle 8B correction: exact worker identity of the current lease owner
     * (never prefix-matched). Cleared on release/recovery/terminal. */
    claimedByWorker: text('claimed_by_worker'),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
    matchStatus: text('match_status'),
    matchEntityId: text('match_entity_id').references(() => entities.id, { onDelete: 'set null' }),
    parentEntityId: text('parent_entity_id').references(() => entities.id, { onDelete: 'set null' }),
    parentContext: text('parent_context'),
    /** Stable dedupe key (normalized title/url) to avoid duplicate jobs. */
    dedupeKey: text('dedupe_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('research_jobs_status_idx').on(t.status),
    index('research_jobs_origin_idx').on(t.origin),
    index('research_jobs_queue_order_idx').on(t.status, t.priority, t.sequence),
    index('research_jobs_run_idx').on(t.claimedByRunId),
    index('research_jobs_dedupe_idx').on(t.dedupeKey),
    // At most ONE active job per dedupe key: blocks duplicate manual/frontier
    // captures (incl. concurrent) at the DB level. Terminal jobs are excluded
    // so a topic can be re-researched later.
    uniqueIndex('research_jobs_active_dedupe_unique')
      .on(t.dedupeKey)
      .where(sql`status in ('queued','claimed','researching','submitted')`),
    check('research_jobs_attempts_nonneg', sql`${t.attemptCount} >= 0`),
  ],
);

/** Research package — one deep result. `envelope` is the immutable submitted
 *  snapshot; research_package_items are the normalized promotable rows. */
export const researchPackages = pgTable(
  'research_packages',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    jobId: text('job_id')
      .notNull()
      .references(() => researchJobs.id, { onDelete: 'cascade' }),
    runId: text('run_id').references(() => researchRuns.id, { onDelete: 'set null' }),
    centralLabel: text('central_label').notNull(),
    centralSlug: text('central_slug').notNull(),
    status: researchPackageStatusEnum('status').notNull().default('submitted'),
    schemaVersion: integer('schema_version').notNull().default(1),
    envelope: jsonb('envelope').$type<Record<string, unknown>>().notNull(),
    /** Idempotency: repeated submit of identical content is a no-op. */
    submissionHash: text('submission_hash').notNull(),
    submittedBy: text('submitted_by'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    promotedEntityId: text('promoted_entity_id').references(() => entities.id, {
      onDelete: 'set null',
    }),
    promotedAt: timestamp('promoted_at', { withTimezone: true }),
    /** Cycle 8B: set on any material candidate edit; compared against the
     * latest QA result to decide whether QA is stale (blocks approval). */
    lastEditedAt: timestamp('last_edited_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('research_packages_job_idx').on(t.jobId),
    index('research_packages_status_idx').on(t.status),
    unique('research_packages_job_hash_unique').on(t.jobId, t.submissionHash),
    check('research_packages_slug_not_empty', sql`length(${t.centralSlug}) > 0`),
  ],
);

/** Normalized candidate row (one per promotable/reviewable item). `localRef`
 *  is a stable within-package id used for cross-item links before canonical
 *  ids exist. held/decision drive package approval that excludes flagged items. */
export const researchPackageItems = pgTable(
  'research_package_items',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    packageId: text('package_id')
      .notNull()
      .references(() => researchPackages.id, { onDelete: 'cascade' }),
    section: researchPackageSectionEnum('section').notNull(),
    localRef: text('local_ref').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    matchEntityId: text('match_entity_id').references(() => entities.id, { onDelete: 'set null' }),
    matchStatus: text('match_status'),
    /** Marked synthetic -> NEVER promotable into canonical rows. */
    isSynthetic: boolean('is_synthetic').notNull().default(false),
    held: boolean('held').notNull().default(false),
    /** Cycle 8B correction: hold provenance so QA reruns clear only QA-derived
     * holds and never a human hold. 'human' | 'qa' | null (not held). */
    holdSource: text('hold_source'),
    decision: researchItemDecisionEnum('decision').notNull().default('pending'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('research_package_items_pkg_idx').on(t.packageId),
    index('research_package_items_section_idx').on(t.packageId, t.section),
    unique('research_package_items_ref_unique').on(t.packageId, t.section, t.localRef),
  ],
);

/** QA — accepts output from a FUTURE external Perplexity/Grok workflow. No
 *  provider is integrated in this cycle; this is only the staging contract. */
export const qaResults = pgTable(
  'qa_results',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    packageId: text('package_id')
      .notNull()
      .references(() => researchPackages.id, { onDelete: 'cascade' }),
    recommendation: qaRecommendationEnum('recommendation').notNull(),
    summary: text('summary'),
    toolName: text('tool_name'),
    model: text('model'),
    qaRunRef: text('qa_run_ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('qa_results_pkg_idx').on(t.packageId)],
);

export const qaFlags = pgTable(
  'qa_flags',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    qaResultId: text('qa_result_id')
      .notNull()
      .references(() => qaResults.id, { onDelete: 'cascade' }),
    packageId: text('package_id')
      .notNull()
      .references(() => researchPackages.id, { onDelete: 'cascade' }),
    targetSection: researchPackageSectionEnum('target_section'),
    targetRef: text('target_ref'),
    severity: qaFlagSeverityEnum('severity').notNull().default('minor'),
    category: text('category'),
    explanation: text('explanation').notNull(),
    correctiveSource: text('corrective_source'),
    state: qaFlagStateEnum('state').notNull().default('hold'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('qa_flags_result_idx').on(t.qaResultId),
    index('qa_flags_pkg_idx').on(t.packageId),
    index('qa_flags_target_idx').on(t.packageId, t.targetSection, t.targetRef),
  ],
);

/** Human decision — ONE final decision per package. Held/excluded items stay
 *  in staging with their decision + evidence (never silently deleted). */
export const packageDecisions = pgTable(
  'package_decisions',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    packageId: text('package_id')
      .notNull()
      .references(() => researchPackages.id, { onDelete: 'cascade' }),
    decision: humanDecisionEnum('decision').notNull(),
    reviewer: text('reviewer'),
    instructions: text('instructions'),
    reason: text('reason'),
    mergeTargetEntityId: text('merge_target_entity_id').references(() => entities.id, {
      onDelete: 'set null',
    }),
    /** {section, localRef} pairs held/excluded in approve_with_holds (refs are
     * only unique within a section). Column name kept for migration stability. */
    heldItems: jsonb('held_item_refs').$type<{ section: string; localRef: string }[]>(),
    decisionSnapshot: jsonb('decision_snapshot').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('package_decisions_pkg_idx').on(t.packageId),
    // Exactly ONE final human decision per package.
    unique('package_decisions_pkg_unique').on(t.packageId),
  ],
);

/** Cycle 8B — append-only audit trail of candidate edits made in the Studio
 * before approval. The immutable submitted envelope is never changed; edits
 * apply to normalized package items and are fully reconstructable from here. */
export const researchPackageItemRevisions = pgTable(
  'research_package_item_revisions',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    itemId: text('item_id')
      .notNull()
      .references(() => researchPackageItems.id, { onDelete: 'cascade' }),
    packageId: text('package_id')
      .notNull()
      .references(() => researchPackages.id, { onDelete: 'cascade' }),
    editKind: packageEditKindEnum('edit_kind').notNull(),
    editor: text('editor').notNull(),
    /** Deterministic before/after change record. */
    beforeValue: jsonb('before_value').$type<Record<string, unknown>>(),
    afterValue: jsonb('after_value').$type<Record<string, unknown>>(),
    note: text('note'),
    /** True when this edit invalidated a prior QA result. */
    invalidatedQa: boolean('invalidated_qa').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('research_package_item_revisions_item_idx').on(t.itemId),
    index('research_package_item_revisions_pkg_idx').on(t.packageId),
    check('research_package_item_revisions_editor_not_empty', sql`length(${t.editor}) > 0`),
  ],
);

export type ResearchPackageItemRevision = typeof researchPackageItemRevisions.$inferSelect;
export type NewResearchPackageItemRevision = typeof researchPackageItemRevisions.$inferInsert;

export type ResearchRun = typeof researchRuns.$inferSelect;
export type NewResearchRun = typeof researchRuns.$inferInsert;
export type ResearchJob = typeof researchJobs.$inferSelect;
export type NewResearchJob = typeof researchJobs.$inferInsert;
export type ResearchPackage = typeof researchPackages.$inferSelect;
export type NewResearchPackage = typeof researchPackages.$inferInsert;
export type ResearchPackageItem = typeof researchPackageItems.$inferSelect;
export type NewResearchPackageItem = typeof researchPackageItems.$inferInsert;
export type QaResult = typeof qaResults.$inferSelect;
export type NewQaResult = typeof qaResults.$inferInsert;
export type QaFlag = typeof qaFlags.$inferSelect;
export type NewQaFlag = typeof qaFlags.$inferInsert;
export type PackageDecision = typeof packageDecisions.$inferSelect;
export type NewPackageDecision = typeof packageDecisions.$inferInsert;
