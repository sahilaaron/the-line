/**
 * Domain-facing types distinct from raw Drizzle row types. These describe
 * shapes useful to *future* consumers (e.g. an eventual DB-backed anchor
 * adapter) without leaking Drizzle's row/column types outside src/db.
 */
import type { EraMood, Theme } from '../data/types';

export interface DomainThemeRef {
  entityId: string;
  slug: string;
  theme: Theme;
}

/** Everything needed to build one src/data-shaped Anchor from DB rows. */
export interface DomainAnchorSource {
  periodId: string;
  anchorSlug: string;
  year: number;
  label: string;
  subtitle: string;
  themes: DomainThemeRef[];
  era: EraMood;
}
