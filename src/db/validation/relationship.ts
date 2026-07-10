import { z } from 'zod';
import { confidenceSchema, idSchema, strengthSchema } from './common';

export const relationshipTypeValues = [
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
] as const;

export const relationshipCreateSchema = z
  .object({
    sourceEntityId: idSchema,
    targetEntityId: idSchema,
    type: z.enum(relationshipTypeValues, {
      error: (issue) =>
        issue.input === undefined
          ? 'type is required'
          : `"${String(issue.input)}" is not a valid relationship type`,
    }),
    explanation: z.string().optional(),
    strength: strengthSchema.default(50),
    confidence: confidenceSchema.default(50),
    disputed: z.boolean().default(false),
    validPeriodId: idSchema.optional(),
    isSynthetic: z.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    if (val.sourceEntityId === val.targetEntityId) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetEntityId'],
        message: 'a relationship cannot link an entity to itself (self-relationships are forbidden)',
      });
    }
  });

export type RelationshipCreateInput = z.infer<typeof relationshipCreateSchema>;
