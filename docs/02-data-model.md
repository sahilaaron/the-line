# 02 — Data Model

Content data is separate from rendering. Most content still lives in `src/data/` as **placeholder** (flagged `placeholder: true`) — do not present it as researched history.

> **Updated in Cycle 6 (issue #14):** the rendered Year-on-Line no longer reads from `src/data/yol`. Its chronology now comes from the **database** via the read model (`src/db/queries/yol-read-model.ts` → `GET /api/yol/[anchorSlug]`); the `src/data/yol` registry survives only as the isolated fallback for an empty/unavailable database. See `docs/database/schema-overview.md` and `docs/database/research-handoff.md`.

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

## YoL content

**Primary source (Cycle 6): the database.** A year's local timeline is a
`yol_compositions` row plus ordered `yol_timeline_points` (roles
overview/development/context/closing) with `yol_point_themes` lens tags; the
read model shapes these into one `YolReadModel` served by
`GET /api/yol/[anchorSlug]`. Both **1769 and 1969** are fleshed out and
draft/placeholder (no invented sources).

**Fallback only:** `src/data/yol.ts` still holds per-anchor copy (`title`,
`thesis`, `themeLabels`, events, neighbours). The client uses it solely when
the database is empty or unavailable, marked `source: 'fallback'`. Both the
database and fallback are normalised into one `YolViewModel`
(`src/experience/overlay/yol-view-model.ts`) that the renderer consumes.
