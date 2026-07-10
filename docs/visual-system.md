# Visual System — The Line

> Scope note (2026-07-10): mid-cycle, product direction replaced "one shared
> surface look" with the **Year Visual Identity** system — Line View stays
> cosmic/timeless, each year styles itself from its period; shared identity
> is structural. See `docs/year-visual-identity.md`. The audit below is kept
> for the structural rules and findings that still apply.

## Visual audit (2026-07-10, before this cycle's changes)

### What already belonged to The Line — preserved
- The Line: gold-at-active cooling to blue with distance, additive glow,
  gold tick markers, pulsing gold ring at the lens (~1.8s rhythm).
- The vertical temporal lens, the gold Earth↔Line beam, serif years.
- Dark space depth (#050608), era-tinted particle field, procedural Earth,
  orbiting theme spheres with additive halos.
- Cloud-hidden scene swap; destination signals emerging through clouds.
- Restrained motion; readable DOM text over the canvas.

### What conflicted then
- YoL had NO Line, no pulse, unrelated theme colours, dev UI (Seed
  Inspector toggle) in public view, polaroid-style pasted images, and
  transitions where the cream page popped at full brightness beneath
  dark clouds. Raw colours/timings were scattered across CSS/components.

## Structural rules (hold across ALL years)

1. The Line is one object at every depth: gold at the active year, cooling
   with temporal distance; gold tick markers; the active marker carries the
   same ~1.82s pulse ring as the 3D LinePulse.
2. Theme = anchor colour + orb geometry + uppercase label, identical in
   Line View (spheres) and any YoL (chips/tags). Selecting `Computing`
   inside a year is visibly the Computing force around the Temporal Earth.
3. Gold marks temporal presence (active year, The Line, focus states) and
   is never decorative filler. Focus-visible = 1px gold outline everywhere.
4. Captions: typewriter/mono DOM text with a mandatory provenance label;
   generated or reconstructed media is never presented as archival.
5. Transitions pass through atmosphere: the cloud passage dims/illuminates
   the destination (yol-dimmer + CloudLayer uWarm); no surface pops at full
   brightness beneath the clouds; The Line stays lit until the swap.
6. Years are the same CONCEPT at both depths (year above/beside The Line),
   while their typeface may be period-specific inside the year.
7. Dev tooling (Seed Inspector, debug panel) is visually separate and
   hidden unless explicitly opened (`?debug=1` or the `i` key).
8. Shared core values (depth colours, gold, cool line, type scale, timing)
   come from `src/experience/tokens.ts` → CSS vars on `.experience`; year
   surfaces come from the Year Visual Identity → `--yr-*` vars on
   `.yol-page`. No raw values in components.

## Where things live

- Structural tokens: `src/experience/tokens.ts` (+ globals.css fallbacks).
- Year identities: `src/data/identity/` (see year-visual-identity.md).
- 3D tuning (camera, fov, densities, spacing): `config.ts` / `useTuning`,
  live-editable via `?debug=1` — never duplicated into the token system.
