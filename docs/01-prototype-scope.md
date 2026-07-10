# 01 — Prototype Scope (Cycle 1)

Goal: prove the core spatial loop. See `GOAL.md` for the authoritative acceptance list.

## In scope

- Line View: timeline ~75vh, fixed lens, 5 anchors, wheel scroll (down = backward), soft snap, arrow-key stepping, 2026 cap.
- Temporal Earth: layered procedural sphere, atmosphere, faint grid, orbiting theme spheres per anchor.
- Living upper field: abstract era-tinted particles/haze/signals. Restrained.
- Descent: click Earth at 1969 → input lock → camera dive → cloud layer hides scene swap → 1969 YoL.
- YoL 1969: big label, placeholder thesis, theme labels, Line near 91.7vh with pulse, return control that restores Line View at 1969.
- Non-1969 anchors: clicking Earth shows a "1969 prototype only" notice (kept architecture simpler than a generic YoL).
- Debug mode `?debug=1`: leva tuning panel + metrics.
- Vitest logic tests; Playwright core-loop test if environment allows.

## Out of scope

Backend, auth, CMS, real historical media/content, citations, Thread/Entity views, future branches, accounts, mobile, audio, final art.

## Definition of done

`npm run lint`, `typecheck`, `test`, `build` all pass; loop verified in a real browser; defects recorded in `implementation-notes.md`.
