# Implementation Notes

(Only meaningful decisions, findings, defects, deferrals. Not a commit log.)

## Cycle 1 — desktop physics prototype (complete)

### Architecture decisions
- One persistent `<Canvas>`; Line and YoL worlds are sibling groups whose
  `visible` flags flip at `descentState.blend >= 0.5`, inside full cloud cover.
- Continuous scroll position lives in a module singleton (`runtime.ts`), not
  React state; Zustand holds only discrete state (mode, active anchor, lock).
- Descent/return are each a single GSAP timeline owned by `DescentController`;
  the store's `locked` flag guards ALL input, which is what makes double-click
  and wheel-spam safe (covered by e2e tests).
- Non-1969 Earth clicks show a notice instead of a generic YoL scene — kept
  the swap logic single-purpose for cycle 1.
- Debug panel is hand-rolled (plain sliders over the tuning store) instead of
  leva: zero dependency risk with React 19, and it reads/writes the same
  central `useTuning` store the scenes consume.

### Critical finding — R3F v9 clones the `uniforms` prop
`<shaderMaterial uniforms={obj}/>` deep-clones `obj` on construction:
`material.uniforms !== obj`. Mutating the original object in `useFrame` does
NOTHING (initial values still render, which hides the bug in stills). Every
animated shader uniform must be mutated through a ref to the material
(`matRef.current.uniforms.x.value = …`). This silently killed the descent
cloud layer, era tinting, and all shader time animation until fixed. Follow
this pattern for every future shader.

### Visual findings (software-rendered screenshots; recheck on real GPU)
- Cloud cover at the swap point is fully opaque — no visible scene pop.
  DOM overlays cross-fade above the clouds during the same window; reads fine.
- Earth scale 1.45 / orbit radius 1.55 sits closer to the reference image;
  the fbm continents are serviceable but flat — needs lighting/normal work in
  an art pass.
- Era mood tinting (particle tint/density/order interpolation) reads clearly
  between 2026 (cool network) and 10,000 BCE (warm ember), subtler in between.
- Draw calls ~19, triangles ~17k at `high` — plenty of headroom.

### Known defects / limitations
- FPS in the sandbox is software-rendered (~11fps); real-GPU performance and
  motion feel are UNVERIFIED. Tune `descentDuration`, `snapStrength`,
  `scrollSensitivity` on real hardware via `?debug=1`.
- Orb DOM labels can drift through the Earth silhouette at some orbit phases
  (labels render above the canvas). Acceptable for prototype.
- `anchorSpacing` slider only moves the world live; the built label/tick
  positions use the spacing captured at scene build (component re-render
  required to fully apply — change quality or navigate to refresh).
- Upper field is particles + accent glows only; "networks / print patterns /
  sparks" motifs are represented abstractly via drift order + tint, not as
  distinct geometries yet.
- YoL wheel input is ignored (intentional); YoL has no internal navigation.

### Environment notes (sandbox-specific, not user-facing)
- e2e needs `libXdamage.so.1` on PATH for chromium-headless-shell in the dev
  sandbox; on normal machines `npx playwright install chromium` suffices.
- `PW_SERVER_CMD="npx next start -p 3011"` speeds up e2e versus the dev server.

### Deferred ideas
- Auto quality drop after sustained low FPS.
- Crossfade (not pop-in) between outgoing/incoming theme orb sets.
- Distinct upper-field geometry per era (print grids, spark streaks, orbital
  arcs) once the art direction pass happens.
- Generic YoL scene for non-1969 anchors.

## Cycle 2 — descent, arrival & the 1969 tableau (complete)

### What changed
- Descent staged: orb flyby (`descentState.orbFly`, orbs sweep outward/past the
  camera), Earth overfill, cloud passage, then `DestinationSignals` — a
  camera-locked additive quad ABOVE the clouds (renderOrder 101: scanlines,
  radio wavefronts, horizon light, launch glow) so the destination emerges
  while clouds are still thinning. Signals timing via `signalsLead`.
- YoL rebuilt as a three-plane tableau (`YolScene`): background world shader
  (gradient, cloud bands, horizon light, city dots, launch trail, latent map
  geometry), dominant middle subject (procedural Moon centre-right, Earth→Moon
  trajectory with abstract craft silhouette, broadcast wavefronts, circuit
  plane, divided-world Cold War layer), DOM foreground recomposed with a local
  vignette tied to the text reveal.
- Theme lenses: the four labels are focusable buttons writing
  `themeFocus.target`; `YolScene` lerps `current` and every layer shader reads
  it. Hover and keyboard focus are identical. Cold War is the most dramatic
  (seam, divided masses, radar sweep, map lines).
- Staged arrival via `arrivalSchedule()` (pure, unit-tested): env → subject →
  text → themes → line; GSAP timeline started at the swap; DOM reveals applied
  per-frame from `yolReveal` in the Overlay rAF loop.
- Reduced motion (`motionPref` + matchMedia): short crossfade descent/return,
  two-stage reveal, static wave/craft/sweep positions, no camera drift.

### What was retained
Input locking, double-click guard, swap-at-cloud-peak, return-to-1969, debug
panel (+4 new sliders: signals lead, arrival stagger/stage, subject scale),
uniform-via-material-ref pattern, all cycle-1 tests.

### Visual findings
- Signals must render ABOVE the cloud quad or they are invisible (initially
  drawn beneath — worthless). Emergence-through-clouds now reads correctly.
- Transparent-sorting is fragile with many stacked planes: background plane
  got explicit renderOrder −10 (Cold War layer −5) to guarantee stacking.
- The DOM vignette must follow the text reveal, or it floats as a dark blob
  over the full-screen clouds during the passage.
- GSAP lagSmoothing makes arrival timing look wrong in software-rendered
  screenshot bursts (frame stalls are compressed to 33ms) — not a real-GPU
  issue; e2e asserts the reveal completes.

### Remaining weaknesses
- Cold War red frontier seam is strong/literal at full focus; may want a more
  abstract treatment after real-GPU review.
- Craft silhouette is minimal (stacked primitives); fine at distance, crude if
  subjectScale is pushed high.
- Circuit plane competes slightly with the warm horizon at lower right.
- Real-GPU motion feel still unverified (sandbox is software-rendered).

### Tuning that most affects the result
`descentDuration`, `signalsLead`, `arrivalStagger`, `arrivalStageDur`,
`subjectScale`, `cloudDensity`, `fogDensity`.

## Cycle 3 — database foundation (complete, with sandbox caveats)

### Architecture decisions
- Layered `src/db/` per the spec: `schema/` (Drizzle table defs, one file
  per concern), `client/` (`dev.ts` persistent, `test.ts` in-memory),
  `repositories/` (typed CRUD, no raw SQL elsewhere), `queries/` (traversal,
  audit, YoL composition — build on repositories), `validation/` (Zod),
  `seed/` (prototype + synthetic, both idempotent), `import-export/`,
  `adapters/` (the one documented, unwired future boundary).
- IDs are app-generated `text` UUIDs (`newId()`, not a Postgres extension) —
  keeps export/import stable without depending on `pgcrypto` in PGlite.
- Confidence/strength: 0..100 integers, one convention everywhere (CHECK
  constraints), documented in `schema/shared.ts` and
  `docs/database/data-integrity-rules.md`.
- Self-relationships forbidden (CHECK); duplicate `(source, target, type)`
  edges forbidden (unique constraint + `addRelationship()` checks first).
  `part_of`/`replaced` are the only relationship types the audit expects to
  be acyclic; everything else (notably `influenced`) may legitimately
  cycle — `influenced` is explicitly not `caused`.
- Migrations committed under `drizzle/` (Drizzle Kit's own default layout,
  chosen over `src/db/migrations` to minimize config surface).
- Graph traversal (`src/db/queries/traversal.ts`) queries per hop via
  indexed `source_entity_id`/`target_entity_id` lookups with a visited-set,
  not a full-table scan into JS — cycle-safe, not cycle-free, with
  configurable max depth and path info on every result.
- Synthetic seed uses a hand-rolled mulberry32 PRNG (no external RNG dep),
  fixed seed 1337 by default, `slug`-prefixed (`synth-`) and
  `isSynthetic: true` on every row; sources additionally get a
  `SYNTHETIC:` title prefix. Determinism is verified by test (same seed →
  identical sampled entity/period field sets), not by a full-DB hash.
- Import/export inserts in chunks of 500 rows per statement
  (`INSERT_CHUNK_SIZE`) — needed once the synthetic dataset (10k+ periods,
  20k+ relationships) is involved; still one transaction end to end.

### Package choices / deviations
- `drizzle-orm@0.44.7`, `drizzle-kit@0.31.6`, `@electric-sql/pglite@0.3.16`,
  `zod@4.4.3`, `tsx@4.23.0` — versions the package registry resolved at
  install time (originally requested slightly older pins; kept whatever
  actually landed rather than fighting the resolver further given how
  unreliable `npm install` was in this sandbox, see below).
- **`vite@8.1.4` (vitest's transitive dependency) is downgraded and pinned
  to `vite@7.3.6`** as an explicit devDependency. `vite@8.1.4` + PGlite +
  vitest's default `threads` pool crashed with `Bus error (core dumped)` on
  every single test, including a bare `new PGlite(); await pg.query(...)`
  with zero Drizzle involvement — reproduced with a minimal repro script
  outside vitest too (plain `node` was fine; the crash only happened when
  the WASM module loaded through vitest/vite@8's transform pipeline).
  Downgrading to `vite@7.3.6` fixed it immediately, no other changes
  needed. `vitest.config.ts` also sets `pool: 'forks'` (worker_threads +
  WASM is a known fragile combination; forks run each test file in a real
  child process). This is the actual root-cause fix; do not remove the
  `vite` devDependency pin without re-testing `db:test` first.

### Known sandbox-specific environment limitations (not code bugs)

- **`npm install` in this dev sandbox is unreliable.** Nearly every
  install left orphaned `.pkgname-<hash>` temp-rename directories in
  `node_modules` (npm's atomic-rename-based install strategy failing
  against this mounted filesystem), which then blocked subsequent installs
  of *unrelated* packages with `ENOTEMPTY`. Worked around by renaming (not
  deleting — `rm -rf` on this mount frequently throws `EPERM` mid-walk)
  stray temp dirs aside before each install attempt. Several optional
  platform binaries (`@esbuild/linux-x64`, `@rollup/rollup-linux-x64-gnu`,
  `picomatch` inside `vite`'s nested `node_modules`) ended up only
  partially installed (`package.json` present, binary missing, or vice
  versa) and had to be manually completed from `npm pack` tarballs. If a
  future agent hits `ENOTEMPTY` or `Cannot find module '@esbuild/...'` /
  `Host version ... does not match binary version ...` errors, this is
  the same class of issue — clear the specific stale `.name-hash`
  directory (via `mv`, not `rm`) and retry, or fetch the missing
  platform package directly via `npm pack <pkg>@<version>` + manual
  extract into the right nested `node_modules`.
- **The Edit tool silently appended trailing NUL bytes** to several files
  in this session (confirmed via `od -c`; visible to `tsc` as
  `TS1127: Invalid character` at the very end of the file). Root cause
  looks like a filesystem write-sync issue on this mounted volume, not the
  tool itself misbehaving logically — `cat > file <<EOF` heredocs via bash
  never showed the issue. Every file touched by Edit was re-verified
  byte-for-byte (`grep -c $'\\x00'` sweep of `src/**/*.ts`) and cleaned. If
  editing files in this repo on this sandbox again, prefer rewriting whole
  files via bash heredoc over the Edit tool, and NUL-sweep after any Edit
  call before trusting `tsc`'s output.
- **PGlite's persistent (disk-backed, `nodefs`) mode does not work when its
  data directory lives on this project's mounted volume** (`.../mnt/The
  Line`). Minimal repro: `new PGlite('<fresh empty dir under the repo
  mount>')` then a single `CREATE TABLE` throws `RuntimeError: unreachable`
  from inside the WASM Postgres engine — confirmed with zero Drizzle
  involvement, and confirmed the exact same code works instantly against a
  directory under `/tmp` (native filesystem) instead. `df -i` on the repo
  mount reports a nonsensical negative inode count, consistent with a
  FUSE-style passthrough mount (this sandbox mounts a Windows host
  directory into Linux) that doesn't fully support whatever mix of
  mmap/fsync/file-locking PGlite's nodefs backend needs — the same
  underlying class of issue as the `npm install` and Edit-tool problems
  above, all traceable to this one mount. **Workaround (already built
  in):** `src/db/client/dev.ts` reads `PGLITE_DATA_DIR` from the
  environment; every `db:*` script that touches the persistent client was
  verified end-to-end in this sandbox with `PGLITE_DATA_DIR=/tmp/...`. The
  default (`.pglite-data/dev` under the repo root) is correct and expected
  to work fine on a normal machine/CI runner with a real filesystem — only
  this specific sandboxed mount needs the override. `.gitignore` excludes
  `/.pglite-data/`. `db:reset` additionally falls back to renaming the old
  data dir aside (instead of failing) if a real recursive delete throws
  `EPERM`, which also happens on this mount.
- Full-repo `npm run lint` and an unscoped `npm run test` (or
  `npm run db:test`) reliably exceed the 45-second per-command cap of the
  harness used to build this cycle (2 vCPUs in this sandbox; PGlite/WASM
  startup cost per test file times ~15 db test files, plus a cold
  type-aware ESLint pass over the whole TS program). Every subtree lints
  clean individually (`npx eslint src/db`, `src/scripts`, `src/domain`,
  `app`, `src/experience`, `src/data` — all exit 0) and every test file
  passes when run in batches (69/69 db-layer tests + 22/22 pre-existing
  experience tests, see the verification log for exact batch timings).
  This is a per-command time-budget artifact of the tool used to build
  this cycle, not a defect in the lint/test configuration.

### Deferred ideas
- Wiring `src/experience`/`app` to read anchors from the DB via the
  adapter (`src/db/adapters/anchor-adapter.ts`) — intentionally not done
  this cycle.
- `shortestConnection` on the synthetic dataset (20k relationships) took
  ~830ms in this sandbox — above the 500ms informal warning threshold
  noted in `docs/generated/database-benchmark.md`. Works correctly; a
  future cycle should look at whether a smarter frontier-size cutoff or an
  additional index would help before this matters for anything real.
- No auth/admin UI/CMS/vector search/AI ingestion/real citations — all
  explicitly out of scope per the mission brief, see `GOAL.md`.

## Cycle 3 (UI) — 1969 collage page (complete)

### What changed
- The 1969 YoL destination is now a scrollable DOM collage page
  (`overlay/YolPage.tsx`) styled after the period reference
  (`vizref_yol_1969.png`): cream theme, left title column, colored theme
  chips, hero collage art, scroll-revealed event sections (IntersectionObserver
  + CSS reveals), MLK quote, sticky 1967–1973 mini-timeline with a live pulse
  on 1969. Assets are neat crops of the reference collage in
  `public/yol1969/` (hero + 6 event tiles), produced by PIL.
- The cycle-2 3D tableau (`scenes/YolScene.tsx`) is detached from
  `Experience.tsx` but kept in the tree in case the dark tableau returns.
  Descent/clouds/signals/arrival choreography unchanged; hero elements still
  reveal via `yolReveal`, so all arrival tuning sliders still apply.
- Theme lenses became chips that dim non-matching event sections
  (CSS `[data-lens]` + `data-themes`); keyboard focus ≡ hover, tested.
- Event copy lives in `src/data/yol.ts` (`YOL_EVENTS_1969`,
  `YOL_NEIGHBOURS_1969`, quote). Dates are well-established history but all
  entries stay `placeholder: true` pending editorial verification; the page
  footer states the collage is an illustrative reconstruction, not archival.

### What was retained
Persistent canvas, Line View, descent staging + cloud-hidden swap +
destination signals, input locking, return-to-1969, reduced motion (short
crossfade, no parallax/pulse animation), debug mode, all prior tests.

### Verification
tsc, eslint (app/src/e2e), 22 unit tests, production build, 9/9 Playwright
tests incl. two new ones (scroll reveals; lens dimming). Screenshots:
`c3-1-hero`, `c3-2-events`, `c3-3-lens` (sandbox outputs).

### Weaknesses / notes
- Wheel input in YoL scrolls the page natively; the Line-View wheel handler
  ignores non-'line' modes — do not add preventDefault there.
- `.pglite-data/` (from the parallel DB cycle) must stay excluded from any
  file sync/lint sweeps; full-repo `eslint .` is slow — lint `app src e2e`.
- Chip focus() auto-scrolls the page to the hero (browser behaviour);
  acceptable, but a future in-page lens bar could sit in the sticky footer.
- The hero art crop is fixed; on ultra-wide screens the bottom-left radius
  may need tuning (`.yp-hero-art`).

## Cycle 3 — post-cycle verification audit (2026-07-10)

Independent re-run of the whole verification list on the same sandbox mount.
Result: the cycle is functionally complete and all `db:*` tooling works; two
gaps between the "all done" claim and reality were found and one was fixed.

### Verified green
- `typecheck` (whole program) — clean.
- `db:reset`, `db:seed` (5 periods / 18 entities / 5 YoL), `db:seed:synthetic`
  (exactly 5000 / 10000 / 20000 / 2000 / 1000 / 100 + 25 injected cycles),
  `db:validate` (17/17), `db:audit` (0 errors), `db:export` + `db:import
  --dry-run`, `db:benchmark` (regenerated the report) — all exit 0 with
  `PGLITE_DATA_DIR` pointed at `/tmp` per the documented mount workaround.
- All 15 db-layer + experience test files pass when run in cap-sized batches
  (validation 23, traversal 8, synthetic 4, migrations 2, repos, audit,
  import-export, yol, pgbare, prototype 2).

### Defect found and FIXED
- `src/db/seed/prototype.test.ts` asserted the 1969 YoL thesis matched
  `/leaves its own planet/`, but the collage (Cycle 3 UI) legitimately changed
  that thesis in `src/data/yol.ts` to "A world in motion …". The seed was
  correct; the test assertion was stale, so the full suite was actually RED.
  Fixed by asserting against `YOL_CONTENT['1969'].thesis` (single source of
  truth) instead of a hard-coded phrase, so editorial copy changes can't make
  it stale again. Now 2/2.
- NOTE: the Edit tool truncated this file mid-write on this mount (confirmed —
  same write-sync class as the NUL-byte issue already documented above). Had
  to rewrite the whole file via a bash heredoc. Reconfirmed: on this mount,
  edit whole files via heredoc, not the Edit tool.

### Environment limitation found (not a code defect)
- `npm run build` (`next build`) crashes with `Bus error (core dumped)` when
  run against the repo on the mounted volume — the SWC/native step faults on
  mmap, the same FUSE-mount class as the documented PGlite `nodefs` failure.
  Confirmed it is the mount, not the code: copying the source to `/tmp` (off
  the mount) and building there compiles, lints, type-checks, and generates
  all 4 static pages successfully. So the app builds fine on a normal FS/CI;
  only this sandbox mount can't run `next build` in place. Consider documenting
  a `PROJECT_BUILD_DIR`/off-mount build path if in-sandbox builds are needed.

### Housekeeping left for a follow-up
- Root-level debug scripts from the build session are still present and are
  NOT gitignored: `pgtest.mjs`, `pgtest2.mjs`, `pgtest3.mjs`, `pgfork.mjs`,
  `pgpersist.mjs`, `pgpersist2.mjs`, `pgpersist3.mjs`, `dbgimport.mjs`,
  `dbgimport2.mjs`, `ztest.ts`. They are throwaway PGlite/validation probes,
  wired into nothing. Safe to delete.
- This project directory is not a git repository, so "migrations committed
  under drizzle/" means the files exist on disk, not that anything is under
  version control. `git init` + an initial commit would make the cycle's work
  actually recoverable.

## Cycle 4 (start) — Seed Inspector: first DB → UI read (2026-07-10)

First time the running app reads the data layer. Deliberately scoped as a
developer inspector, NOT the final historical-content UI, and does not wire the
DB into the 3D anchor rendering.

### What was added
- `app/api/line-data/route.ts` — Node route handler (`runtime='nodejs'`,
  `dynamic='force-dynamic'`). The ONLY place the app runs SQL; the overlay just
  fetches JSON, preserving "no DB calls in React components". Reads the SAME dir
  the db:* scripts write (`resolveDevDataDir()`), returned as `dbPath`.
  Auto-detects seed set (empty/prototype/synthetic), returns totals + a
  prototype-vs-synthetic split, and full per-curated-anchor detail: period,
  YoL, themes, featured entities, incoming/outgoing relationships, claims +
  sources — each tagged provenance prototype|synthetic|reviewed. Synthetic rows
  are summarised by count only; never enumerated, never sent to the canvas.
  Child lists capped (LIST_CAP=40) against dense synthetic nodes.
- `src/experience/overlay/DataLayer.tsx` — the Seed Inspector. HIDDEN by
  default; opens via a small toggle or the `i` key (Line View only). Right-side
  panel that follows the active anchor (tabs can pin another). Explicit
  loading / empty / db-error states. Lazy-fetches on first open.
- `Overlay.tsx` renders `<DataLayer active={inLineWorld} />`; `next.config.ts`
  adds `serverExternalPackages: ['@electric-sql/pglite']`; `globals.css` gains
  `.si-*` styles (restrained, gold-on-dark; hidden outside Line View).

### Verified (route executed directly against real PGlite dirs, all 4 states)
- prototype  → seeded, seedSet=prototype, counts 18 ent / 5 per / 5 yol, path echoed.
- synthetic  → seedSet=synthetic; totals 5018 ent / 10005 per / 20000 rel /
  2000 claims / 1000 sources; split prototype{18/5/0} vs synthetic{5000/10000/20000/2000/1000}.
- empty (migrated, 0 rows) → seeded=false, seedSet=empty, guidance message.
- unavailable (unmigrated dir) → dbError=true, path + failing query reported.
- On-mount `tsc --noEmit` clean after all changes.

### Known limitations / honest notes
- Curated anchors have NO relationships or claims in either seed (the synthetic
  stress graph is not attached to the 5 anchors), so those inspector sections
  render "none recorded" for real anchors. The queries + rendering are correct;
  they simply have nothing to show until a future seed links marked records to
  a curated anchor (do NOT fabricate such links).
- Could not capture a live screenshot or a full production build IN THIS
  sandbox: `next build` Bus-errors on the mounted volume and, off-mount, the
  2-vCPU type-check/lint phase and non-persistent background processes exceeded
  the harness. Compile correctness is covered by the clean on-mount typecheck +
  direct route execution; the app builds on normal hardware (verified off-mount
  pre-change). Verify visually with `npm run dev` on a real machine.
- `db.$count` used for totals (drizzle 0.44). PGlite dev dir must be off the
  Windows mount only in THIS sandbox (PGLITE_DATA_DIR); default is correct on a
  normal machine.

### Inline on-Line readout (follow-up)
- Added an always-on, subtle DB readout under the year label
  (`overlay/LineAnchorData.tsx`): the active anchor's provenance badge, YoL
  thesis, theme chips, and entity/relationship/claim counts, updating as the
  active anchor changes. Renders nothing when the DB is empty/unreachable, so
  the Line never shows an error — the Seed Inspector owns those states.
- Both the inline readout and the inspector now share ONE cached fetch via
  `overlay/useLineData.ts` (module-scoped state + subscription + reload), so
  there's a single /api/line-data round trip and a retry refreshes both. Shared
  types (LineData/Anchor/…) moved there; `DataLayer.tsx` imports them.
- Verified: all 5 curated anchors carry a thesis + themes (3–5) + entities in
  the prototype seed, so the readout has content along the whole Line. tsc clean.

### Inline readout overflow fix
- The inline readout stacked below the year block (which sits at ~75vh, just
  under the Line), so at 100% zoom the thesis/chips/counts fell below the fold.
  Fixed CSS-only: hero year uses `clamp(2.2rem,5.6vh,3.4rem)`, year block pulled
  1rem closer to the Line, sub/readout spacing tightened, and `.line-db` made
  compact with a 2-line thesis clamp so the block can't run off-screen. No 3D
  tuning (`lineVh` etc.) changed. Verify visually on a real viewport.

## Cycle 5 — Year Visual Identity: 1969 (2026-07-10)

Started as "visual unification of Line View + YoL"; re-scoped mid-cycle by
product direction: years should NOT share Line View's surface — each year
gets a period identity; product identity is structural. Earlier passes were
kept where they matched the new brief.

### Architecture decisions
- `YearVisualIdentity` (src/data/identity/) is DATA, consumed by the
  renderer via `identityCssVars()` → `--yr-*` variables on `.yol-page`.
  All period CSS reads those vars; adding a year = adding a config file +
  registry entry. `DEFAULT_IDENTITY` is the fallback for un-designed years.
- Asset manifest per year (role/section/focal/crop/treatment/alt/caption/
  sourceType/rights/attribution). Vitest guards: no rights claims on
  non-archival media; every asset has alt text; every lens has a substyle.
- MediaFrame renders all imagery; captions are typewriter DOM text with a
  mandatory provenance label. Placeholder slots are visible dev surfaces
  (dashed outline + slot id) so generated images have named landing spots.
- Structural tokens (space/atmosphere depths, gold, cool line, focus ring,
  type scale) live in src/experience/tokens.ts and are applied as CSS vars
  on `.experience` (single source; globals.css :root is fallback only).
- Theme continuity: chips/tags reuse ANCHOR theme colours + orb dot; orb
  DOM labels in Line View switched to the same uppercase-sans voice.
- The Line inside YoL: sticky bottom strip rebuilt as the Line itself
  (cool gradient band, gold segment + tick + 1.82s pulse ring at 1969,
  serif years) — same object at both depths; it resolves last on arrival
  and stays lit above the transition dimmer during return.
- Descent continuity: CloudLayer gained `uWarm` (eased toward
  descentState.blend) — clouds warm toward archival light approaching the
  year, cool again on return. DOM `yol-dimmer` (driven by descentState.cloud
  in the Overlay rAF) keeps the paper world from popping at full brightness
  beneath the clouds.
- Seed Inspector on-screen toggle now renders only in `?debug=1` (the `i`
  key still works); public Line View shows no dev chrome.

### Pass log
- Pass A/1 (structure): shared tokens, typography roles, Line strip, theme
  orb continuity, control/focus language, inspector gating.
- Pass B/2 (application): 1969 identity applied end-to-end — grotesque
  display year + crop/registration marks, diagram-plate Apollo, dark
  broadcast/computing plates (scanlines, punch-card, oscilloscope green),
  documentary halftone (grayscale multiplied onto paper + dot overlay),
  counterculture cutout (blob clip + screen-print offset) ONLY for
  Woodstock, contact-sheet (sprocket holes) for ordinary life, newspaper
  pull-quote, closing panorama slot, interlude of placeholder slots.
- Pass C/3 (refinement): media max-height 60vh so crops never dominate,
  adjacent dark plates merge into one broadcast block (negative margin +
  hairline divider), interlude media capped at 34vh.

### Verification (all off-mount in /tmp copy; mount can't run next build)
- eslint (app/src/e2e) clean; tsc clean; vitest 29+7 passing (experience,
  data, identity).
- `next build` exit 0 (needed 3 attempts under the 45s per-command harness
  cap — compile ✓ 33.8s, then cache-warm runs finished lint/types, static
  4/4, traces).
- Playwright (against `next start`, headless shell + libXdamage workaround):
  all 9 tests passed when run in cap-sized batches. One REAL defect found:
  arrival.spec.ts referenced the removed `.yol-themes` class (renamed
  `.yp-chips`) — spec updated. `reduced motion` flaked once (software
  rendering), passed clean on rerun.
- Screenshots (sandbox software-rendered) of hero, all six event sections,
  interlude, quote, closing, Line View before/after, descent, return.

### Known defects / honest notes
- Sandbox screenshots are software-rendered (~5–11fps): GSAP timeline
  compression makes mid-descent frames land post-arrival; motion feel and
  the warm-cloud tint remain UNVERIFIED on a real GPU (`?debug=1` sliders
  unchanged for tuning).
- The interlude of placeholder slots is intentionally visible; if it reads
  as clutter before imagery arrives, hide it behind debug or collapse to a
  single strip.
- `.yol-block`/tableau styles for the detached cycle-2 YolScene remain in
  globals.css (the scene is still in the tree, unused by the collage page).
- Hero art bottom-left 260px arc against the dark Line strip is acceptable
  but worth a look on real hardware/ultra-wide.
- color-mix() is used widely (Chrome 111+/FF 113+); acceptable for the
  prototype's desktop-first target, fallbacks default to reasonable static
  colours where provided.

### Deferred
- Generated imagery for the named slots; identity configs for other years;
  richer licensed display fonts (document in year-visual-identity.md
  first); real-GPU pass on descent warmth + plate contrast.

## Cycle 5b — Proof of reuse: 1769 YoL (issue #2, 2026-07-10)

### What this cycle proved
The Year Visual Identity system now renders two historically distinct years
(1969 space-age editorial vs 1769 engraved broadsheet) through ONE structure:
same YolPage component, same MediaFrame, same descent/return choreography,
same Line strip/lens/caption conventions. No year is special-cased in any
shared component.

### 1969-specific assumptions removed
- `store.requestDescent` 1969-only gate → any year in the YoL content
  registry (`src/data/yol/`); notice text derives from the registry.
- `commitLine`/`DescentController` returned to `INDEX_1969` → the store now
  records `originIndex` at descent and the return restores it (descend from
  1769, return to 1769 — covered by unit + e2e tests).
- `YolPage` hard-coded 1969 content/identity/lenses/asset ids → fully
  year-driven from the active anchor; section imagery resolves from the
  manifest by section+role (`getSectionAsset`), hero/atmosphere/texture by
  role (`getRoleAsset`).
- `runtime.themeFocus` frozen 4-key set → dynamic keys installed per year via
  `setThemeLenses` (defaults to the 1969 set for legacy code/tests).
- `globals.css` lens dimming enumerated 1969 keys → the page computes a
  generic `.dim` class from the active year's lens keys.
- Hard-coded hero arc (260px) + crop-marks class + 1969 grain texture URL in
  CSS → `--yr-hero-art-radius`, `layout.heroMotif`, `--yr-texture` (from the
  manifest's `texture` role asset).
- Event alternation now respects `identity.layout.alternate`
  (1769 keeps one measured broadsheet side).
- Descent atmosphere: cloud warm tones + YoL sky were fixed 1969-ish colours
  → `destinationStyle` runtime set from the destination identity's palette
  (paper/plate/sky) when a descent starts.

### Intentionally retained (documented, not defects)
- `scenes/YolScene.tsx` legacy 3D tableau (unmounted) still carries 1969
  uniform names; untouched because it is not rendered.
- Five-anchor scroll model and descent camera path are structural.
- `YOL_CONTENT` kept as a derived view for the DB seed layer.

### Model changes
- `AssetRecord`: + required `assetState: 'placeholder' | 'final'`,
  + optional `aspectRatio`; roles + `map`; treatments + `engraved-plate`,
  `map-sheet`; motifs + `engraved-rules`, `plate-mark`, `graticule`,
  `gear-section`, `hatching`, `folio-marks`.
- `IdentityLayout`: + `heroArtRadius`, `heroMotif`.
- New content registry `src/data/yol/{index,year-1969,year-1769}.ts`
  (events/neighbours/optional quote/interlude slots per year). 1769 has no
  quote — none verified, none fabricated.
- MediaFrame: missing files degrade to a labelled `.mf-missing-plate`;
  `data-state` exposes placeholder/final for styling and tests.

### 1769 direction (see identity notes field)
Rag paper #d8c7a3 / ink / oxide / brass / soot / faded blue; Baskerville
display + Palatino body + Copperplate annotation stacks; plate marks,
hatching, graticule, gear-section, folio marks; alternate=false; mechanical
easing (0.65,0,0.25,1), 14px/0.65s reveals. inkBody lightened one step from
raw ink for long-form legibility (documented palette adjustment).

### Verification (sandbox, software-rendered)
- eslint clean; tsc clean; vitest 49 passing incl. new identity/yol/store/
  runtime suites; db seed tests pass (YOL_CONTENT compatibility).
- `next build` exit 0 (same 45s-cap retry pattern as cycle 5).
- Playwright: all 11 e2e tests pass (4 core-loop + 3 arrival + 2 yol-page
  regression, 2 new 1769 specs) against `next start`, headless shell +
  libXdamage workaround as before.
- Screenshots: 1769 desktop (hero/4 events/closing), narrow 480px, reduced
  motion, 1969 regression set, side-by-side sheet + journey recording —
  attached to PR #10, not committed (see docs/evidence/README.md).

### Known limitations / next
- All 1769 imagery is placeholder slots awaiting externally generated
  artwork (hero, steam plate, knowledge plate, trade map, labour scene,
  closing panorama, transition plate). Swap by path + assetState flip.
- Real-GPU motion review still outstanding (also for 1769 cloud warmth —
  the 1769 descent warms toward rag-paper tones; verify feel on hardware).
- `transition-plate-1769` slot is registered but not yet composed into a
  bespoke 1769 descent moment (deferred; shared choreography carries the
  yearly cues via colour only).
- Copperplate stacks fall back to Baskerville/serif on systems without
  Copperplate; acceptable, documented in the identity comment.

### Cycle 5b addendum — final 1769 artwork integrated (2026-07-10)

- All seven 1769 slots now carry FINAL externally generated artwork
  (project-directed): hero workshop scene, sectioned steam plate,
  encyclopaedia specimen sheet, world chart, spinning-workshop scene,
  atmospheric closing sheet, and the transit-of-Venus measured diagram.
  Web-optimised WebP (q82, sharp-yuv, 126–580 KB each) under
  public/yol1769/; PNG masters stay OUTSIDE the repository.
- Hero: the landscape master is used intentionally via focal-aware cover
  crop (focal 74%/45%) — the hero art element and its parallax now honour
  the manifest focal point (data-fx/fy), so desktop shows the apparatus
  slice and narrow layouts show the full harbour scene. No layout rewrite.
- Technical plates: `crop: 'contain'` is now honoured
  (`.mf[data-crop='contain']`) so sectioned plates and annotations are
  never crop-sacrificed.
- Trade map: the map-sheet graticule overlay is PLACEHOLDER-ONLY now —
  the final chart carries its own engraved graticule and the CSS overlay
  competed with it.
- Transition plate resolved: `transition-plate-1769` is composed as a
  single-plate interlude between the labour plate and the closing
  panorama (`.yp-interlude.single`) — a quiet measured moment whose
  dotted transit line carries the Line motif inside the year. Dev slot
  labels now render only for placeholder-state assets.
- Placeholder slot SVGs are retained under public/yol1769/slots/ as
  graceful fallbacks and dev references.
- Verification: lint/tsc/49 unit tests clean; all 11 Playwright specs
  pass against `next start` (yol-1769 spec updated for final-state
  assets); build via the split compile/generate phases in-sandbox (the
  single-pass build exceeds the 45s cap — GitHub CI runs it whole).

### CI flake diagnosis (2026-07-10, PR #10 run 4 / main run 2)

GitHub's 2-core runners running TWO parallel Playwright workers starve the
rAF/GSAP loop: arrival-timing specs failed on plain main (run 2: reduced-
motion lens opacity 0/0.28 at a fixed-sleep assert) and the 1969 core-loop
return failed once the suite grew (run 4: the return click landed while
the transition lock was still engaged and was intentionally swallowed).
Not artwork-related. Fixes: `workers: 1` on CI (playwright.config.ts),
poll the reveal instead of fixed-sleep asserts, and retry the return
click like a real user (`expect(...).toPass`). The lock-swallowing
behaviour itself is by design and stays.

### Cycle 5b close-out — product vision clarification (2026-07-10)

Sahil completed the real-GPU visual review of PR #10 (all checklist items
confirmed; ChatGPT reviewed the diff and the green CI run) and approved
the PR for merge. Recorded product decision: the stacked editorial YoL
page is an ACCEPTED FUNCTIONAL PROTOTYPE of the Year Visual Identity
architecture — the intended interaction model is a nested, scroll-driven
local-timeline world, deliberately deferred to a separate tracked build.
The deferred-builds list (none started) lives in GOAL.md. README and
GOAL.md were corrected so neither implies 1969-only descent, a fully
disconnected database, or that the stacked layout is final.

## Cycle 6 — Database-backed YoL local timeline world (issue #14, 2026-07-10, IN PROGRESS)

### Architecture decisions
- **Schema (migration `drizzle/0001_aspiring_darkhawk.sql`)**: local
  chronology is curation-only rows in `yol_timeline_points` (role enum
  `overview|development|context|closing`, FK to entity + period, unique
  `(yol_id, display_order)`, optional headline/summary overrides,
  `section_key` as the ONLY presentation bridge) + `yol_point_themes`
  referencing `yol_themes` rows. Within-year time = nullable integer
  `start_month/start_day/end_month/end_day` on `periods` (CHECKed 1–12 /
  1–31) — JS `Date` is never used; display strings are built by the pure
  BCE-safe formatter in `src/domain/yol-read-model.ts`. Stable renderer
  bridges: `entity_theme_details.lens_key`, `yol_themes.display_label`.
- **Read model**: `src/db/queries/yol-read-model.ts` →
  `GET /api/yol/[anchorSlug]` (`app/api/yol/[anchorSlug]/route.ts`,
  typed envelope `ok|not_found|empty|error`; no paths/SQL/stacks ever
  leave the route). `isSynthetic = false` is filtered on EVERY query in
  the path — the synthetic-exclusion boundary is this one file.
- **Client**: `overlay/useYolData.ts` module cache by slug, in-flight
  dedupe, one bounded retry, `prefetchYol()` fired from
  `DescentController.aimAtDestination` so content resolves inside the
  cloud passage. `overlay/yol-view-model.ts` maps BOTH sources
  (database primary, `src/data/yol` registry fallback) into one
  `YolViewModel`; `YolPage` cannot tell them apart (`data-source` attr
  is exposed for tests/debug only).
- **Interaction**: `localTimeState` in runtime.ts mirrors `timeState`
  (pos/target/lastInput/count); wheel + arrow handlers live in
  Experience.tsx beside the parent-Line handlers with the same grammar
  (down/left = earlier). Snapping reuses `approach()` + round-after-idle.
  Tunables (`localScrollSensitivity/localSnapStrength/localSnapDelayMs/
  localTickSpacingVw/localFieldTravelVw`) in config.ts + DebugPanel.
  Stations and ticks are absolutely positioned; the rAF writes
  transforms/opacity per frame (no React state per frame); only the
  discrete nearest-index crosses into state for aria/testids.
- Seed rewritten (`src/db/seed/prototype.ts` + `yol-chronology.ts`):
  contexts → overview (order 0) → developments (curated chronological
  order, 10/20/…) → contexts after (10000+distance) → closing (100000).
  Idempotent per point AND upgrade-safe: back-fills lens keys, display
  labels and missing chronology on databases seeded by older versions.
  No claims/sources are seeded — nothing is researched yet.

### Critical findings
- **Inline `pointer-events` re-enabled inside a `pointer-events: none`
  parent**: the station rAF set `pointerEvents='auto'` on the active
  station, which made the hidden YoL layer swallow Earth clicks in Line
  View (descent gate appeared broken; no notice, no raycast). Inline
  child styles OVERRIDE the parent's `.yol-ui.hidden` pointer-events
  none. Fixed by gating on `mode === 'yol'` inside the rAF.
- Orbiting theme-orb DOM labels can momentarily cover the Earth's click
  point; automation must retry the click (the existing core-loop spec's
  double-click already does — keep that pattern in new specs).
- The old capture trick of waiting for `yol-title` visibility is
  unreliable: `.yol-ui.hidden` hides via opacity, so Playwright still
  counts it visible. Wait on `.experience[data-mode="yol"]` instead.
- Plate-surface CSS: the `.yp-event.surface-plate` block uses full-bleed
  negative margins tied to the old scroll layout; stations needed their
  own `.yw-station.surface-plate` (plain dark plate card). The first
  `surface-plate` selector in globals.css is the ADJACENT-SIBLING merge
  rule — extending selectors by string match must target the base rule.

### Verified (sandbox, software rendering)
- lint (eslint app/src/db/src/experience/src/domain/src/data) clean;
  tsc clean; production build exit 0 (45s-cap retry pattern).
- Unit + db suites all green in cap-sized batches: 59 experience/data
  (incl. new view-model, accessor, runtime suites) + seed 6 + read-model
  8 + queries/validation/import-export + repositories 12 + schema 3.
- Real-browser (chrome-headless-shell + libXdamage workaround, `next
  start` + seeded `/tmp/pgdata`): 1969 AND 1769 enter their local
  timeline world with `data-source="database"`, wheel moves earlier,
  arrows move later, ticks/marker/pulse render, identities stay
  distinct. Screenshots in session outputs (not committed — evidence
  policy).

### Known defects / not yet done (hand-off to the next agent)
- e2e suite still asserts the STACKED page (scroll reveals, lens dimming
  by section, "wheel ignored in YoL") — must be rewritten for the local
  timeline + DB-backed path; CI needs the temporary migrated+seeded
  PGlite dir step. `yolLineVh` tuning no longer drives the DOM local
  Line (CSS hard-codes 91.7vh) — either wire it or note it.
- Dead CSS from the stacked layout (`.yp-hero*`, `.yp-events`,
  `.yp-timeline/.yp-tl-*`, `.yp-quote`, `.yp-interlude`, `.yp-slot`,
  `.yp-scrollhint`, `.reveal`) remains in globals.css — safe but noisy;
  remove once e2e is green.
- 1969 quote + interlude/transition-plate assets are not yet composed
  into the station world (quote could become a station treatment; the
  1769 transition plate is reachable via section assets only).
- Field/tick spacing, fades and travel need a real-GPU tuning pass
  (`?debug=1` sliders exist). Narrow layout + reduced motion implemented
  but only smoke-checked; e2e must cover them.
- `docs/database/schema-overview.md`, query cookbook, and stale Cycle 1
  statements in docs/02/03/04 not yet updated for the new tables.
