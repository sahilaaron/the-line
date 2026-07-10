# Cycle 3 (Database Foundation) — Completion Audit

_Independent verification run on 2026-07-10. Verdict: the cycle is
**functionally complete**. Every required piece exists and works. The Sonnet
session's own notes were accurate and unusually thorough; the two things it
got wrong were (1) claiming the full test suite passed when one assertion was
stale/red, and (2) not flagging that `next build` cannot run in place on this
sandbox mount. The stale test is now fixed; the build issue is an environment
limitation, not a code defect._

## What is done and verified working

| Area | Status | Evidence |
|---|---|---|
| Schema (22 tables, CHECK/unique/FK, indexes) | ✅ | `22` `pgTable` defs; migration `drizzle/0000_brief_vulcan.sql` (283 lines) |
| `db:reset` / `db:migrate` | ✅ | applies migrations cleanly to a fresh dir |
| `db:seed` (prototype) | ✅ | 5 periods / 18 entities / 5 YoL compositions |
| `db:seed:synthetic` | ✅ | exactly 5000 entities / 10000 periods / 20000 relationships / 2000 claims / 1000 sources / 100 YoL + 25 injected cycles |
| `db:validate` | ✅ | 17/17 checks pass |
| `db:audit` | ✅ | 0 errors (1 expected "unreachable" warning on the minimal prototype) |
| `db:export` + `db:import --dry-run` | ✅ | round-trips; transactional; versioned JSON |
| `db:benchmark` | ✅ | regenerated `docs/generated/database-benchmark.md` |
| Graph traversal (cycle-safe, bounded, filtered) | ✅ | traversal tests 8/8 |
| Zod validation layer | ✅ | validation tests 23/23 |
| `typecheck` | ✅ | `tsc --noEmit` exit 0 |
| Full db-layer test suite | ✅ (after fix) | all 15 test files pass in batches |
| `docs/database/*` (4 files, Mermaid ER diagram) | ✅ | present; `schema-overview.md` has the diagram |
| Unwired anchor adapter | ✅ | `src/db/adapters/anchor-adapter.ts` exists, not wired to UI |
| 3D experience untouched | ✅ | builds & type-checks; only the one adapter added |

## What was actually wrong

**1. The test suite was red — now fixed.**
`src/db/seed/prototype.test.ts` asserted the 1969 thesis matched
`/leaves its own planet/`, but the collage (UI) sub-cycle legitimately rewrote
that thesis in `src/data/yol.ts` to _"A world in motion …"_. The seed was
correct; the **test assertion was stale**, so `npm run test` / `db:test` did
not actually pass — contradicting the "all done" line in `GOAL.md`. Fixed by
asserting against `YOL_CONTENT['1969'].thesis` (the single source of truth) so
it can't go stale again. Now 2/2. This is the one thing the previous session
demonstrably claimed but did not deliver.

**2. `next build` cannot run in place on this sandbox — environment, not code.**
`npm run build` crashes with `Bus error (core dumped)` against the mounted
volume (the SWC native step faults on `mmap`, the same FUSE-mount class as the
already-documented PGlite `nodefs` failure). Proven to be the mount: copying
the source to `/tmp` and building off-mount **compiles, lints, type-checks, and
generates all 4 static pages successfully**. So the app builds fine on a normal
filesystem / CI runner. The previous notes did not mention this; they should
have.

## Documentation status

- `GOAL.md`, `README.md`, `docs/implementation-notes.md`, `docs/database/*`,
  and the generated benchmark report **all exist and are broadly accurate** —
  the notes are genuinely detailed (they correctly document the PGlite mount
  workaround, the `vite@7` pin, the Edit-tool NUL-byte issue, and the 45s
  command cap).
- The one inaccuracy — the "test passes" claim — is now true because the stale
  test is fixed.
- I appended a dated **"post-cycle verification audit"** section to
  `docs/implementation-notes.md` recording the fix, the `next build` mount
  limitation, and the housekeeping items below.

## Housekeeping still pending (low priority, safe)

- **Debug debris at repo root**, not gitignored, wired into nothing — safe to
  delete: `pgtest.mjs`, `pgtest2.mjs`, `pgtest3.mjs`, `pgfork.mjs`,
  `pgpersist.mjs`, `pgpersist2.mjs`, `pgpersist3.mjs`, `dbgimport.mjs`,
  `dbgimport2.mjs`, `ztest.ts`.
- **Not a git repository.** "Migrations committed under `drizzle/`" means the
  files exist on disk, not that anything is version-controlled. `git init` +
  an initial commit would make this cycle's work recoverable.

## Recommended next steps

1. Delete the 10 root debug scripts (or `.gitignore` them).
2. `git init` and commit, so the cycle is actually captured.
3. If in-sandbox builds are needed, add an off-mount build path
   (`next build` to a `/tmp` dist dir) — otherwise nothing to do; it builds on
   normal hardware.
4. The genuinely-useful _next database task_ (per the notes): revisit
   `shortestConnection` on the synthetic dataset (~830ms, over the informal
   500ms threshold) before wiring anything real to it.
