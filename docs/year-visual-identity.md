# Year Visual Identity

Line View is outside history: dark, cosmic, abstract, near-timeless. Every
Year on Line is inside its period: it adopts a visual language informed by
that period's art, print, media and typography. Product identity is
STRUCTURAL, not surface: The Line (bottom strip, gold at the active year,
cooling with temporal distance), the active-year pulse (~1.82s, matching the
3D LinePulse), theme identities (anchor colour + orb geometry + uppercase
label), typed caption + provenance conventions, navigation and return
behaviour, and transition motion.

## Architecture

- `src/data/identity/types.ts` — `YearVisualIdentity`: semantic palette,
  typography roles, layout rules, media treatment values, motion character,
  dominant motifs, per-theme substyles, asset manifest, notes.
- `src/data/identity/year-1969.ts` — the 1969 identity + asset manifest.
- `src/data/identity/index.ts` — registry, `getYearIdentity(id)` and
  `DEFAULT_IDENTITY` (restrained fallback for years without a designed
  identity), `getAsset()`.
- `src/experience/overlay/identity-css.ts` — `identityCssVars()` maps an
  identity onto `--yr-*` CSS variables, applied once on `.yol-page`.
  ALL period styling in `app/globals.css` reads `--yr-*`; components carry
  no year-specific values.
- `src/experience/overlay/media/MediaFrame.tsx` — reusable media treatments
  driven by the manifest: `full-bleed`, `split`, `contact-sheet`,
  `halftone`, `diagram-plate`, `archival-frame`, `collage`, `panorama`,
  `cutout`, `captioned`. Captions are DOM (typewriter role) and always show
  provenance (`archival` / `generated illustration` / `illustrative
  reconstruction` / `placeholder`). Never label non-archival media as
  archival; never bake readable text into images.
- Shared (non-year) tokens stay in `src/experience/tokens.ts`; 3D tuning in
  `config.ts`/`useTuning` is untouched by identity.
- `identity.test.ts` (vitest) guards: registry fallback, alt text presence,
  no rights claims on non-archival assets, lens-substyle coverage.

## 1969 identity (summary)

Space-age editorial modernism as the base voice (warm cream paper, near-black
ink, rust/ochre accents, bold tight-tracked grotesque display type, technical
orbital diagrams, crop/registration marks); documentary print for conflict
and protest (halftone dots, grayscale-multiplied imagery, typed Courier
dates/captions, heavy black rules); analogue computing & broadcast on dark
plates (full-width `#161310` sections, scanlines, punch-card edge pattern,
oscilloscope green `#3fa877`); counterculture colour (saturated organic
cutout with screen-print offset shadow) ONLY for the music/youth section.
Not generic sepia; psychedelia never global.

Fonts (legally available local stacks, period-plausible): Helvetica/Arial
(display + headline; Helvetica 1957), Georgia (newspaper body), Courier
(typed captions + technical; Courier 1955). If richer licensed fonts are
added later (e.g. via next/font), document them here first.

## Theme substyles

`identity.themes[key]` gives each lens a section accent, motif and surface:
spaceflight → orbital diagram on paper; computing → punch-card plate;
signal → scanline plate; coldwar → documentary halftone with warning red;
`counterculture` is a substyle key only (not a lens). Chip colours remain
the ANCHOR theme colours (structural continuity with the theme spheres).

## Asset manifest & generated-image slots

Every image the page shows is a manifest record (path, role, section,
focal, crop, treatment, alt, caption, sourceType, rights, attribution).
Current 1969 media are illustrative reconstructions (collage crops).
Named slots awaiting externally generated imagery (dev surfaces render
with a dashed outline + "placeholder — awaiting imagery" caption + DOM
slot label): `slot-vietnam`, `slot-civil-rights`, `slot-fashion`,
`slot-closing`, `slot-transition-plate` (files under
`public/yol1969/slots/`). Drop generated files in, update the manifest
paths, keep text out of the images, do not claim rights.

## Descent / return relationship

During descent the clouds warm toward archival light (CloudLayer `uWarm`
eased toward `descentState.blend`); DestinationSignals' scanlines/wavefront/
launch-glow read as 1969 broadcast motifs; the theme spheres' colours are
the same ones the chips carry on arrival. The page arrives under a dark sky
band (`--yr-sky`) and the Line strip resolves last. On return the dimmer
darkens the material world while the Line strip stays lit (it sits above
the dimmer), then clouds cool back to orbital grey.

## Adding a new year (e.g. 1450)

1. Create `src/data/identity/year-1450.ts` implementing
   `YearVisualIdentity` (period palette/typography/motifs/assets).
2. Register it in `IDENTITIES` in `src/data/identity/index.ts`.
3. Give its events `section` keys and manifest assets.
4. Reuse MediaFrame treatments; add new motifs to the model only if the
   period genuinely needs them.
Un-designed years automatically get `DEFAULT_IDENTITY`.
