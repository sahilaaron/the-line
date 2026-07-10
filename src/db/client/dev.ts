/**
 * Dev-persistent PGlite connection. Data lives on disk under
 * PGLITE_DATA_DIR (default `.pglite-data/dev` at repo root), gitignored.
 * Use this from scripts (db:seed, db:audit, db:export, etc.) — never from
 * React components (no SQL/DB calls in src/experience or app/**).
 */
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../schema';

const DEFAULT_DIR = path.join(process.cwd(), '.pglite-data', 'dev');

export function resolveDevDataDir(): string {
  return process.env.PGLITE_DATA_DIR
    ? path.resolve(process.env.PGLITE_DATA_DIR)
    : DEFAULT_DIR;
}

let client: PGlite | undefined;

/** Returns a singleton PGlite client backed by the dev data directory.
 * Ensures the parent directory exists first — PGlite's own constructor
 * does not create missing parent directories on this project's sandbox. */
export function getDevClient(): PGlite {
  if (!client) {
    const dir = resolveDevDataDir();
    fs.mkdirSync(dir, { recursive: true });
    client = new PGlite(dir);
  }
  return client;
}

export function getDevDb() {
  return drizzle(getDevClient(), { schema });
}

export async function closeDevClient(): Promise<void> {
  if (client) {
    await client.close();
    client = undefined;
  }
}
