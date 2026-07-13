'use client';

/**
 * Cached client accessor for the world data-source boundary. Same
 * discipline as useYolData: module-scope cache, in-flight dedupe,
 * prefetch-before-arrival, no raw data structures reaching renderers
 * beyond the domain view models.
 */
import { useEffect, useReducer } from 'react';
import type { HistoricalFieldVM, TopicWorldVM } from '@/src/domain/worlds';
import { getWorldDataSource } from '@/src/data/worlds/mock-adapter';
import type { HistoricalFieldFrame, WorldFrame } from '../../experience/worlds';

type Entry<T> = { status: 'loading' | 'ready' | 'error'; vm?: T; inFlight?: Promise<void> };

const fieldCache = new Map<string, Entry<HistoricalFieldVM>>();
const topicCache = new Map<string, Entry<TopicWorldVM>>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function load<T>(cache: Map<string, Entry<T>>, key: string, fetcher: () => Promise<T>): Promise<void> {
  let entry = cache.get(key);
  if (!entry) {
    entry = { status: 'loading' };
    cache.set(key, entry);
  }
  if (entry.status === 'ready' || entry.inFlight) return entry.inFlight ?? Promise.resolve();
  entry.inFlight = fetcher()
    .then((vm) => {
      cache.set(key, { status: 'ready', vm });
    })
    .catch(() => {
      cache.set(key, { status: 'error' });
    })
    .finally(emit);
  return entry.inFlight;
}

function fieldKey(f: HistoricalFieldFrame): string {
  return `${f.rangeStart}:${f.rangeEnd}`;
}

/** Kick a fetch for a frame's data (awaited by the transition controller
 *  so worlds activate only when their content is ready). */
export function prefetchWorld(frame: WorldFrame): Promise<void> {
  const source = getWorldDataSource();
  if (frame.type === 'historical-field') {
    return load(fieldCache, fieldKey(frame), () =>
      source.getHistoricalField({
        rangeStart: frame.rangeStart,
        rangeEnd: frame.rangeEnd,
        focusYear: frame.focusYear,
      })
    );
  }
  if (frame.type === 'topic') {
    return load(topicCache, frame.slug, () => source.getTopicWorld(frame.slug));
  }
  return Promise.resolve();
}

function useWorldCache(): void {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);
}

export function useFieldVM(frame: HistoricalFieldFrame): { vm: HistoricalFieldVM | null; status: string } {
  useWorldCache();
  useEffect(() => {
    void prefetchWorld(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.id]);
  const entry = fieldCache.get(fieldKey(frame));
  return { vm: entry?.vm ?? null, status: entry?.status ?? 'loading' };
}

export function useTopicVM(slug: string): { vm: TopicWorldVM | null; status: string } {
  useWorldCache();
  useEffect(() => {
    void prefetchWorld({ type: 'topic', id: `topic-${slug}`, slug, topicKind: 'invention', title: slug, restore: { chapterPos: 0 } });
     
  }, [slug]);
  const entry = topicCache.get(slug);
  return { vm: entry?.vm ?? null, status: entry?.status ?? 'loading' };
}

/** Test-only. */
export function __resetWorldDataCache(): void {
  fieldCache.clear();
  topicCache.clear();
}
