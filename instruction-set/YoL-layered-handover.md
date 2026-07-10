# YoL Layered Handover — Completing the Historical Field & Topic Worlds

**For: Opus. From: Fable. Issue: #16. Branch: `issue-16/historical-field-topic-worlds`.**

Fable built and PROVED the architectural kernel; your cycle is construction
on top of it. The full completion criteria live in issue #16 (they are the
final target); this document is the ordered, file-by-file path to them.
Read `docs/implementation-notes.md` → "Cycle 7" first, then this.

## What is already true (do not rebuild, do not weaken)

- **World stack** (`src/experience/worlds.ts`, `store.ts`): generic
  `pushWorld/popWorld/returnToDepth/updateTopRestore`, arbitrary depth,
  restoration data owned by frames, all transitions behind the ONE global
  `locked` flag (`data-locked` observable). 9 unit tests in
  `src/experience/world-stack.test.ts`.
- **Continuous field time** (`runtime.ts` `fieldTimeState`) + **topic
  chapter axis** (`topicScrollState`); wheel/arrow routing per world type
  in `Experience.tsx`; Escape pops one level. Grammar unchanged:
  down/left = earlier everywhere temporal.
- **Deterministic temporal collage** (`src/experience/field/layout.ts`):
  seeded, pure, lane-based collision handling, editorial overrides,
  visible-window + emphasis helpers. 7 unit tests incl. a 60-record proof.
- **Renderers**: `overlay/worlds/HistoricalFieldPage.tsx`,
  `TopicWorldPage.tsx`, `WorldTransition.tsx` (shared-element push/pop
  plate; waits for data readiness; reduced-motion path),
  `WorldChrome.tsx` (breadcrumb/back), `PlaceholderPlate.tsx`
  (deterministic CSS plates, no assets).
- **Data boundary**: `src/domain/worlds.ts` (view models +
  `HistoricalWorldDataSource`), `src/data/worlds/mock-adapter.ts`,
  `prototype-content.ts`, `destinations.ts` (1769 → field; 1969 → YoL,
  untouched). Client accessor `overlay/useWorldData.ts`.
- **Proof**: `e2e/historical-chain.spec.ts` — full Line → field → Steam
  Engine → Watt → Glasgow → Enlightenment chain with EXACT restoration at
  every depth + no-reload/no-remount guard. All 14 e2e specs pass locally.
- Debug-mode URL tuning: `?debug=1&tune.<key>=<n>` seeds `useTuning`
  (used by the chain spec to fit CI budgets; also a visual-iteration tool).

**Hard rules carried forward:** one Canvas, no route changes inside the
experience, per-frame values never in React state, tunables only in
`config.ts` + debug panel, all input behind the lock, no fabricated
history, placeholders never labelled reviewed/archival, never merge, never
move issues to Done.

## Ordered construction plan

### 1. Fill the Historical Field to target density
File: `src/data/worlds/prototype-content.ts` (only).
Grow `ITEMS` from 14 to 40–60 across 1760–1780: mixed kinds (person /
invention / discovery / event / organisation / place / idea), varied
`aspectRatio` (0.6–2.4), `prominence` spread 25–95, several `endYear`
ranges, a handful of `composition` overrides to prove editorial control.
Use safely-established subjects sparingly; otherwise "… (provisional
record)" naming. NO sources, NO precise claims invented, NO new media
files. Target 8–18 plates visible near most years — check with
`visiblePlacements` counts in a unit test extension of
`src/experience/field/layout.test.ts`, and visually at `?debug=1`
(fieldVisibleRadiusYears / falloff sliders). If lanes saturate, tune the
LANES table and SIZE_BASE_VW in `field/layout.ts` (tests protect the
invariants: determinism, front-layer no-overlap, temporal x).

### 2. Complete the Topic World chapters
Same file, `TOPIC_WORLDS`: grow each world to 4–7 chapters following the
chapter rhythms in issue #16 / the original brief. Keep every chapter body
short and visibly provisional. Keep exactly one doorway per world along
the demonstration chain (already present: steam→watt→glasgow→
enlightenment); add non-chain `relatedTopics` entries freely — the stack
handles any depth. If you add doorways to topics with no VM yet, add the
VM or leave the record without `topicWorldSlug` (worldless plates travel
to their year on click instead — already implemented).

### 3. Visual refinement (judge in the browser, not in prose)
Files: `app/globals.css` (`.hf-*`, `.tw-*`, `.wc-*`, `.php-*` blocks),
`config.ts` defaults after tuning via `?debug=1`.
- Field: plate framing/shadows, hover label typography, layer depth
  tinting, band/tick rhythm, five-year tick weight, sky gradient.
- PlaceholderPlate variations: extend `PlaceholderPlate.tsx` with 2–3
  seeded treatment variants per kind (hatching direction, vignette, plate
  border) — deterministic from seed ONLY.
- Topic identities: enrich the four `atmosphere-*` treatments (subtle
  texture, chapter-to-chapter background shifts keyed off
  `data-chapter`); respect `motionCharacter` by varying CSS transition
  curves. No expensive effects, no artwork generation.
- The world-transition plate: consider a soft scale/blur on the outgoing
  world (CSS var driven from `worldTransitionState.progress`) — optional,
  only if it reads well on a real GPU.
- Capture before/after screenshots for anything you change materially.

### 4. Narrow screens
Files: `HistoricalFieldPage.tsx`, `globals.css` @media (max-width: 900px).
- Reduce simultaneous plates: lower `fieldVisibleRadiusYears` and raise
  falloffs under a narrow-viewport check (add a `narrow` boolean derived
  once from matchMedia, NOT per frame), or filter mounted items to
  depth 0–1.
- Add explicit earlier/later controls to the field (mirror the YoL
  `local-prev/local-next` pattern incl. `disabled` while locked — reuse
  those testids' convention: `field-prev` / `field-next`).
- Field already has topic-style pointer drag? NO — the field currently
  has no touch drag: add the same pointerdown/move/up pattern
  TopicWorldPage uses (convert px → years via `fieldVwPerYear`).
- Verify chrome (Back/breadcrumb) never clips; Topic chapters single
  column (already sketched) — check text overflow on 480px.

### 5. Accessibility
- Field plates already expose title/kind/date/opens-world via aria-label;
  verify with a screen reader pass; ensure decorative `.php-plate` stays
  `aria-hidden` and PLATES not near the marker are excluded from tab
  order (`tabIndex={-1}` when `!interactive` — currently they only lose
  pointer events; ADD tabindex management in the emphasis loop).
- Enter/Space on a focused plate must work (native button ✓ — cover in a
  spec).
- Topic chapters: `aria-hidden` on non-active chapters ✓; make doorway
  buttons unreachable when their chapter is hidden (same tabindex rule).
- Logical tab order: Return → Back → breadcrumb → active-world controls.
- Escape behaviour is global ✓.

### 6. Reduced motion polish
`motionPref.reduced` already: skips easing (jump), disables parallax and
plate scale. Verify: transition plate path (short fades — implemented),
no pulse animation (CSS ✓), and that the chain spec passes under
`page.emulateMedia({ reducedMotion: 'reduce' })` — add that spec variant.

### 7. Comprehensive Playwright coverage
Extend, don't replace, `e2e/historical-chain.spec.ts` (it protects the
kernel — keep it green and fast). Add `e2e/historical-field.spec.ts` +
`e2e/topic-worlds.spec.ts`:
- field starts at 1769; collage count near most positions ≥ 8 (after
  step 1);
- move earlier AND later; contents/positions change; no flash on year
  crossings (assert an anchored plate's continuous presence);
- deterministic arrangement: leave + re-enter → same plate positions
  (compare boundingBox of 2–3 testids);
- hover/focus reveals title/kind/date without layout displacement;
- rapid double-click on a plate cannot double-push (lock guard);
- narrow field navigable via the new controls; reduced-motion journey;
- topic chapters: wheel progresses horizontally, ←/→ works, drag works,
  adjacent chapter peeks (boundingBox spot-check);
- 1969 regression suite stays green (already updated for the new
  destination map — see `local-timeline.spec.ts` / `helpers.enterField`).
Testing gotchas (hard-won, respect them): wait on
`.experience[data-mode]` + `data-locked="false"`, never on element
visibility through the opacity-hidden overlay; retry Earth clicks; plates
are ONLY clickable within `fieldActiveRadiusYears` of their year — stand
near a plate's moment before clicking it; use the FAST_TUNING URL pattern
for long journeys.

### 8. Evidence
Screenshots: field at 1769 / earlier / later; all four worlds; narrow
field + narrow world; reduced-motion journey; plus a recording of the
complete descent+return chain (Playwright `video: 'on'` in a one-off
project or the gif tooling). Evidence goes in PR attachments / CI
artifacts, NEVER into git (docs/evidence/README.md).

### 9. Documentation
- `GOAL.md`: currently describes cycle 7 as active — on completion,
  record the delivered outcome (follow the cycle-6 pattern).
- `docs/03-technical-architecture.md`: add the world-stack layer to the
  Layout/Rules sections (worlds.ts, field/, overlay/worlds/, the input
  routing note, the "one canvas, overlay worlds" invariant).
- `docs/04-acceptance-tests.md`: append the world-stack acceptance list
  (mirror issue #16's criteria).
- `docs/implementation-notes.md`: extend the Cycle 7 section with YOUR
  findings/defects — do not rewrite Fable's entries.
- README: one paragraph on the 1769 Historical Field + topic chain and
  the `tune.` URL parameters.
- `docs/backend-crm-handoff.md` exists — extend only if the VM contracts
  change (they shouldn't; if they must, update `src/domain/worlds.ts`
  FIRST and keep the doc in lockstep).

### 10. CI + PR completion
- CI needs no new services (mock adapter is in-process; the seeded PGlite
  path already exists for the YoL suites). Verify the whole suite under
  `workers: 1` CI budget; keep specs poll-based.
- Run: `npm run lint`, `typecheck`, `test`, `db:test`, `build`,
  `test:e2e` — all green locally, then in CI.
- Open the PR with the repository template, `Closes #16`, attach all
  evidence, post the completion-evidence comment on issue #16 following
  its checklist, move Stage → Review, Prompt Status → Complete/Needs
  follow-up honestly. Do NOT merge; do NOT touch issue #5 further (the
  contract comment is already posted).

## Known defects / deferred by Fable (fix or record honestly)

- Field visual density with 14 records is sparse at range edges
  (1760–63, 1777–80) — step 1 fixes it.
- Plate hover labels can overflow the viewport bottom for lane-3 plates.
- The transition plate is a solid seeded gradient; it covers the swap
  well but a subtle zoom of the outgoing world beneath would sell depth
  more (optional, step 3).
- `hf-item` tab order includes far (non-interactive) plates (step 5).
- The field has no touch drag yet (step 4).
- Browser Back/History integration deliberately NOT implemented (stack
  is internal); desirable-only per the brief — if attempted, use
  history.pushState with depth markers and NO reloads, and keep the
  internal stack authoritative.
- `returnToDepth(n>1 jumps)` animates as ONE pop transition using the
  first-above-target frame's entryRect — visually fine, but check it on
  a real GPU with the breadcrumb jumps.
