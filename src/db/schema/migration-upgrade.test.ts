/**
 * Cycle 8B v4 — migration-upgrade test with EXISTING held rows. Proves the
 * 0007 hold-provenance backfill and the 0008 agent-hold CHECK upgrade keep old
 * `hold_source` rows coherent (held = human_held OR qa_held OR agent_held).
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { createTestDb } from '../client/test';

const DRIZZLE = path.join(process.cwd(), 'drizzle');

async function execFile(pg: { exec: (s: string) => Promise<unknown> }, tag: string) {
  const sql = fs.readFileSync(path.join(DRIZZLE, `${tag}.sql`), 'utf8');
  for (const stmt of sql.split('--> statement-breakpoint')) {
    const t = stmt.trim();
    if (t) await pg.exec(t);
  }
}

describe('migration upgrade with existing held rows', () => {
  it('0007+0008 backfill keeps legacy hold_source rows coherent', async () => {
    const journal = JSON.parse(fs.readFileSync(path.join(DRIZZLE, 'meta/_journal.json'), 'utf8'));
    const upto6 = journal.entries.filter((e: { idx: number }) => e.idx <= 6);

    // A migrations folder containing only 0000..0006 (the pre-v3/v4 schema).
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-upgrade-'));
    fs.mkdirSync(path.join(tmp, 'meta'));
    fs.writeFileSync(path.join(tmp, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: upto6 }));
    for (const e of upto6) fs.copyFileSync(path.join(DRIZZLE, `${e.tag}.sql`), path.join(tmp, `${e.tag}.sql`));

    const { db, pg } = createTestDb();
    await migrate(db, { migrationsFolder: tmp });

    // Seed legacy held rows using the OLD hold_source column.
    await pg.exec(`INSERT INTO research_jobs (id, central_title, sequence, dedupe_key) VALUES ('j1','Legacy',1,'j1');`);
    await pg.exec(`INSERT INTO research_packages (id, job_id, central_label, central_slug, envelope, submission_hash) VALUES ('p1','j1','L','l','{}'::jsonb,'h');`);
    await pg.exec(`INSERT INTO research_package_items (id, package_id, section, local_ref, payload, held, hold_source) VALUES
      ('i-human','p1','relationship','r1','{}'::jsonb,true,'human'),
      ('i-qa','p1','relationship','r2','{}'::jsonb,true,'qa'),
      ('i-none','p1','relationship','r3','{}'::jsonb,false,null);`);

    // Apply the NEW migrations on top (this is the upgrade under test).
    await execFile(pg, '0007_cycle8b_v3_independent_holds');
    await execFile(pg, '0008_cycle8b_v4_agent_hold_one_package');

    const rows = await pg.query<{ id: string; held: boolean; human_held: boolean; qa_held: boolean; agent_held: boolean }>(
      `SELECT id, held, human_held, qa_held, agent_held FROM research_package_items ORDER BY id;`,
    );
    const by = Object.fromEntries(rows.rows.map((r) => [r.id, r]));
    expect(by['i-human']).toMatchObject({ held: true, human_held: true, qa_held: false, agent_held: false });
    expect(by['i-qa']).toMatchObject({ held: true, human_held: false, qa_held: true, agent_held: false });
    expect(by['i-none']).toMatchObject({ held: false, human_held: false, qa_held: false, agent_held: false });

    // The consistency CHECK is active: an incoherent row is rejected.
    await expect(
      pg.exec(`INSERT INTO research_package_items (id, package_id, section, local_ref, payload, held, human_held, qa_held, agent_held) VALUES ('bad','p1','relationship','r4','{}'::jsonb,true,false,false,false);`),
    ).rejects.toThrow();

    await pg.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
