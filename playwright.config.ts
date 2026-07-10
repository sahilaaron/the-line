import { defineConfig } from '@playwright/test';

// The e2e suite exercises the database-backed YoL, so the web server must
// point at a migrated + seeded PGlite directory. CI seeds a throwaway dir
// (RUNNER_TEMP) and forwards it here; locally we default to the same dev dir
// the db:* scripts use, so `npm run db:migrate && npm run db:seed` once is
// enough before `npm run test:e2e`.
const PGLITE_DATA_DIR = process.env.PGLITE_DATA_DIR ?? '.pglite-data/dev';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  retries: 1,
  // CI runners have 2 cores; parallel browser workers starve the
  // rAF/GSAP-driven experience and make arrival-timing specs flaky.
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:3011',
    viewport: { width: 1600, height: 900 },
  },
  webServer: {
    // CI/sandbox can point this at `next start` for fast boot
    command: process.env.PW_SERVER_CMD ?? 'npm run dev -- -p 3011',
    url: 'http://localhost:3011',
    reuseExistingServer: true,
    timeout: 120_000,
    // the server reads the seeded chronology from this PGlite directory
    env: { PGLITE_DATA_DIR },
  },
});
