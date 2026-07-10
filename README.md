# The Line — Desktop Physics Prototype + Database Foundation

An interactive 3D prototype of travelling through human history, plus a
local Postgres-compatible historical data layer underneath it. See
`GOAL.md` for the current cycle and `docs/` for architecture and scope.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Open `http://localhost:3000/?debug=1` for the live tuning panel + metrics.

The loop: scroll down to travel back in time → arrow keys step anchors →
at **1969**, click the Earth → descend through the clouds into the Year on
Line scene → "Return to the Line".

## Checks

```bash
npm run lint
npm run typecheck
npm test               # vitest logic tests
npx playwright install chromium   # once
npm run test:e2e       # full core-loop test in a headless browser
```

All content (anchors, themes, thesis lines) is **placeholder** — flagged in
`src/data/` — and must not be treated as researched history.

## Database layer (Cycle 3)

Local, PostgreSQL-compatible data layer under `src/db/` — Drizzle ORM +
Drizzle Kit + PGlite (embedded, no server/Docker/credentials) + Zod. See
`docs/database/` for schema, integrity rules, import/export, and a query
cookbook; see `docs/implementation-notes.md` (Cycle 3) for architecture
decisions and known limitations. **Not wired into the live 3D UI** —
structure and tooling only.

```bash
npm run db:generate       # drizzle-kit generate (SQL migrations -> drizzle/)
npm run db:migrate        # apply migrations to the local dev PGlite dir
npm run db:check          # drizzle-kit check
npm run db:reset          # wipe local PGlite data dir + re-migrate
npm run db:seed           # prototype seed (5 anchors), idempotent
npm run db:seed:synthetic # + deterministic synthetic stress seed
npm run db:validate       # Zod validation self-tests
npm run db:test           # vitest suite for src/db, isolated in-memory PGlite
npm run db:benchmark      # writes docs/generated/database-benchmark.md
npm run db:audit          # integrity audit (non-zero exit on errors)
npm run db:export         # export full DB (or one YoL closure) to JSON
npm run db:import         # transactional import from a JSON export
```
