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
      YolScene.tsx   1969 scene content
      Descent.tsx    GSAP camera/fog transition, scene swap
    three/           reusable meshes/shaders (Earth, CloudLayer, Field…)
    overlay/         DOM: lens, year label, anchor labels, YoL text, debug panel
src/data/            typed placeholder content (see 02-data-model.md)
```

## Rules

- **One persistent `<Canvas>`.** Scenes are groups toggled/faded inside it; the descent hides the swap inside the cloud layer.
- **Camera fixed in Line View.** Scrolling translates the line group in X; the lens and Earth stay screen-centred. Descent is the only camera move, driven by one GSAP timeline.
- **Per-frame values live in refs / `useFrame`,** never React state. Zustand holds discrete state only (mode, timePos target, active anchor, lock flags).
- **All tunables come from `config.ts`** and can be overridden live via the leva panel (`?debug=1`). Do not scatter magic numbers in components.
- **Content data never imports rendering code** and vice versa (render reads data, not the other way).
- **Input locking:** `store.transitionLock` guards wheel/keys/clicks during descent/return. All input handlers must check it.

## State machine

`mode: 'line' | 'descending' | 'yol' | 'ascending'`. Transitions only via store actions `beginDescent(anchorId)` / `beginReturn()`, which set the lock; GSAP `onComplete` commits `mode` and releases the lock. Interrupted transitions (rapid input) are ignored while locked.

## Quality tiers

`quality: 'high' | 'medium' | 'low'` scales particle counts and DPR cap from `config.ts`. Auto-drop after sustained low FPS is a later-cycle idea (see implementation-notes).
