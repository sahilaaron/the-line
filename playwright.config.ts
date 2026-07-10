import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  retries: 1,
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
