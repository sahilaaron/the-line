/**
 * Shared schema primitives: enums, id generation, and column conventions
 * reused across every table in src/db/schema/**.
 *
 * Conventions (documented once, applied everywhere):
 * - Primary keys are `text` UUIDs generated app-side via `newId()`
 *   (crypto.randomUUID). This keeps ids stable across export/import without
 *   depending on a Postgres extension (no pgcrypto requirement for PGlite).
 * - Confidence and strength are both integers on a 0..100 scale (NOT 0..1).
 *   Documented once here so every table that has a confidence/strength
 *   column uses the same convention and the same CHECK constraint shape.
 * - Every content table carries `isPlaceholder` and/or `isSynthetic` flags
 *   so seed data and generated data are always distinguishable from
 *   (eventual, future-cycle) real research.
 */
import { randomUUID } from 'node:crypto';
import { pgEnum } from 'drizzle-orm/pg-core';

/** Generates a stable text primary key. Exported for reuse in seed/import code. */
export function newId(): string {
  return randomUUID();
}

/** 0..100 inclusive integer convention for confidence/strength columns. */
export const CONFIDENCE_MIN = 0;
export const CONFIDENCE_MAX = 100;

export const editorialStatusEnum = pgEnum('editorial_status', [
  'draft',
  'in_review',
  'verified',
  'disputed',
  'published',
  'archived',
]);

export const timePrecisionEnum = pgEnum('time_precision', [
  'exact',
  'approximate',
  'range',
  'decade',
  'century',
  'era',
  'unknown',
]);

export const yolPointRoleEnum = pgEnum('yol_point_role', [
  'overview',
  'development',
  'context',
  'closing',
]);

export const entityKindEnum = pgEnum('entity_kind', [
  'person',
  'invention',
  'event',
  'theme',
  'place',
  'organisation',
  'civilisation',
  'concept',
  'period',
  // Cycle 8B vocabulary v1 additions (forward-only; existing values kept).
  'discovery',
  'technology',
  'movement',
  'publication',
  'product',
  'law_policy',
]);

export const relationshipTypeEnum = pgEnum('relationship_type', [
  'enabled',
  'influenced',
  'contributed_to',
  'accelerated',
  'responded_to',
  'opposed',
  'replaced',
  'spread_through',
  'developed_by',
  'improved_by',
  'occurred_in',
  'associated_with',
  'part_of',
]);

/**
 * Relationship types the integrity audit treats as expected-acyclic
 * (containment/succession semantics: a cycle is a modelling bug).
 * All other types (e.g. `influenced`) may legitimately cycle — mutual
 * influence over time is real. See docs/database/data-integrity-rules.md.
 */
export const ACYCLIC_EXPECTED_RELATIONSHIP_TYPES = ['part_of', 'replaced'] as const;

export const sourceTypeEnum = pgEnum('source_type', [
  'book',
  'article',
  'website',
  'primary_document',
  'video',
  'dataset',
  'oral_history',
  'other',
]);

export const claimVerificationStatusEnum = pgEnum('claim_verification_status', [
  'unverified',
  'corroborated',
  'verified',
  'disputed',
]);

export const claimSubjectTypeEnum = pgEnum('claim_subject_type', [
  'entity',
  'relationship',
  'period',
  'time_association', // Cycle 8A: evidence for a typed entity-period milestone
]);

export const mediaTypeEnum = pgEnum('media_type', [
  'image',
  'video',
  'audio',
  'document',
  'map',
  'model_3d',
]);

export const mediaRightsStatusEnum = pgEnum('media_rights_status', [
  'unknown',
  'cleared',
  'restricted',
  'public_domain',
  'synthetic_fixture',
]);

export const mediaSubjectTypeEnum = pgEnum('media_subject_type', [
  'entity',
  'period',
  'yol_composition',
]);

/* ==========================================================================
 * Cycle 8A — Research staging + canonical graph extensions.
 * Three concerns stay strictly separated (docs/research-operations.md):
 *   1. research staging  — candidate work, provenance, QA, review decisions;
 *   2. canonical graph   — accepted, private knowledge (extends the base 24);
 *   3. editorial surface — public curation (yol_* — NEVER written by research).
 * ========================================================================== */

/** Assertion class — keeps forecasts/inferences from masquerading as facts.
 * Cycle 8A ingests recorded_fact + interpretation only; inference/forecast
 * may be STORED but are never promoted as verified truth. */
export const assertionClassEnum = pgEnum('assertion_class', [
  'recorded_fact',
  'interpretation',
  'inference',
  'forecast',
]);

/** Durable research-completeness/freshness of a canonical entity (metadata,
 * NOT historical truth). Transient states (queued/researching/ambiguous) are
 * computed by the resolver from staging tables, not stored here. */
export const entityGraphStatusEnum = pgEnum('entity_graph_status', [
  'frontier',
  'draft_stub',
  'candidate',
  'canonical_incomplete',
  'canonical_complete',
  'stale',
  'superseded',
  'archived',
]);

export const entityAliasTypeEnum = pgEnum('entity_alias_type', [
  'alias',
  'historical_name',
  'spelling',
  'abbreviation',
  'translation',
]);

export const externalIdSchemeEnum = pgEnum('external_id_scheme', [
  'wikipedia',
  'wikidata',
  'viaf',
  'isni',
  'doi',
  'geonames',
  'other',
]);

/** Typed lifecycle role for an entity-period association (an entity may hold
 * many). `other` absorbs the long tail without an enum migration per verb. */
export const timeAssociationRoleEnum = pgEnum('time_association_role', [
  'existence',
  'born',
  'died',
  'active',
  'conceived',
  'invented',
  'patented',
  'demonstrated',
  'published',
  'founded',
  'dissolved',
  'commercialised',
  'adopted',
  'declined',
  'replaced',
  'occurred',
  'other',
]);

export const relationshipDirectionalityEnum = pgEnum('relationship_directionality', [
  'directed',
  'symmetric',
]);

export const researchRunStatusEnum = pgEnum('research_run_status', [
  'active',
  'stopping',
  'stopped',
  'completed',
  'failed',
]);

export const researchJobOriginEnum = pgEnum('research_job_origin', [
  'manual',
  'returned_correction',
  'frontier',
  'random_discovery',
]);

export const researchJobStatusEnum = pgEnum('research_job_status', [
  'queued',
  'claimed',
  'researching',
  'submitted',
  'completed',
  'returned',
  'failed',
  'cancelled',
]);

export const researchPackageStatusEnum = pgEnum('research_package_status', [
  'draft',
  'submitted',
  'qa_pending',
  'qa_complete',
  'in_review',
  'approved',
  'approved_with_holds',
  'returned',
  'marked_duplicate',
  'rejected',
  'promoted',
]);

export const researchPackageSectionEnum = pgEnum('research_package_section', [
  'entity',
  'time',
  'relationship',
  'claim',
  'source',
  'media',
  'question',
  'next_entity',
]);

export const researchItemDecisionEnum = pgEnum('research_item_decision', [
  'pending',
  'accepted',
  'held',
  'rejected',
]);

export const qaRecommendationEnum = pgEnum('qa_recommendation', [
  'pass',
  'hold',
  'correct',
  'duplicate',
  'insufficient_evidence',
]);

export const qaFlagSeverityEnum = pgEnum('qa_flag_severity', [
  'info',
  'minor',
  'major',
  'critical',
]);

export const qaFlagStateEnum = pgEnum('qa_flag_state', [
  'pass',
  'hold',
  'correction',
  'duplicate',
  'insufficient_evidence',
]);

export const humanDecisionEnum = pgEnum('human_package_decision', [
  'approve',
  'approve_with_holds',
  'return',
  'mark_duplicate',
  'reject',
]);

/** Entity-resolution verdict (computed by services/research/resolver.ts,
 * never stored as a column). One authoritative home for the value set. */
export const ENTITY_RESOLUTION_STATUSES = [
  'absent',
  'draft_stub',
  'queued_or_researching',
  'candidate_in_review',
  'canonical_incomplete',
  'canonical_complete',
  'stale',
  'ambiguous_duplicate',
  'superseded_or_archived',
] as const;
export type EntityResolutionStatus = (typeof ENTITY_RESOLUTION_STATUSES)[number];

/** Cycle 8B — kind of an auditable candidate edit (revision history). */
export const packageEditKindEnum = pgEnum('package_edit_kind', [
  'field_edit',
  'relationship_type',
  'relationship_endpoints',
  'canonical_match',
  'hold',
  'unhold',
  'reject_item',
  // Cycle 8B v5: governed human resolution of an agent-proposed hold.
  'clear_agent_hold',
  'confirm_agent_hold',
]);
