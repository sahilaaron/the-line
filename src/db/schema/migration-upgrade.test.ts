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
  it('0008 reparents extra v3 packages so UNIQUE(job_id) can be added without loss', async () => {
    const journal = JSON.parse(fs.readFileSync(path.join(DRIZZLE, 'meta/_journal.json'), 'utf8'));
    const upto7 = journal.entries.filter((e: { idx: number }) => e.idx <= 7);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-dup-'));
    fs.mkdirSync(path.join(tmp, 'meta'));
    fs.writeFileSync(path.join(tmp, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: upto7 }));
    for (const e of upto7) fs.copyFileSync(path.join(DRIZZLE, `${e.tag}.sql`), path.join(tmp, `${e.tag}.sql`));

    const { db, pg } = createTestDb();
    await migrate(db, { migrationsFolder: tmp });

    // One valid v3 job with TWO packages of different hashes, each with items.
    await pg.exec(`INSERT INTO research_jobs (id, central_title, sequence, dedupe_key) VALUES ('jdup','Dup Subject',1,'jdup');`);
    await pg.exec(`INSERT INTO research_packages (id, job_id, central_label, central_slug, envelope, submission_hash, submitted_at) VALUES
      ('pk-a','jdup','Dup Subject','dup-subject','{"v":1}'::jsonb,'hash-a','2024-01-01T00:00:00Z'),
      ('pk-b','jdup','Dup Subject','dup-subject','{"v":2}'::jsonb,'hash-b','2024-02-02T00:00:00Z');`);
    await pg.exec(`INSERT INTO research_package_items (id, package_id, section, local_ref, payload) VALUES
      ('it-a','pk-a','entity','central','{"ref":"central"}'::jsonb),
      ('it-b','pk-b','entity','central','{"ref":"central"}'::jsonb);`);
    await pg.exec(`INSERT INTO qa_results (id, package_id, recommendation) VALUES ('qa-a','pk-a','pass');`);

    // Apply the constraint migration (+ the v5 column migration).
    await execFile(pg, '0008_cycle8b_v4_agent_hold_one_package');
    await execFile(pg, '0009_cycle8b_v5_submission_lease_token');

    // Both packages preserved.
    const pkgs = await pg.query<{ id: string; job_id: string }>(`SELECT id, job_id FROM research_packages ORDER BY id;`);
    expect(pkgs.rows.length).toBe(2);
    const byId = Object.fromEntries(pkgs.rows.map((r) => [r.id, r.job_id]));
    // The earliest package keeps the original job; the extra is reparented.
    expect(byId['pk-a']).toBe('jdup');
    expect(byId['pk-b']).not.toBe('jdup');
    // The generated job is real, honest, and unique.
    const genJob = (await pg.query<{ id: string; status: string; dedupe_key: string; focus_note: string }>(
      `SELECT id, status, dedupe_key, focus_note FROM research_jobs WHERE id = $1;`, [byId['pk-b']] as never,
    )).rows[0];
    expect(genJob.status).toBe('submitted');
    expect(genJob.dedupe_key).toContain('migrated-0008');
    expect(genJob.focus_note).toContain('one-package-per-job');
    // Items and provenance are unchanged.
    const items = await pg.query<{ id: string; package_id: string }>(`SELECT id, package_id FROM research_package_items ORDER BY id;`);
    expect(items.rows.map((r) => `${r.id}:${r.package_id}`)).toEqual(['it-a:pk-a', 'it-b:pk-b']);
    expect((await pg.query(`SELECT id FROM qa_results;`)).rows.length).toBe(1);

    // The one-package-per-job constraint is now active.
    await expect(
      pg.exec(`INSERT INTO research_packages (id, job_id, central_label, central_slug, envelope, submission_hash) VALUES ('pk-c','jdup','x','x','{}'::jsonb,'hash-c');`),
    ).rejects.toThrow();

    await pg.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
