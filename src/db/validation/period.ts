import { z } from 'zod';
import { confidenceSchema, slugSchema, yearSchema } from './common';

export const timePrecisionValues = [
  'exact',
  'approximate',
  'range',
  'decade',
  'century',
  'era',
  'unknown',
] as const;

export const periodCreateSchema = z
  .object({
    slug: slugSchema.optional(),
    label: z.string().min(1, 'label is required'),
    precision: z.enum(timePrecisionValues),
    startYear: yearSchema.optional(),
    endYear: yearSchema.optional(),
    isStartUncertain: z.boolean().default(false),
    isEndUncertain: z.boolean().default(false),
    displayYear: yearSchema.optional(),
    confidence: confidenceSchema.default(50),
    isPlaceholder: z.boolean().default(true),
    isSynthetic: z.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    if (val.startYear !== undefined && val.endYear !== undefined && val.startYear > val.endYear) {
      ctx.addIssue({
        code: 'custom',
        path: ['startYear'],
        message: `startYear (${val.startYear}) must be <= endYear (${val.endYear})`,
      });
    }
    if (val.precision === 'exact' && val.startYear === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['startYear'],
        message: 'precision "exact" requires startYear to be set',
      });
    }
  });

export type PeriodCreateInput = z.infer<typeof periodCreateSchema>;
