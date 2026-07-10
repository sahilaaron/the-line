# The Line — Prototype

An interactive 3D experience of travelling through human history: a
cosmic timeline (Line View) with descents into period-styled **Year on
Line** pages, over a local Postgres-compatible historical data layer.
See `GOAL.md` for the last completed cycle and `docs/` for architecture,
scope and decisions.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Open `http://localhost:3000/?debug=1` for the live tuning panel + metrics.

The loop: scroll down to travel back in time → arrow keys step anchors →
at **1969** or **1769**, click the Earth → descend through the clouds
into that year's Year on Line page → "Return to the Line" (you land on
the year you left).

Each year renders through the shared **Year Visual Identity** system
(`src/data/identity/`): 1969 is space-age editorial, 1769 is engraved
broadsheet. The current stacked editorial YoL layout is an accepted
functional prototype — the intended nested local-timeline interaction is
a separate future cycle (see `GOAL.md`, Deferred).

## Checks

```bash
npm run lint
npm run typecheck
npm test               # vitest logic tests
npx playwright install chromium   # once
npm run test:e2e       # core loop + both year journeys, headless
```

CI (`.github/workflows/ci.yml`) runs the same commands on every PR.

All historical content is **placeholder/provisional** — flagged in
`src/data/` — and must not be treated as researched history. Generated
imagery is labelled as such in every caption; nothing is archival media.

## Database layer

Local, PostgreSQL-compatible data layer under `src/db/` — Drizzle ORM +
Drizzle Kit + PGlite (embedded; no server/Docker/credentials) + Zod.
Wired into the UI **read-only** via the Seed Inspector / Line View data
layer (`/api/line-data`); the YoL pages still render from placeholder
content modules — the canonical DB → YoL read model is a future build.
See `docs/database/` for schema, integrity rules, import/export and the
query cookbook.

```bash
npm run db:generate       # drizzle-kit generate (SQL migrations -> drizzle/)
npm run db:migrate        # apply migrations to the local dev PGlite dir
npm run db:check          # drizzle-kit check
npm run db:reset          # wipe local PGlite data dir + re-migrate
npm run db:seed           # prototype seed (5 anchors), idempotent
npm run db:seed:synthetic # + deterministic synthetic stress seed
npm run db:validate      # Zod validation self-tests
npm run db:test           # vitest suite for src/db, isolated in-memory PGlite
npm run db:benchmark      # writes docs/generated/database-benchmark.md
npm run db:audit          # integrity audit (non-zero exit on errors)
npm run db:export         # export full DB (or one YoL closure) to JSON
npm run db:import         # transactional import from a JSON export
```
