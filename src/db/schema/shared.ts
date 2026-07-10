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
