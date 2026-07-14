/**
 * Discovery adapter boundary. Autonomous "random eligible Wikipedia page"
 * discovery is injected, never hard-wired — so tests use a deterministic
 * adapter and never touch the network. A real Wikipedia adapter may exist as
 * long as it stays small, optional, timeout-safe and fully replaceable.
 */
export interface DiscoverySeed {
  title: string;
  url?: string;
}

export interface DiscoveryAdapter {
  /** Return the next eligible random seed, or null if none is available. */
  nextSeed(): Promise<DiscoverySeed | null>;
}

/** Deterministic adapter for tests/fixtures: cycles through a fixed list. */
export function deterministicDiscoveryAdapter(seeds: DiscoverySeed[]): DiscoveryAdapter {
  let i = 0;
  return {
    async nextSeed() {
      if (seeds.length === 0) return null;
      const seed = seeds[i % seeds.length];
      i += 1;
      return seed;
    },
  };
}

/** Adapter that never produces a seed (random discovery disabled). */
export const noDiscoveryAdapter: DiscoveryAdapter = {
  async nextSeed() {
    return null;
  },
};
