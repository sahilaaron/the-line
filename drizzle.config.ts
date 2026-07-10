import type { Config } from 'drizzle-kit';

/**
 * Drizzle Kit config. `generate`/`check` operate statically against the
 * schema + migrations folder — no live DB connection is required for
 * those commands with PGlite. Migrations are committed under `drizzle/`
 * (chosen over `src/db/migrations` to match Drizzle Kit's own default
 * layout, minimizing config surface for a future agent).
 */
export default {
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
} satisfies Config;
