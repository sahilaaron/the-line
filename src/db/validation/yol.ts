import { z } from 'zod';
import { idSchema } from './common';

export const yolThemeImportSchema = z.object({
  themeEntityId: idSchema,
  importance: z.number().int().min(0).max(100).default(50),
  displayOrder: z.number().int().default(0),
  displayLabel: z.string().min(1).optional(),
});

export const yolPointRoleValues = ['overview', 'development', 'context', 'closing'] as const;

/** One local-chronology point (curation record; see schema/yol.ts). */
export const yolTimelinePointImportSchema = z
  .object({
    role: z.enum(yolPointRoleValues).default('development'),
    entityId: idSchema.optional(),
    periodId: idSchema.optional(),
    displayOrder: z.number().int(),
    sectionKey: z.string().min(1).optional(),
    headline: z.string().min(1).optional(),
    summary: z.string().min(1).optional(),
    isPlaceholder: z.boolean().default(true),
    isSynthetic: z.boolean().default(false),
    themeEntityIds: z.array(idSchema).default([]),
  })
  .superRefine((val, ctx) => {
    if (val.role === 'development' && !val.entityId) {
      ctx.addIssue({
        code: 'custom',
        path: ['entityId'],
        message: 'development points require an entityId (their historical subject)',
      });
    }
    if ((val.role === 'overview' || val.role === 'context') && !val.periodId) {
      ctx.addIssue({
        code: 'custom',
        path: ['periodId'],
        message: `${val.role} points require a periodId (their own time)`,
      });
    }
  });

export type YolTimelinePointImportInput = z.infer<typeof yolTimelinePointImportSchema>;

export const yolSceneHintImportSchema = z.object({
  hintKey: z.string().min(1, 'hintKey is required'),
  hintValue: z.string().min(1, 'hintValue is required'),
});

export const yolFeaturedEntityImportSchema = z.object({
  entityId: idSchema,
  displayOrder: z.number().int().default(0),
});

export const yolCompositionImportSchema = z.object({
  periodId: idSchema,
  anchorSlug: z.string().optional(),
  title: z.string().min(1, 'title is required'),
  thesis: z.string().min(1, 'thesis is required'),
  supportingLine: z.string().optional(),
  atmospherePreset: z.string().min(1, 'atmospherePreset is required'),
  isPlaceholder: z.boolean().default(true),
  isSynthetic: z.boolean().default(false),
  themes: z.array(yolThemeImportSchema).default([]),
  sceneHints: z.array(yolSceneHintImportSchema).default([]),
  featuredEntities: z.array(yolFeaturedEntityImportSchema).default([]),
});

export type YolCompositionImportInput = z.infer<typeof yolCompositionImportSchema>;
