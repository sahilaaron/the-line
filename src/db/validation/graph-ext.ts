/**
 * Zod contracts for the Cycle 8A canonical graph extensions. These are the
 * single definition of a well-formed alias / external id / classification /
 * time association / relationship-type registration.
 */
import { z } from 'zod';
import { confidenceSchema, idSchema, slugSchema } from './common';
import { entityKindValues } from './entity';

/**
 * Controlled additional-classification vocabulary. `entities.kind` stays the
 * small renderer-facing enum; this richer, scalable vocabulary is stored in
 * entity_classifications and resolves the documented kind drift WITHOUT
 * multiplying the renderer enum. Extend this array (not a code migration to a
 * DB enum) to add a new classification.
 */
export const CLASSIFICATION_VOCABULARY = [
  'person',
  'invention',
  'technology',
  'discovery',
  'event',
  'theme',
  'idea',
  'concept',
  'movement',
  'place',
  'organisation',
  'institution',
  'civilisation',
  'political_entity',
  'period',
  'document',
  'work',
  'law',
  'treaty',
  'artifact',
  'dataset',
  'other',
] as const;
export type Classification = (typeof CLASSIFICATION_VOCABULARY)[number];

/**
 * Deliberate resolution of the kind drift: a canonical entity keeps a small
 * renderer `kind`, and richer meaning rides in classifications. When a package
 * gives a classification but the renderer kind is ambiguous, promotion derives
 * kind from this map. `idea` -> `concept` and `discovery` -> `event` are the
 * two documented reconciliations (renderer/handoff used `discovery`/`idea`
 * that the canonical enum never had).
 */
export const CLASSIFICATION_TO_KIND: Record<string, (typeof entityKindValues)[number]> = {
  person: 'person',
  invention: 'invention',
  technology: 'invention',
  discovery: 'event',
  event: 'event',
  theme: 'theme',
  idea: 'concept',
  concept: 'concept',
  movement: 'concept',
  place: 'place',
  organisation: 'organisation',
  institution: 'organisation',
  civilisation: 'civilisation',
  political_entity: 'civilisation',
  period: 'period',
  document: 'concept',
  work: 'concept',
  law: 'concept',
  treaty: 'concept',
  artifact: 'invention',
  dataset: 'concept',
  other: 'concept',
};

export const aliasTypeValues = [
  'alias',
  'historical_name',
  'spelling',
  'abbreviation',
  'translation',
] as const;

export const externalIdSchemeValues = [
  'wikipedia',
  'wikidata',
  'viaf',
  'isni',
  'doi',
  'geonames',
  'other',
] as const;

export const timeAssociationRoleValues = [
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
] as const;

export const assertionClassValues = [
  'recorded_fact',
  'interpretation',
  'inference',
  'forecast',
] as const;

export const aliasCreateSchema = z.object({
  alias: z.string().min(1, 'alias is required'),
  aliasType: z.enum(aliasTypeValues).default('alias'),
  lang: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

export const externalIdCreateSchema = z.object({
  scheme: z.enum(externalIdSchemeValues),
  value: z.string().min(1, 'external id value is required'),
  url: z.string().url().optional(),
});

export const classificationCreateSchema = z.object({
  classification: z.enum(CLASSIFICATION_VOCABULARY),
  isPrimary: z.boolean().default(false),
});

export const timeAssociationCreateSchema = z.object({
  entityId: idSchema,
  periodId: idSchema,
  role: z.enum(timeAssociationRoleValues).default('existence'),
  confidence: confidenceSchema.default(50),
  isPrimary: z.boolean().default(false),
  note: z.string().optional(),
  isSynthetic: z.boolean().default(false),
});

/** A relationship-type registration. `key` is a stable snake_case slug. */
export const relationshipTypeRegisterSchema = z.object({
  key: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/, 'relationship type key must be snake_case (e.g. "mentored")'),
  label: z.string().min(1),
  inverseLabel: z.string().min(1),
  directionality: z.enum(['directed', 'symmetric']).default('directed'),
  category: z.string().default('general'),
  isAcyclic: z.boolean().default(false),
  allowedSourceKinds: z.array(z.enum(entityKindValues)).optional(),
  allowedTargetKinds: z.array(z.enum(entityKindValues)).optional(),
  description: z.string().optional(),
});

export type AliasCreateInput = z.infer<typeof aliasCreateSchema>;
export type ExternalIdCreateInput = z.infer<typeof externalIdCreateSchema>;
export type ClassificationCreateInput = z.infer<typeof classificationCreateSchema>;
export type TimeAssociationCreateInput = z.infer<typeof timeAssociationCreateSchema>;
export type RelationshipTypeRegisterInput = z.infer<typeof relationshipTypeRegisterSchema>;
export { slugSchema };
