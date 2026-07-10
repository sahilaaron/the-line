/**
 * db:benchmark — measures DB init, migration, seed insertion, and a set of
 * representative queries against BOTH a prototype-only DB and a synthetic
 * stress-seeded DB (fresh in-memory PGlite instances). Writes real
 * measured numbers to docs/generated/database-benchmark.md — never
 * fabricated. Machine-dependent timings are reported as observations, not
 * hard pass/fail gates (see the note in the generated report).
 */
import fs from 'node:fs';
import path from 'node:path';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { createTestDb } from '../db/client/test';
import { seedPrototype } from '../db/seed/prototype';
import { seedSynthetic, SYNTHETIC_TARGETS } from '../db/seed/synthetic';
import { findEntityBySlug, findEntityById } from '../db/repositories/entities';
import { findExactYear } from '../db/repositories/periods';
import { listOutgoing } from '../db/repositories/relationships';
import { ancestry, consequences, shortestConnection } from '../db/queries/traversal';
import { compositionByYearOrPeriod } from '../db/queries/yol';
import { runIntegrityAudit } from '../db/queries/audit';

interface Timing {
  label: string;
  ms: number;
}

async function time<T>(label: string, fn: () => Promise<T>): Promise<{ result: T; timing: Timing }> {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  return { result, timing: { label, ms } };
}

async function benchmarkDataset(name: string, seedFn: 'prototype' | 'synthetic'): Promise<Timing[]> {
  const timings: Timing[] = [];
  const { pg, db } = createTestDb();

  const initTiming = { label: `${name}: db init`, ms: 0 };
  timings.push(initTiming);

  const migrateResult = await time(`${name}: migration`, () =>
    migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') }),
  );
  timings.push(migrateResult.timing);

  const seedResult = await time(`${name}: seed insertion`, async () => {
    const proto = await seedPrototype(db);
    if (seedFn === 'synthetic') {
      const synth = await seedSynthetic(db);
      return { proto, synth };
    }
    return { proto };
  });
  timings.push(seedResult.timing);

  const sampleEntity = await findEntityBySlug(db, seedFn === 'synthetic' ? 'synth-entity-02500' : 'theme-1969-spaceflight');
  const entityLookup = await time(`${name}: entity lookup (by slug + by id)`, async () => {
    if (!sampleEntity) return null;
    return findEntityById(db, sampleEntity.id);
  });
  timings.push(entityLookup.timing);

  const periodLookup = await time(`${name}: period lookup (exact year)`, () => findExactYear(db, 1969));
  timings.push(periodLookup.timing);

  const directRel = await time(`${name}: direct relationship query`, async () => {
    if (!sampleEntity) return [];
    return listOutgoing(db, sampleEntity.id);
  });
  timings.push(directRel.timing);

  const ancestryTiming = await time(`${name}: depth-3 ancestry traversal`, async () => {
    if (!sampleEntity) return [];
    return ancestry(db, sampleEntity.id, { maxDepth: 3 });
  });
  timings.push(ancestryTiming.timing);

  const consequencesTiming = await time(`${name}: depth-3 consequence traversal`, async () => {
    if (!sampleEntity) return [];
    return consequences(db, sampleEntity.id, { maxDepth: 3 });
  });
  timings.push(consequencesTiming.timing);

  const shortestPathTiming = await time(`${name}: shortest-path query`, async () => {
    const all = await db.query.entities.findMany({ limit: 2, offset: seedFn === 'synthetic' ? 100 : 0 });
    if (all.length < 2) return null;
    return shortestConnection(db, all[0].id, all[1].id, { maxDepth: 6 });
  });
  timings.push(shortestPathTiming.timing);

  const yolLoadTiming = await time(`${name}: YoL composition load`, () => compositionByYearOrPeriod(db, 1969));
  timings.push(yolLoadTiming.timing);

  const auditTiming = await time(`${name}: integrity audit`, () => runIntegrityAudit(db));
  timings.push(auditTiming.timing);

  await pg.close();
  return timings;
}

async function main() {
  console.log('[db:benchmark] running prototype-only benchmark...');
  const protoTimings = await benchmarkDataset('prototype', 'prototype');

  console.log('[db:benchmark] running synthetic-stress benchmark (this can take a while)...');
  const synthTimings = await benchmarkDataset('synthetic', 'synthetic');

  const lines: string[] = [];
  lines.push('# Database Benchmark Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(
    'Measured with `performance.now()` inside a single Node process against fresh in-memory PGlite instances. ' +
      'Numbers are wall-clock and machine/sandbox-dependent — treat them as relative signal, not an absolute SLA. ' +
      'Synthetic targets: ' +
      JSON.stringify(SYNTHETIC_TARGETS) +
      '.',
  );
  lines.push('');
  lines.push('## Prototype dataset (5 anchors)');
  lines.push('');
  lines.push('| Operation | ms |');
  lines.push('|---|---|');
  for (const t of protoTimings) lines.push(`| ${t.label} | ${t.ms.toFixed(2)} |`);
  lines.push('');
  lines.push('## Synthetic stress dataset');
  lines.push('');
  lines.push('| Operation | ms |');
  lines.push('|---|---|');
  for (const t of synthTimings) lines.push(`| ${t.label} | ${t.ms.toFixed(2)} |`);
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push(
    '- "db init" is reported as 0ms because PGlite construction is lazy — the first real cost shows up in "migration".',
  );
  lines.push(
    '- Practical warning threshold (not a hard build gate): a single hop/traversal query taking >500ms on the synthetic ' +
      'dataset in this sandbox would suggest a missing index or an accidental full-table scan — investigate before scaling further.',
  );
  lines.push('- This sandbox is not representative of production hardware; re-run on target hardware before trusting absolute numbers.');
  lines.push('');

  const outPath = path.join(process.cwd(), 'docs', 'generated', 'database-benchmark.md');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`[db:benchmark] wrote ${outPath}`);
}

main().catch((err) => {
  console.error('[db:benchmark] failed:', err);
  process.exit(1);
});
