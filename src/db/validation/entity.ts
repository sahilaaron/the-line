import { z } from 'zod';
import { idSchema, slugSchema } from './common';

export const entityKindValues = [
  'person',
  'invention',
  'event',
  'theme',
  'place',
  'organisation',
  'civilisation',
  'concept',
  'period',
] as const;

export const editorialStatusValues = [
  'draft',
  'in_review',
  'verified',
  'disputed',
  'published',
  'archived',
] as const;

export const entityCreateSchema = z.object({
  slug: slugSchema,
  kind: z.enum(entityKindValues),
  label: z.string().min(1, 'label is required'),
  summary: z.string().optional(),
  primaryPeriodId: idSchema.optional(),
  isPlaceholder: z.boolean().default(true),
  isSynthetic: z.boolean().default(false),
  editorialStatus: z.enum(editorialStatusValues).default('draft'),
});

export type EntityCreateInput = z.infer<typeof entityCreateSchema>;
