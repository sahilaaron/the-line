/**
 * Shared Zod primitives mirroring the DB conventions in schema/shared.ts:
 * confidence/strength are 0..100 integers, ids are non-empty strings,
 * slugs are lowercase-kebab.
 */
import { z } from 'zod';

export const confidenceSchema = z
  .number()
  .int('confidence must be an integer 0..100')
  .min(0, 'confidence must be >= 0')
  .max(100, 'confidence must be <= 100');

export const strengthSchema = z
  .number()
  .int('strength must be an integer 0..100')
  .min(0, 'strength must be >= 0')
  .max(100, 'strength must be <= 100');

export const slugSchema = z
  .string()
  .min(1, 'slug is required')
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase-kebab-case (e.g. "steam-engine")');

export const idSchema = z.string().min(1, 'id is required');

export const yearSchema = z
  .number()
  .int('year must be an integer astronomical year (negative = BCE)')
  .min(-999999)
  .max(999999);
