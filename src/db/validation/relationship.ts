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
    // A relationship needs a legacy enum `type` OR a registry `typeKey`
    // (at least one — enforced in the superRefine below).
    type: z
      .enum(relationshipTypeValues, {
        error: (issue) => `"${String(issue.input)}" is not a valid relationship type`,
      })
      .optional(),
    typeKey: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/, 'typeKey must be a registry key (snake_case)')
      .optional(),
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
    if (val.type == null && val.typeKey == null) {
      ctx.addIssue({
        code: 'custom',
        path: ['type'],
        message: 'a relationship requires a type or a typeKey',
      });
    }
  });

export type RelationshipCreateInput = z.infer<typeof relationshipCreateSchema>;
