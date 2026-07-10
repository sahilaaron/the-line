import { z } from 'zod';
import { confidenceSchema, idSchema } from './common';

export const claimSubjectTypeValues = ['entity', 'relationship', 'period'] as const;
export const claimVerificationStatusValues = [
  'unverified',
  'corroborated',
  'verified',
  'disputed',
] as const;

export const claimCreateSchema = z
  .object({
    text: z.string().min(1, 'text is required'),
    subjectType: z.enum(claimSubjectTypeValues),
    subjectId: idSchema,
    confidence: confidenceSchema.default(50),
    verificationStatus: z.enum(claimVerificationStatusValues).default('unverified'),
    disputed: z.boolean().default(false),
    isSynthetic: z.boolean().default(false),
    /** Source ids the claim should be linked to at creation time (optional). */
    sourceIds: z.array(idSchema).optional(),
  })
  .superRefine((val, ctx) => {
    if (
      (val.verificationStatus === 'verified' || val.verificationStatus === 'corroborated') &&
      (!val.sourceIds || val.sourceIds.length === 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceIds'],
        message: `verificationStatus "${val.verificationStatus}" requires at least one linked source`,
      });
    }
  });

export type ClaimCreateInput = z.infer<typeof claimCreateSchema>;

export const sourceTypeValues = [
  'book',
  'article',
  'website',
  'primary_document',
  'video',
  'dataset',
  'oral_history',
  'other',
] as const;

export const sourceCreateSchema = z.object({
  title: z.string().min(1, 'title is required'),
  type: z.enum(sourceTypeValues),
  publicationYear: z.number().int().optional(),
  url: z.string().url('url must be a valid URL').optional(),
  identifier: z.string().optional(),
  notes: z.string().optional(),
  isSynthetic: z.boolean().default(false),
});

export type SourceCreateInput = z.infer<typeof sourceCreateSchema>;

export const claimSourceLinkSchema = z.object({
  claimId: idSchema,
  sourceId: idSchema,
  quotation: z.string().optional(),
  locator: z.string().optional(),
});

export type ClaimSourceLinkInput = z.infer<typeof claimSourceLinkSchema>;
