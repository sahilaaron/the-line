/**
 * Authoritative Zod contracts for the research pipeline: the research-package
 * ENVELOPE (identity, chronology, connections, claims, media, questions, next
 * entities), the QA contract, and the human decision. This is the single
 * definition of a well-formed submission — see docs/research-package-contract.md.
 *
 * Cross-reference model: every section item carries a stable `ref` (localRef,
 * unique within its section). Cross-section links use those refs; the central
 * entity's ref is conventionally "central". Refs let a package describe
 * relationships/claims/media before any canonical id exists.
 */
import { z } from 'zod';
import { confidenceSchema } from './common';
import { entityKindValues } from './entity';
import { sourceTypeValues } from './claim';
import { mediaTypeValues } from './media';
import {
  aliasTypeValues,
  assertionClassValues,
  CLASSIFICATION_VOCABULARY,
  externalIdSchemeValues,
  timeAssociationRoleValues,
} from './graph-ext';

/** A stable within-package reference token. */
export const localRefSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, 'ref must be a short token (letters/digits/-/_)');

const yearIntSchema = z
  .number()
  .int()
  .min(-999999)
  .max(999999);

const claimVerificationValues = ['unverified', 'corroborated', 'verified', 'disputed'] as const;
const mediaRightsValues = [
  'unknown',
  'cleared',
  'restricted',
  'public_domain',
  'synthetic_fixture',
] as const;
/** Honesty flag: generated/reconstructed imagery is NEVER labelled archival. */
export const mediaStatusValues = ['archival', 'reconstructed', 'generated', 'placeholder'] as const;
export const questionCategoryValues = [
  'conflict',
  'weak_evidence',
  'ambiguity',
  'possible_duplicate',
  'missing_research',
] as const;

/* ---- sections ---- */

export const packageEntitySchema = z.object({
  ref: localRefSchema,
  role: z.enum(['central', 'connected']).default('connected'),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase-kebab'),
  label: z.string().min(1),
  kind: z.enum(entityKindValues).optional(), // derivable from classifications
  classifications: z.array(z.enum(CLASSIFICATION_VOCABULARY)).default([]),
  shortDescription: z.string().optional(),
  fullDescription: z.string().optional(),
  aliases: z
    .array(
      z.object({
        alias: z.string().min(1),
        aliasType: z.enum(aliasTypeValues).default('alias'),
        lang: z.string().optional(),
      }),
    )
    .default([]),
  externalIds: z
    .array(
      z.object({
        scheme: z.enum(externalIdSchemeValues),
        value: z.string().min(1),
        url: z.string().url().optional(),
      }),
    )
    .default([]),
  /** Explicit existing-entity match hint (resolver still verifies). */
  matchExistingSlug: z.string().optional(),
  /** Test-only marker: synthetic items are NEVER promoted into canon. */
  isSynthetic: z.boolean().default(false),
});

export const packageTimeSchema = z.object({
  ref: localRefSchema,
  entityRef: localRefSchema.default('central'),
  role: z.enum(timeAssociationRoleValues).default('existence'),
  label: z.string().optional(),
  startYear: yearIntSchema,
  endYear: yearIntSchema.optional(),
  startMonth: z.number().int().min(1).max(12).optional(),
  startDay: z.number().int().min(1).max(31).optional(),
  endMonth: z.number().int().min(1).max(12).optional(),
  endDay: z.number().int().min(1).max(31).optional(),
  precision: z
    .enum(['exact', 'approximate', 'range', 'decade', 'century', 'era', 'unknown'])
    .default('approximate'),
  confidence: confidenceSchema.default(50),
  geoContext: z.string().optional(),
  note: z.string().optional(),
});

export const packageRelationshipSchema = z.object({
  ref: localRefSchema,
  sourceRef: localRefSchema.default('central'),
  targetRef: localRefSchema,
  typeKey: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/, 'typeKey must be a registry key'),
  explanation: z.string().optional(),
  periodHint: z.string().optional(),
  confidence: confidenceSchema.default(50),
  strength: confidenceSchema.default(50),
  assertionClass: z.enum(assertionClassValues).default('recorded_fact'),
  disputed: z.boolean().default(false),
  held: z.boolean().default(false),
});

export const packageSourceSchema = z.object({
  ref: localRefSchema,
  title: z.string().min(1),
  type: z.enum(sourceTypeValues).default('other'),
  url: z.string().url().optional(),
  identifier: z.string().optional(),
  publicationYear: yearIntSchema.optional(),
});

export const packageClaimSchema = z.object({
  ref: localRefSchema,
  subjectRef: localRefSchema.default('central'),
  subjectSection: z.enum(['entity', 'relationship', 'time']).default('entity'),
  text: z.string().min(1),
  assertionClass: z.enum(assertionClassValues).default('recorded_fact'),
  confidence: confidenceSchema.default(50),
  verification: z.enum(claimVerificationValues).default('unverified'),
  disputed: z.boolean().default(false),
  sourceLinks: z
    .array(
      z.object({
        sourceRef: localRefSchema,
        quotation: z.string().optional(),
        locator: z.string().optional(),
      }),
    )
    .default([]),
  held: z.boolean().default(false),
});

export const packageMediaSchema = z.object({
  ref: localRefSchema,
  subjectRef: localRefSchema.default('central'),
  mediaType: z.enum(mediaTypeValues).default('image'),
  src: z.string().optional(),
  alt: z.string().min(1, 'media alt text is required'),
  rightsStatus: z.enum(mediaRightsValues).default('unknown'),
  provenance: z.string().optional(),
  status: z.enum(mediaStatusValues).default('placeholder'),
  held: z.boolean().default(false),
});

export const packageQuestionSchema = z.object({
  ref: localRefSchema,
  category: z.enum(questionCategoryValues),
  detail: z.string().min(1),
  severity: z.enum(['info', 'minor', 'major', 'critical']).default('minor'),
  relatedSection: z
    .enum(['entity', 'time', 'relationship', 'claim', 'source', 'media'])
    .optional(),
  relatedRef: localRefSchema.optional(),
});

export const packageNextEntitySchema = z.object({
  ref: localRefSchema,
  title: z.string().min(1),
  url: z.string().url().optional(),
  reason: z.string().min(1),
  suggestedPriority: z.number().int().min(0).max(100).default(0),
  relationTo: localRefSchema.optional(),
});

/* ---- the envelope ---- */

export const researchPackageEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    submittedBy: z.string().optional(),
    job: z
      .object({
        jobId: z.string().optional(),
        centralTitle: z.string().min(1),
        centralUrl: z.string().url().optional(),
      })
      .optional(),
    entities: z.array(packageEntitySchema).min(1, 'at least the central entity is required'),
    chronology: z.array(packageTimeSchema).default([]),
    connections: z.array(packageRelationshipSchema).default([]),
    sources: z.array(packageSourceSchema).default([]),
    claims: z.array(packageClaimSchema).default([]),
    media: z.array(packageMediaSchema).default([]),
    questions: z.array(packageQuestionSchema).default([]),
    nextEntities: z.array(packageNextEntitySchema).default([]),
  })
  .superRefine((env, ctx) => {
    const entityRefs = new Set(env.entities.map((e) => e.ref));
    const relRefs = new Set(env.connections.map((r) => r.ref));
    const timeRefs = new Set(env.chronology.map((t) => t.ref));
    const sourceRefs = new Set(env.sources.map((s) => s.ref));

    // exactly one central entity
    const centrals = env.entities.filter((e) => e.role === 'central');
    if (centrals.length !== 1) {
      ctx.addIssue({ code: 'custom', path: ['entities'], message: 'exactly one entity must have role "central"' });
    }

    // unique refs within each section
    const dup = (arr: { ref: string }[]) => {
      const seen = new Set<string>();
      for (const x of arr) {
        if (seen.has(x.ref)) return x.ref;
        seen.add(x.ref);
      }
      return null;
    };
    for (const [name, arr] of Object.entries({
      entities: env.entities,
      chronology: env.chronology,
      connections: env.connections,
      sources: env.sources,
      claims: env.claims,
      media: env.media,
    })) {
      const d = dup(arr as { ref: string }[]);
      if (d) ctx.addIssue({ code: 'custom', path: [name], message: `duplicate ref "${d}"` });
    }

    // chronology.entityRef must resolve
    env.chronology.forEach((t, i) => {
      if (!entityRefs.has(t.entityRef))
        ctx.addIssue({ code: 'custom', path: ['chronology', i, 'entityRef'], message: `unknown entity ref "${t.entityRef}"` });
      if (t.endYear != null && t.endYear < t.startYear)
        ctx.addIssue({ code: 'custom', path: ['chronology', i, 'endYear'], message: 'endYear < startYear' });
    });

    // connection source/target must be entity refs
    env.connections.forEach((r, i) => {
      if (!entityRefs.has(r.sourceRef))
        ctx.addIssue({ code: 'custom', path: ['connections', i, 'sourceRef'], message: `unknown entity ref "${r.sourceRef}"` });
      if (!entityRefs.has(r.targetRef))
        ctx.addIssue({ code: 'custom', path: ['connections', i, 'targetRef'], message: `unknown entity ref "${r.targetRef}"` });
      if (r.sourceRef === r.targetRef)
        ctx.addIssue({ code: 'custom', path: ['connections', i], message: 'a relationship cannot link an entity to itself' });
    });

    // claims: subjectRef resolves against the declared section; sourceLinks
    // resolve; verified/corroborated claims require a source and a
    // fact/interpretation assertion class (never inference/forecast).
    env.claims.forEach((c, i) => {
      const pool = c.subjectSection === 'relationship' ? relRefs : c.subjectSection === 'time' ? timeRefs : entityRefs;
      if (!pool.has(c.subjectRef))
        ctx.addIssue({ code: 'custom', path: ['claims', i, 'subjectRef'], message: `unknown ${c.subjectSection} ref "${c.subjectRef}"` });
      c.sourceLinks.forEach((sl, j) => {
        if (!sourceRefs.has(sl.sourceRef))
          ctx.addIssue({ code: 'custom', path: ['claims', i, 'sourceLinks', j, 'sourceRef'], message: `unknown source ref "${sl.sourceRef}"` });
      });
      if ((c.verification === 'verified' || c.verification === 'corroborated')) {
        if (c.sourceLinks.length === 0)
          ctx.addIssue({ code: 'custom', path: ['claims', i], message: 'a verified/corroborated claim needs at least one source link' });
        if (c.assertionClass === 'inference' || c.assertionClass === 'forecast')
          ctx.addIssue({ code: 'custom', path: ['claims', i, 'assertionClass'], message: 'inference/forecast claims cannot be verified as fact' });
      }
    });

    // media honesty
    env.media.forEach((m, i) => {
      if (!entityRefs.has(m.subjectRef))
        ctx.addIssue({ code: 'custom', path: ['media', i, 'subjectRef'], message: `unknown entity ref "${m.subjectRef}"` });
      if ((m.status === 'generated' || m.status === 'reconstructed') && m.rightsStatus === 'public_domain')
        ctx.addIssue({ code: 'custom', path: ['media', i], message: 'generated/reconstructed media must not claim public_domain rights' });
    });
  });

export type ResearchPackageEnvelope = z.infer<typeof researchPackageEnvelopeSchema>;
export type PackageEntity = z.infer<typeof packageEntitySchema>;
export type PackageRelationship = z.infer<typeof packageRelationshipSchema>;
export type PackageClaim = z.infer<typeof packageClaimSchema>;

/* ---- QA contract ---- */
export const qaContractSchema = z.object({
  packageId: z.string().optional(),
  recommendation: z.enum(['pass', 'hold', 'correct', 'duplicate', 'insufficient_evidence']),
  summary: z.string().optional(),
  toolName: z.string().optional(),
  model: z.string().optional(),
  qaRunRef: z.string().optional(),
  flags: z
    .array(
      z.object({
        targetSection: z
          .enum(['entity', 'time', 'relationship', 'claim', 'source', 'media', 'question', 'next_entity'])
          .optional(),
        targetRef: z.string().optional(),
        severity: z.enum(['info', 'minor', 'major', 'critical']).default('minor'),
        category: z.string().optional(),
        explanation: z.string().min(1),
        correctiveSource: z.string().optional(),
        state: z.enum(['pass', 'hold', 'correction', 'duplicate', 'insufficient_evidence']).default('hold'),
      }),
    )
    .default([]),
});
export type QaContract = z.infer<typeof qaContractSchema>;

/* ---- human decision ---- */
export const humanDecisionSchema = z
  .object({
    decision: z.enum(['approve', 'approve_with_holds', 'return', 'merge', 'reject']),
    reviewer: z.string().optional(),
    instructions: z.string().optional(),
    reason: z.string().optional(),
    mergeTargetSlug: z.string().optional(),
    heldItemRefs: z.array(z.string()).default([]),
  })
  .superRefine((d, ctx) => {
    if (d.decision === 'merge' && !d.mergeTargetSlug)
      ctx.addIssue({ code: 'custom', path: ['mergeTargetSlug'], message: 'merge requires a mergeTargetSlug' });
    if (d.decision === 'return' && !d.instructions)
      ctx.addIssue({ code: 'custom', path: ['instructions'], message: 'return requires correction instructions' });
    if (d.decision === 'reject' && !d.reason)
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'reject requires a reason' });
  });
export type HumanDecisionInput = z.infer<typeof humanDecisionSchema>;

/* ---- run / job inputs ---- */
export const createRunSchema = z.object({
  batchLimit: z.number().int().min(1, 'batch limit must be a positive integer'),
  operator: z.string().optional(),
});
export const manualCaptureSchema = z
  .object({
    title: z.string().optional(),
    url: z.string().url().optional(),
    focusNote: z.string().optional(),
    priority: z.number().int().min(0).max(100).default(0),
  })
  .superRefine((v, ctx) => {
    if (!v.title && !v.url)
      ctx.addIssue({ code: 'custom', path: ['title'], message: 'a title or URL is required' });
  });
export type CreateRunInput = z.infer<typeof createRunSchema>;
export type ManualCaptureInput = z.infer<typeof manualCaptureSchema>;
