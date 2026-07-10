'use client';

/**
 * Client accessor for GET /api/yol/[anchorSlug].
 *
 * - caches by anchor slug (module scope; one fetch per slug per session)
 * - deduplicates concurrent requests (in-flight promise reuse)
 * - retries transient failures once with a short backoff, and exposes a
 *   manual retry that clears the cache entry
 * - can PREFETCH the destination when a descent starts, so the year's
 *   database content is normally resolved before the clouds clear
 * - exposes loading / database / fallback / error states; the renderer
 *   receives a single YolViewModel either way and never sees raw DB rows
 *
 * The prototype TypeScript registry (src/data/yol) is used ONLY as the
 * clearly isolated fallback: empty or unavailable database, missing
 * composition, or development before seeding. It is never consulted when
 * the database answered with a composition.
 */
import { useEffect, useReducer } from 'react';
import { ANCHORS } from '@/src/data/anchors';
import { getYolYear } from '@/src/data/yol';
import type { YolApiResponse, YolReadModel } from '@/src/domain/yol-read-model';
import { dbToViewModel, fallbackViewModel, type YolViewModel } from './yol-view-model';

export type YolDataStatus = 'loading' | 'database' | 'fallback' | 'error';

export interface YolDataState {
  status: YolDataStatus;
  /** why the fallback was selected (diagnostics; only shown in debug) */
  fallbackReason?: 'not_found' | 'empty' | 'error' | 'network';
  model?: YolReadModel;
}

interface CacheEntry {
  state: YolDataState;
  inFlight?: Promise<void>;
}

const cache = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();
const RETRY_DELAY_MS = 400;

function emit() {
  for (const l of listeners) l();
}

function entryFor(slug: string): CacheEntry {
  let e = cache.get(slug);
  if (!e) {
    e = { state: { status: 'loading' } };
    cache.set(slug, e);
  }
  return e;
}

async function fetchOnce(slug: string): Promise<YolApiResponse> {
  const res = await fetch(`/api/yol/${encodeURIComponent(slug)}`);
  // non-2xx still carries a typed envelope; malformed JSON throws -> network
  return (await res.json()) as YolApiResponse;
}

async function load(slug: string, entry: CacheEntry): Promise<void> {
  let response: YolApiResponse | undefined;
  for (let attempt = 0; attempt < 2 && !response; attempt++) {
    try {
      const r = await fetchOnce(slug);
      // retry a server-side error once; accept everything else immediately
      if (r.status === 'error' && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      response = r;
    } catch {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        entry.state = { status: 'fallback', fallbackReason: 'network' };
      }
    }
  }
  if (response) {
    if (response.status === 'ok') {
      entry.state = { status: 'database', model: response.model };
    } else if (response.status === 'error') {
      entry.state = { status: 'fallback', fallbackReason: 'error' };
    } else {
      entry.state = { status: 'fallback', fallbackReason: response.status };
    }
  }
  entry.inFlight = undefined;
  emit();
}

function ensureLoaded(slug: string): void {
  const entry = entryFor(slug);
  if (entry.state.status !== 'loading' || entry.inFlight) return;
  entry.inFlight = load(slug, entry);
}

/** Prefetch a destination year's data (called when a descent begins, so
 *  the content usually arrives before the clouds clear). */
export function prefetchYol(anchorSlug: string): void {
  if (typeof window === 'undefined') return;
  ensureLoaded(anchorSlug);
}

/** Clear one slug (or everything) and refetch — manual retry. */
export function reloadYol(anchorSlug?: string): void {
  if (anchorSlug) cache.delete(anchorSlug);
  else cache.clear();
  emit();
  if (anchorSlug) ensureLoaded(anchorSlug);
}

/** Raw accessor state for a slug (test/debug use). */
export function yolDataState(anchorSlug: string): YolDataState {
  return cache.get(anchorSlug)?.state ?? { status: 'loading' };
}

/**
 * The renderer-facing hook: resolves the current YolViewModel for an
 * anchor. While the database answer is pending it serves the fallback
 * registry content marked `source: 'fallback'` (prefetching during the
 * descent makes this window invisible in practice), then upgrades.
 */
export function useYolViewModel(anchorId: string): { vm: YolViewModel | null; state: YolDataState } {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    if (anchorId) ensureLoaded(anchorId);
    return () => {
      listeners.delete(force);
    };
  }, [anchorId]);

  const anchor = ANCHORS.find((a) => a.id === anchorId);
  if (!anchor) return { vm: null, state: { status: 'error' } };
  const state = yolDataState(anchorId);

  if (state.status === 'database' && state.model) {
    return { vm: dbToViewModel(state.model, anchor), state };
  }
  const yearYol = getYolYear(anchorId);
  if (!yearYol) return { vm: null, state };
  return { vm: fallbackViewModel(yearYol, anchor), state };
}

/** Test-only: reset the module cache between tests. */
export function __resetYolDataCache(): void {
  cache.clear();
}
