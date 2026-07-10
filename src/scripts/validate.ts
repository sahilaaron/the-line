/**
 * db:validate — standalone self-test of every Zod validation schema
 * (independent of the vitest suite, for fast CI sanity-checking). Runs one
 * valid and one invalid case per schema, prints a pass/fail table, exits
 * non-zero if any check doesn't match its expectation.
 */
import {
  claimCreateSchema,
  claimSourceLinkSchema,
  entityCreateSchema,
  mediaImportSchema,
  periodCreateSchema,
  relationshipCreateSchema,
  sourceCreateSchema,
  yolCompositionImportSchema,
} from '../db/validation';

interface Check {
  name: string;
  expectValid: boolean;
  result: { success: boolean };
}

const checks: Check[] = [];

function record(name: string, expectValid: boolean, result: { success: boolean }) {
  checks.push({ name, expectValid, result });
}

record(
  'entity: valid',
  true,
  entityCreateSchema.safeParse({ slug: 'steam-engine', kind: 'invention', label: 'Steam Engine' }),
);
record('entity: bad slug', false, entityCreateSchema.safeParse({ slug: 'Not A Slug', kind: 'invention', label: 'x' }));
record(
  'entity: bad kind',
  false,
  entityCreateSchema.safeParse({ slug: 'x', kind: 'wizard', label: 'x' }),
);

record(
  'period: valid exact',
  true,
  periodCreateSchema.safeParse({ label: '1969', precision: 'exact', startYear: 1969, endYear: 1969 }),
);
record(
  'period: malformed BCE range (start after end)',
  false,
  periodCreateSchema.safeParse({ label: 'bad range', precision: 'range', startYear: 100, endYear: -100 }),
);

record(
  'relationship: valid',
  true,
  relationshipCreateSchema.safeParse({ sourceEntityId: 'a', targetEntityId: 'b', type: 'influenced' }),
);
record(
  'relationship: illegal type',
  false,
  relationshipCreateSchema.safeParse({ sourceEntityId: 'a', targetEntityId: 'b', type: 'caused' }),
);
record(
  'relationship: self-link',
  false,
  relationshipCreateSchema.safeParse({ sourceEntityId: 'a', targetEntityId: 'a', type: 'influenced' }),
);
record(
  'relationship: invalid confidence',
  false,
  relationshipCreateSchema.safeParse({ sourceEntityId: 'a', targetEntityId: 'b', type: 'influenced', confidence: 500 }),
);

record(
  'claim: valid unverified (no source needed)',
  true,
  claimCreateSchema.safeParse({ text: 'x', subjectType: 'entity', subjectId: 'a' }),
);
record(
  'claim: verified without source',
  false,
  claimCreateSchema.safeParse({ text: 'x', subjectType: 'entity', subjectId: 'a', verificationStatus: 'verified' }),
);

record('source: valid', true, sourceCreateSchema.safeParse({ title: 'x', type: 'book' }));
record('claim-source link: missing entity ref', false, claimSourceLinkSchema.safeParse({ claimId: '', sourceId: 'a' }));

record(
  'yol import: valid',
  true,
  yolCompositionImportSchema.safeParse({ periodId: 'p1', title: 'x', thesis: 'x', atmospherePreset: 'orbital' }),
);
record(
  'yol import: missing thesis',
  false,
  yolCompositionImportSchema.safeParse({ periodId: 'p1', title: 'x', atmospherePreset: 'orbital' }),
);

record(
  'media: synthetic may claim a licence',
  true,
  mediaImportSchema.safeParse({ title: 'x', mediaType: 'image', licence: 'CC0', isSynthetic: true }),
);
record(
  'media: non-synthetic unknown-rights cannot claim a licence',
  false,
  mediaImportSchema.safeParse({ title: 'x', mediaType: 'image', licence: 'CC0', isSynthetic: false }),
);

let failed = 0;
for (const c of checks) {
  const ok = c.result.success === c.expectValid;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
}

console.log(`\n[db:validate] ${checks.length - failed}/${checks.length} checks passed.`);
if (failed > 0) process.exit(1);
