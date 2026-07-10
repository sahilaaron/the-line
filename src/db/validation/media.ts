import { z } from 'zod';
import { idSchema } from './common';

export const mediaTypeValues = ['image', 'video', 'audio', 'document', 'map', 'model_3d'] as const;
export const mediaRightsStatusValues = [
  'unknown',
  'cleared',
  'restricted',
  'public_domain',
  'synthetic_fixture',
] as const;
export const mediaSubjectTypeValues = ['entity', 'period', 'yol_composition'] as const;

export const mediaImportSchema = z
  .object({
    title: z.string().min(1, 'title is required'),
    mediaType: z.enum(mediaTypeValues),
    creator: z.string().optional(),
    sourceOrganisation: z.string().optional(),
    sourceUrl: z.string().url('sourceUrl must be a valid URL').optional(),
    licence: z.string().optional(),
    isPublicDomain: z.boolean().default(false),
    attributionText: z.string().optional(),
    rightsStatus: z.enum(mediaRightsStatusValues).default('unknown'),
    isSynthetic: z.boolean().default(false),
    associations: z
      .array(
        z.object({
          subjectType: z.enum(mediaSubjectTypeValues),
          subjectId: idSchema,
        }),
      )
      .default([]),
  })
  .superRefine((val, ctx) => {
    if (val.licence && !val.isSynthetic && val.rightsStatus !== 'public_domain' && val.rightsStatus !== 'cleared') {
      ctx.addIssue({
        code: 'custom',
        path: ['licence'],
        message:
          'a licence may only be claimed by synthetic fixture media or media with rightsStatus "public_domain"/"cleared"',
      });
    }
  });

export type MediaImportInput = z.infer<typeof mediaImportSchema>;
