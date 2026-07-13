# 03 — Technical Architecture

## Stack

Next.js 15 App Router, React 19, strict TypeScript, React Three Fiber 9 + Three.js, drei (Html/shader helpers only), GSAP (descent timeline), Zustand (experience state), leva (debug tuning), Vitest, Playwright. Plain CSS in `app/globals.css`. No backend.

## Layout

```
app/                 shell only; page.tsx mounts <Experience/> client-side
src/
  experience/
    config.ts        ALL tuning defaults (camera, line, earth, descent, field…)
    store.ts         Zustand: mode, timePos, activeAnchor, lock, quality, tuning
    time.ts          pure math: timePos↔anchor, snapping, clamping, year interp
    Experience.tsx   persistent <Canvas> + DOM overlay composition
    scenes/
      LineScene.tsx  Line, Earth, theme orbs, upper field
      YolScene.tsx   YoL 3D backdrop (year-agnostic)
      Descent.tsx    GSAP camera/fog transition, scene swap
    three/           reusable meshes/shaders (Earth, CloudLayer, Field…)
    overlay/         DOM: lens, year label, anchor labels, YoL local-timeline
                     page (YolPage.tsx), data accessor (useYolData.ts), debug panel
src/data/            typed placeholder content; YoL registry is FALLBACK only
                     (DB is primary — see 02-data-model.md, database/*)
```

## Rules

- **One persistent `<Canvas>`.** Scenes are groups toggled/faded inside it; the descent hides the swap inside the cloud layer.
- **Camera fixed in Line View.** Scrolling translates the line group in X; the lens and Earth stay screen-centred. Descent is the only camera move, driven by one GSAP timeline.
- **Per-frame values live in refs / `useFrame`,** never React state. Zustand holds discrete state only (mode, timePos target, active anchor, lock flags).
- **All tunables come from `config.ts`** and can be overridden live via the leva panel (`?debug=1`). Do not scatter magic numbers in components.
- **Content data never imports rendering code** and vice versa (render reads data, not the other way).
- **Input locking:** `store.transitionLock` guards wheel/keys/clicks during descent/return. All input handlers must check it.

## State machine

`mode: 'line' | 'descending' | 'yol' | 'ascending'`. Transitions only via store actions `requestDescent(index)` / `requestReturn()`, which set the lock; GSAP `onComplete` commits `mode` and releases the lock. Interrupted transitions (rapid input) are ignored while locked.

> **Cycle 6:** `yol` mode is a NESTED LOCAL TIMELINE. Inside a year, wheel/←→ drive `localTimeState` (point-index units) with the same snap discipline as the parent Line — wheel down = earlier, → = later — while the parent `timeState` is frozen. Descent is offered only for anchors with a year world (`hasYol`, currently 1769 & 1969); elsewhere the Earth click raises a notice.

## Quality tiers

`quality: 'high' | 'medium' | 'low'` scales particle counts and DPR cap from `config.ts`. Auto-drop after sustained low FPS is a later-cycle idea (see implementation-notes).

## Cycle 7 — the generic world stack (issue #16)

`yol` mode is now "inside a WORLD STACK", not one fixed year renderer. The
top frame decides which overlay renderer is front-of-house; there is no
subject-specific state anywhere and no depth limit.

```
src/experience/
  worlds.ts          WorldFrame types (line | yol | historical-field |
                     topic), StackedFrame (frame + entryRect + entrySeed),
                     breadcrumbLabels
  store.ts           worldStack + pushWorld/popWorld/returnToDepth/
                     updateTopRestore (frames own their restore data);
                     ONE `locked` flag guards every hop
  runtime.ts         fieldTimeState (continuous fractional years) +
                     topicScrollState (chapter axis) + worldTransitionState
  field/layout.ts    deterministic seeded temporal-collage layout
                     (pure; computed once per dataset)
  overlay/worlds/
    HistoricalFieldPage.tsx  continuous field renderer (per-frame: ease +
                     4 transforms + emphasis/tabindex writes)
    TopicWorldPage.tsx       generic horizontal chapter renderer (all kinds)
    WorldTransition.tsx      shared-element push/pop cover plate
    WorldChrome.tsx          breadcrumb + Back
    PlaceholderPlate.tsx     deterministic seeded plates (no assets)
  overlay/useWorldData.ts    cached async accessor over the data boundary
src/domain/worlds.ts         renderer-facing view models + data-source iface
src/data/worlds/             mock-adapter + prototype-content + destinations
```

Rules added this cycle (all carry forward the invariants above):

- **One Canvas, overlay worlds.** Line↔first-world is the proven camera
  descent; world↔world hops are overlay-level shared-element transitions —
  NO Canvas remount, NO route change, at any depth.
- **Input routing by top-world type** (`Experience.tsx`): wheel/←→ drive
  `fieldTimeState` (field) or `topicScrollState` (topic) or `localTimeState`
  (YoL); down/left = earlier everywhere temporal; Escape pops one level.
  All still behind the single `locked` flag.
- **Exact restoration is data, not reconstruction.** Renderers write their
  live position into the top frame before a push; pops read it back;
  deterministic layout + seeded plates guarantee identical arrangements.
- **The renderer consumes domain view models only** (`src/domain/worlds.ts`)
  through `HistoricalWorldDataSource` (mock adapter today; a CRM adapter
  later — the renderers do not change). See `docs/backend-crm-handoff.md`.
- **Destinations are data** (`src/data/worlds/destinations.ts`): 1769 →
  field, 1969 → the untouched DB-backed YoL; new ranges = a new entry.
- **Per-frame values stay out of React state**; the narrow flag is derived
  from matchMedia (on change), never per frame; tunables live in
  `config.ts` + the `?debug=1` panel (also seedable via `?tune.<key>=<n>`).
