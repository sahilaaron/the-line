import { describe, expect, it } from 'vitest';
import {
  claimCreateSchema,
  claimSourceLinkSchema,
  entityCreateSchema,
  mediaImportSchema,
  periodCreateSchema,
  relationshipCreateSchema,
  sourceCreateSchema,
  yolCompositionImportSchema,
} from './index';

describe('entityCreateSchema', () => {
  it('accepts a valid entity', () => {
    const r = entityCreateSchema.safeParse({ slug: 'steam-engine', kind: 'invention', label: 'Steam Engine' });
    expect(r.success).toBe(true);
  });
  it('rejects a non-kebab slug with a useful message', () => {
    const r = entityCreateSchema.safeParse({ slug: 'Steam Engine', kind: 'invention', label: 'x' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/kebab/);
  });
  it('rejects an illegal kind', () => {
    const r = entityCreateSchema.safeParse({ slug: 'x', kind: 'wizard', label: 'x' });
    expect(r.success).toBe(false);
  });
});

describe('periodCreateSchema', () => {
  it('accepts a valid exact period', () => {
    const r = periodCreateSchema.safeParse({ label: '1969', precision: 'exact', startYear: 1969, endYear: 1969 });
    expect(r.success).toBe(true);
  });
  it('accepts negative (BCE) years', () => {
    const r = periodCreateSchema.safeParse({ label: '10,000 BCE', precision: 'approximate', startYear: -9999, endYear: -9000 });
    expect(r.success).toBe(true);
  });
  it('rejects malformed range where start > end', () => {
    const r = periodCreateSchema.safeParse({ label: 'bad', precision: 'range', startYear: 100, endYear: -100 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toContain('startYear');
  });
  it('rejects "exact" precision missing startYear', () => {
    const r = periodCreateSchema.safeParse({ label: 'bad', precision: 'exact' });
    expect(r.success).toBe(false);
  });
});

describe('relationshipCreateSchema', () => {
  it('accepts a valid relationship', () => {
    const r = relationshipCreateSchema.safeParse({ sourceEntityId: 'a', targetEntityId: 'b', type: 'influenced' });
    expect(r.success).toBe(true);
  });
  it('rejects an illegal relationship type', () => {
    const r = relationshipCreateSchema.safeParse({ sourceEntityId: 'a', targetEntityId: 'b', type: 'caused' });
    expect(r.success).toBe(false);
  });
  it('rejects a self-relationship', () => {
    const r = relationshipCreateSchema.safeParse({ sourceEntityId: 'a', targetEntityId: 'a', type: 'influenced' });
    expect(r.success).toBe(false);
  });
  it('rejects out-of-range confidence', () => {
    const r = relationshipCreateSchema.safeParse({ sourceEntityId: 'a', targetEntityId: 'b', type: 'influenced', confidence: 150 });
    expect(r.success).toBe(false);
  });
  it('rejects out-of-range strength', () => {
    const r = relationshipCreateSchema.safeParse({ sourceEntityId: 'a', targetEntityId: 'b', type: 'influenced', strength: -1 });
    expect(r.success).toBe(false);
  });
});

describe('claimCreateSchema', () => {
  it('accepts unverified without a source', () => {
    const r = claimCreateSchema.safeParse({ text: 'x', subjectType: 'entity', subjectId: 'a' });
    expect(r.success).toBe(true);
  });
  it('rejects verified without a linked source', () => {
    const r = claimCreateSchema.safeParse({ text: 'x', subjectType: 'entity', subjectId: 'a', verificationStatus: 'verified' });
    expect(r.success).toBe(false);
  });
  it('accepts verified with a linked source', () => {
    const r = claimCreateSchema.safeParse({
      text: 'x',
      subjectType: 'entity',
      subjectId: 'a',
      verificationStatus: 'verified',
      sourceIds: ['s1'],
    });
    expect(r.success).toBe(true);
  });
});

describe('claimSourceLinkSchema', () => {
  it('rejects a missing entity reference (empty id)', () => {
    const r = claimSourceLinkSchema.safeParse({ claimId: '', sourceId: 'a' });
    expect(r.success).toBe(false);
  });
});

describe('sourceCreateSchema', () => {
  it('accepts a valid source', () => {
    expect(sourceCreateSchema.safeParse({ title: 'x', type: 'book' }).success).toBe(true);
  });
  it('rejects an invalid url', () => {
    expect(sourceCreateSchema.safeParse({ title: 'x', type: 'book', url: 'not-a-url' }).success).toBe(false);
  });
});

describe('yolCompositionImportSchema', () => {
  it('accepts a minimal valid import', () => {
    const r = yolCompositionImportSchema.safeParse({ periodId: 'p1', title: 'x', thesis: 'x', atmospherePreset: 'orbital' });
    expect(r.success).toBe(true);
  });
  it('rejects a missing thesis', () => {
    const r = yolCompositionImportSchema.safeParse({ periodId: 'p1', title: 'x', atmospherePreset: 'orbital' });
    expect(r.success).toBe(false);
  });
});

describe('mediaImportSchema', () => {
  it('allows synthetic fixture media to claim a licence', () => {
    const r = mediaImportSchema.safeParse({ title: 'x', mediaType: 'image', licence: 'CC0', isSynthetic: true });
    expect(r.success).toBe(true);
  });
  it('rejects a non-synthetic, non-cleared item claiming a licence', () => {
    const r = mediaImportSchema.safeParse({ title: 'x', mediaType: 'image', licence: 'CC0', isSynthetic: false });
    expect(r.success).toBe(false);
  });
  it('allows a cleared, non-synthetic item to claim a licence', () => {
    const r = mediaImportSchema.safeParse({
      title: 'x',
      mediaType: 'image',
      licence: 'CC0',
      isSynthetic: false,
      rightsStatus: 'cleared',
    });
    expect(r.success).toBe(true);
  });
});
