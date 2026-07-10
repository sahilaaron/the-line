'use client';

/**
 * Shared client-side accessor for /api/line-data.
 *
 * One fetch is shared across every consumer (the always-on inline readout on
 * the Line AND the Seed Inspector panel), cached at module scope with a tiny
 * subscription so both stay in sync and a retry re-fetches for all. Keeping
 * this here means neither component runs SQL — they only read this JSON.
 */
import { useEffect, useReducer } from 'react';

export type Provenance = 'prototype' | 'synthetic' | 'reviewed';

export interface Rel {
  type: string;
  other: string;
  strength: number;
  confidence: number;
  disputed: boolean;
  provenance: Provenance;
}
export interface Src {
  title: string;
  type: string;
  publicationYear: number | null;
  provenance: Provenance;
}
export interface ClaimRec {
  text: string;
  verificationStatus: string;
  disputed: boolean;
  provenance: Provenance;
  sources: Src[];
}
export interface Anchor {
  slug: string | null;
  label: string;
  displayYear: number | null;
  startYear: number | null;
  period: {
    precision: string | null;
    confidence: number;
    editorialStatus: string;
    isPlaceholder: boolean;
    provenance: Provenance;
  };
  yol: {
    title: string;
    thesis: string;
    supportingLine: string | null;
    atmosphere: string;
    editorialStatus: string;
    provenance: Provenance;
  } | null;
  themes: { label: string; importance: number }[];
  featured: { label: string; kind: string; provenance: Provenance }[];
  entityCount: number;
  relationships: { incoming: Rel[]; outgoing: Rel[] };
  claims: ClaimRec[];
}
export interface LineData {
  seeded: boolean;
  dbError?: boolean;
  dbPath?: string;
  seedSet?: 'empty' | 'prototype' | 'synthetic';
  hasSynthetic?: boolean;
  message?: string;
  error?: string;
  counts?: Record<string, number>;
  synthetic?: Record<string, number>;
  prototype?: Record<string, number>;
  anchors?: Anchor[];
}

export interface LineDataState {
  data: LineData | null;
  error: boolean;
}

let state: LineDataState = { data: null, error: false };
let started = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function doFetch() {
  fetch('/api/line-data')
    .then((r) => r.json())
    .then((d: LineData) => {
      state = { data: d, error: false };
      emit();
    })
    .catch(() => {
      state = { data: null, error: true };
      emit();
    });
}

/** Force a fresh fetch (used by the inspector's retry / re-check buttons). */
export function reloadLineData() {
  state = { data: null, error: false };
  emit();
  doFetch();
}

export function useLineData(): LineDataState {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    if (!started) {
      started = true;
      doFetch();
    }
    return () => {
      listeners.delete(force);
    };
  }, []);
  return state;
}
