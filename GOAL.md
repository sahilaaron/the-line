# GOAL — Build Cycle 5: Year Visual Identity (1969)

(Cycle 3 = database foundation; Cycle 4 = Seed Inspector — see
`docs/implementation-notes.md`. This cycle began as "visual unification"
and was re-scoped mid-cycle by the product brief below.)

## Mission

Line View stays outside history (dark, cosmic, abstract). Every Year on
Line lives inside its period. Build a reusable **Year Visual Identity**
system — typed model, per-year config in data, asset manifest, reusable
media treatments — and apply it to 1969, so a future 1450/1769/2026 can
look materially different while still feeling like The Line.

Shared product identity comes from structure, not surface: The Line and
its bottom strip, active-year pulse, theme identities (anchor colour +
orb + label), caption/provenance conventions, navigation, transition
motion.

## Shipped

- `src/data/identity/` — `YearVisualIdentity` model (palette, typography
  roles, layout, media values, motion, motifs, theme substyles, asset
  manifest, fallback), 1969 config, registry + `DEFAULT_IDENTITY`, vitest
  coverage (provenance/rights guards included).
- `src/experience/overlay/identity-css.ts` — identity → `--yr-*` CSS
  variables on `.yol-page`; no year styling hard-coded in components.
- `src/experience/overlay/media/MediaFrame.tsx` — treatments: full-bleed,
  split, contact-sheet, halftone, diagram-plate, archival-frame, collage,
  panorama, cutout, captioned; typed captions with provenance labels.
- 1969 YoL journey restyled: space-age editorial hero (grotesque display
  year, crop/registration marks), diagram-plate Apollo, dark broadcast/
  computing plates (scanlines, punch-card, oscilloscope green),
  documentary halftone Moratorium, counterculture cutout for Woodstock
  only, contact-sheet ordinary life, newspaper pull-quote, closing
  panorama; all prior content preserved.
- Named slots + placeholder files for externally generated imagery
  (`public/yol1969/slots/`, manifest entries, visible dev surfaces).
- Structural continuity kept from earlier this cycle: shared core tokens
  (`src/experience/tokens.ts`), YoL bottom Line strip (same Line object,
  gold pulse), theme chips = theme spheres, warm-cloud descent, transition
  dimmer, Seed Inspector toggle gated behind `?debug=1`.
- Docs: `docs/year-visual-identity.md`, `docs/visual-system.md` (audit +
  structural rules), updated implementation notes.

## Done when (all verified this cycle, see implementation notes)

`lint`, `typecheck`, unit tests, production build (off-mount in this
sandbox), and the e2e specs pass; the full loop (Line → descent → 1969 →
return) verified in the browser with screenshots of all major sections.

## Deferred / next

- Externally generated imagery for the named 1969 slots.
- Identity configs for 1450 / 1769 / 2026.
- Real-GPU motion review (sandbox is software-rendered).
- Optional richer licensed fonts via next/font (document first).
