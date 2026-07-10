# 02 — Data Model

All content data lives in `src/data/`, separate from rendering. Everything here is **placeholder** — flagged via the `placeholder: true` field. Do not present it as researched history.

## Types (`src/data/types.ts`)

```ts
type ThemeId = string;

interface Theme {
  id: ThemeId;
  label: string;        // e.g. "AI"
  color: string;        // hex accent for the theme sphere
}

interface Anchor {
  id: string;           // "1969", "bce-10000", ...
  year: number;         // astronomical year for math (-9999 for 10,000 BCE)
  label: string;        // display, e.g. "c. 10,000 BCE"
  subtitle: string;     // short caption under the label
  themes: Theme[];      // orbiting theme spheres
  era: EraMood;         // drives the upper field
  placeholder: true;    // all cycle-1 content is placeholder
}

interface EraMood {
  tint: string;         // particle/haze tint
  fieldStyle: 'settlement' | 'print' | 'industrial' | 'orbital' | 'network';
  density: number;      // 0..1 relative particle density
}
```

## Anchors (`src/data/anchors.ts`)

Ordered oldest → newest: `bce-10000`, `1450`, `1769`, `1969`, `2026`. Index in this array is the unit of scroll space (`timePos` 0–4). 2026 themes: AI, War, Climate, Energy, Space. Other anchors carry simple placeholder themes.

## YoL content (`src/data/yol.ts`)

Per-anchor YoL copy (currently only 1969 is fleshed out): `title`, `thesis` (placeholder line), `themeLabels`. The 1969 scene motifs (spaceflight, analogue computing, signal transmission) are abstract visuals only, defined in the scene component, not data.
