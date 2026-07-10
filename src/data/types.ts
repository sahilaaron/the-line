/**
 * Content data types. Everything in src/data is PLACEHOLDER content for the
 * physics prototype — flagged via `placeholder: true`. Nothing here has been
 * historically researched and none of it may be presented as fact.
 */

export type FieldStyle =
  | 'settlement'
  | 'print'
  | 'industrial'
  | 'orbital'
  | 'network';

export interface EraMood {
  /** particle / haze tint (hex) */
  tint: string;
  /** secondary accent used for sparse glow points */
  accent: string;
  fieldStyle: FieldStyle;
  /** 0..1 relative particle density */
  density: number;
  /** 0..1 how "connected" the field feels (drift coherence) */
  order: number;
}

export interface Theme {
  id: string;
  label: string;
  color: string;
}

export interface Anchor {
  id: string;
  /** astronomical year used for interpolation math (-9999 === 10,000 BCE) */
  year: number;
  /** display label, e.g. "c. 10,000 BCE" */
  label: string;
  subtitle: string;
  themes: Theme[];
  era: EraMood;
  placeholder: true;
}

export interface YolContent {
  anchorId: string;
  title: string;
  /** short placeholder thesis line — NOT researched history */
  thesis: string;
  themeLabels: string[];
  placeholder: true;
}
