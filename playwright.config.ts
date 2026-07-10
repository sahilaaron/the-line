import { defineConfig } from '@playwright/test';

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
  },
});
