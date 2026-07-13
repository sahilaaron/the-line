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
into that year's **local timeline world** → wheel/arrows travel the
year's own chronology beneath a fixed local marker (down = earlier, the
same grammar as the parent Line) → "Return to the Line" (you land on the
year you left).

Each year renders through the shared **Year Visual Identity** system
(`src/data/identity/`): 1969 is space-age editorial, 1769 is engraved
broadsheet. The YoL is a nested local timeline: context years, the year
overview, dated developments and a closing point, read from the database
(see below) with the TypeScript registry as an isolated fallback.

### 1769 — the Historical Field & recursive Topic Worlds

At **1769** the descent opens a continuous **1760–1780 Historical Field**
instead of the YoL: a deterministic temporal *collage* of ~60 provisional
records hanging in depth above a fixed local marker (wheel / ←→ / drag /
the `field-prev`·`field-next` controls travel the years; down/left =
earlier, as everywhere). Selecting a subject makes it **expand into its
own Topic World** — a horizontal run of editorial chapters — and a topic
can open a further topic to arbitrary depth
(Steam Engine → James Watt → University of Glasgow → Scottish
Enlightenment), all through one generic **world stack** with a breadcrumb,
Back, and EXACT restoration at every level. It is one persistent Canvas and
overlay worlds — no route change, no remount. **1969** keeps its
database-backed YoL untouched. Everything in the field/worlds is
clearly-provisional placeholder material (seeded CSS plates, no archival
media, no invented dates/quotes/sources).

Debug-mode URL tuning: append `?debug=1&tune.<key>=<n>` (e.g.
`?debug=1&tune.worldTransitionSec=0.35&tune.fieldVisibleRadiusYears=6`) to
pin any `config.ts` value live — used for visual iteration and to fit long
journeys into CI/sandbox budgets.

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
Wired into the UI **read-only** twice: the Seed Inspector / Line View
data layer (`/api/line-data`) and the canonical **DB → YoL read model**
(`GET /api/yol/[anchorSlug]`, `src/db/queries/yol-read-model.ts`), which
feeds each year's local chronology (timeline points, themes with stable
lens keys, claims/sources, provenance). With an empty or unavailable
database the YoL falls back to the provisional registry in
`src/data/yol/` — clearly isolated, never mixed.
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

## Research CRM (Cycle 8A)

An internal, local-only research pipeline turns sourced candidate history into
the **private canonical knowledge graph** (separate from public presentation).
Open `/crm` for the dashboard, queue/runs, package review and canonical-record
proof. The daily flow, queue order and external-agent commands are in
`docs/research-operations.md`; the package/QA/decision contract is in
`docs/research-package-contract.md`.

```bash
npm run db:migrate && npm run db:seed:research   # load the Steam Engine demo
npm run research:agent -- status                 # queue counts
npm run research:agent -- create-run --limit 5   # start a run
npm run research:agent -- claim --run <runId>    # claim the next job
```

The CRM is local/internal and has no authentication (a documented Cycle 8A
non-goal); do not expose it publicly without an auth layer.

