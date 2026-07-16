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
  'discovery',
  'technology',
  'movement',
  'publication',
  'product',
  'law_policy',
] as const;

/** Display labels for entity kinds (UI only — never changes the enum value). */
export const ENTITY_KIND_LABELS: Record<(typeof entityKindValues)[number], string> = {
  person: 'Person',
  invention: 'Invention',
  event: 'Event',
  theme: 'Theme',
  place: 'Place',
  organisation: 'Organization',
  civilisation: 'Civilisation',
  concept: 'Concept',
  period: 'Period',
  discovery: 'Discovery',
  technology: 'Technology',
  movement: 'Movement',
  publication: 'Publication',
  product: 'Product',
  law_policy: 'Law / Policy',
};

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
