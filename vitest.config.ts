import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // PGlite (WASM) + vitest's default worker_threads pool crashed with a
    // SIGBUS in this sandbox (traced to a vite@8.1.4 regression, not
    // PGlite itself — downgrading to vite@7 plus `pool: 'forks'` fixed
    // it). See docs/implementation-notes.md Cycle 3 for detail.
    pool: 'forks',
  },
});
