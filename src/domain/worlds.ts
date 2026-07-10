/**
 * Renderer-facing contracts for the Historical Field and Topic Worlds.
 *
 * THE data boundary for the future CRM/backend: the experience renderers
 * consume ONLY these view models, resolved through the asynchronous
 * `HistoricalWorldDataSource` interface. This cycle ships a mock adapter
 * (src/data/worlds/mock-adapter.ts) with clearly provisional placeholder
 * content; a later cycle replaces the ADAPTER with a CRM/API-backed one and
 * the renderers do not change. The UI must never become aware of database
 * tables — see docs/backend-crm-handoff.md for the backend contract.
 *
 * Years are astronomical-year numbers (matching src/data/anchors.ts and the
 * database convention). JS `Date` is never used for historical time.
 */

/* ------------------------------------------------------------------ */
/* Historical Field                                                    */
/* ------------------------------------------------------------------ */

export type HistoricalItemKind =
  | 'person'
  | 'invention'
  | 'discovery'
  | 'event'
  | 'organisation'
  | 'place'
  | 'idea';

export type WorldProvenance = 'placeholder' | 'reviewed';

export interface HistoricalMediaVM {
  id: string;
  /** empty string = no real asset; render a deterministic placeholder plate */
  src: string;
  alt: string;
  /** width / height */
  aspectRatio: number;
  crop?: string;
  rightsStatus: string;
  mediaType: string;
  provenance: string;
  placeholder: boolean;
}

/** Optional editorial composition overrides — the future CRM may store
 *  these per record; the deterministic layout works without them. */
export interface FieldComposition {
  preferredLane?: number;
  sizeClass?: 'small' | 'medium' | 'large';
  /** additive fine-tuning in field units (vw / vh) */
  offsetX?: number;
  offsetY?: number;
  /** 0 = front (most interactive), larger = deeper parallax */
  depth?: number;
}

export interface HistoricalFieldItemVM {
  id: string;
  slug: string;
  kind: HistoricalItemKind;

  title: string;
  summary?: string;

  startYear: number;
  endYear?: number;
  dateLabel: string;
  datePrecision: 'day' | 'month' | 'year' | 'range' | 'approximate';

  themeKeys: string[];
  /** 0..100 editorial weight; drives size, z-order and lane priority */
  prominence: number;

  media: HistoricalMediaVM[];
  primaryMediaId?: string;

  /** set when this record opens a Topic World */
  topicWorldSlug?: string;

  provenance: WorldProvenance;
  editorialStatus: string;

  composition?: FieldComposition;
}

export interface HistoricalFieldVM {
  id: string;
  rangeStart: number;
  rangeEnd: number;
  title: string;
  items: HistoricalFieldItemVM[];
  provenance: WorldProvenance;
}

/* ------------------------------------------------------------------ */
/* Topic Worlds                                                        */
/* ------------------------------------------------------------------ */

export type TopicKind =
  | 'invention'
  | 'person'
  | 'organisation'
  | 'intellectual-movement';

/** Data-driven world identity — CSS-consumable tokens, never artwork. */
export interface TopicIdentity {
  background: string;
  foreground: string;
  muted: string;
  accent: string;
  secondaryAccent?: string;
  surface: string;
  /** atmosphere key the renderer maps to a background treatment */
  atmosphere: string;
  /** display typography voice key (mapped to font stacks in CSS) */
  typeTreatment: 'mechanical' | 'measured' | 'institutional' | 'correspondence';
  /** motion character key (mapped to easing/durations in CSS/JS) */
  motionCharacter: 'rhythmic' | 'precise' | 'stately' | 'flowing';
  textureTreatment?: string;
}

export interface TopicChapterVM {
  id: string;
  title: string;
  /** short provisional copy — never presented as the final record */
  body: string;
  media: HistoricalMediaVM[];
  /** when set, this chapter carries a doorway into another Topic World */
  relatedTopicSlug?: string;
  relatedTopicTitle?: string;
}

export interface RelatedTopicVM {
  slug: string;
  title: string;
  kind: TopicKind;
}

export interface TopicWorldVM {
  id: string;
  slug: string;
  kind: TopicKind;

  title: string;
  supportingLine?: string;
  dateLabel?: string;

  identity: TopicIdentity;
  chapters: TopicChapterVM[];
  relatedTopics: RelatedTopicVM[];

  provenance: WorldProvenance;
}

/* ------------------------------------------------------------------ */
/* The asynchronous data-source boundary                               */
/* ------------------------------------------------------------------ */

export interface HistoricalWorldDataSource {
  getHistoricalField(input: {
    rangeStart: number;
    rangeEnd: number;
    focusYear: number;
  }): Promise<HistoricalFieldVM>;

  getTopicWorld(slug: string): Promise<TopicWorldVM>;
}
