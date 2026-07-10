import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetYolDataCache, prefetchYol, reloadYol, yolDataState } from './useYolData';
import type { YolApiResponse } from '@/src/domain/yol-read-model';

function jsonResponse(body: YolApiResponse) {
  return { json: async () => body } as Response;
}

const okBody: YolApiResponse = {
  status: 'ok',
  model: {
    anchorSlug: '1969',
    enteredYear: 1969,
    title: '1969',
    thesis: 't',
    supportingLine: null,
    atmospherePreset: 'orbital',
    provenance: 'placeholder',
    editorialStatus: 'draft',
    themes: [],
    points: [],
  },
};

async function settled(slug: string, timeoutMs = 3000) {
  const start = Date.now();
  while (yolDataState(slug).status === 'loading') {
    if (Date.now() - start > timeoutMs) throw new Error('accessor never settled');
    await new Promise((r) => setTimeout(r, 20));
  }
  return yolDataState(slug);
}

describe('useYolData accessor', () => {
  beforeEach(() => {
    __resetYolDataCache();
    vi.stubGlobal('window', {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resolves database content and caches by anchor slug', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(okBody));
    vi.stubGlobal('fetch', fetchMock);
    prefetchYol('1969');
    prefetchYol('1969'); // deduped while in flight
    const state = await settled('1969');
    expect(state.status).toBe('database');
    expect(state.model?.anchorSlug).toBe('1969');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    prefetchYol('1969'); // cached after settling
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back on not_found / empty without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'not_found' }));
    vi.stubGlobal('fetch', fetchMock);
    prefetchYol('1450');
    const state = await settled('1450');
    expect(state.status).toBe('fallback');
    expect(state.fallbackReason).toBe('not_found');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a server error once, then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: 'error' }))
      .mockResolvedValueOnce(jsonResponse(okBody));
    vi.stubGlobal('fetch', fetchMock);
    prefetchYol('1969');
    const state = await settled('1969');
    expect(state.status).toBe('database');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back after repeated network failure', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    prefetchYol('1769');
    const state = await settled('1769');
    expect(state.status).toBe('fallback');
    expect(state.fallbackReason).toBe('network');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reloadYol clears one slug and refetches', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(okBody));
    vi.stubGlobal('fetch', fetchMock);
    prefetchYol('1969');
    await settled('1969');
    reloadYol('1969');
    await settled('1969');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
