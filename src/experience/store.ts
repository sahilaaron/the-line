import { create } from 'zustand';
import { ANCHORS, INDEX_1969, INDEX_2026 } from '@/src/data/anchors';
import { destinationForAnchor, enterableAnchorIds } from '@/src/data/worlds/destinations';
import {
  TUNING_DEFAULTS,
  type QualityTier,
  type Tuning,
} from './config';
import type { EntryRect, StackedFrame, WorldFrame, WorldPhase } from './worlds';

export type Mode = 'line' | 'descending' | 'yol' | 'ascending';

interface ExperienceState {
  /**
   * The coarse machine: 'line' = on the parent Line, 'yol' = inside the
   * WORLD STACK (any depth — the top frame decides which renderer is
   * front-of-house), 'descending'/'ascending' = the camera transition
   * between them. World→world moves within the stack do not change mode;
   * they run through worldPhase + the shared `locked` flag.
   */
  mode: Mode;
  /** nearest anchor index (discrete; continuous position lives in runtime.ts) */
  activeIndex: number;
  /** the anchor index a descent started from — the return restores it */
  originIndex: number;
  /** input lock during ANY transition (descent, return, world push/pop) */
  locked: boolean;
  notice: string | null;
  quality: QualityTier;

  /* ---- the generic world stack (see worlds.ts) ---- */
  worldStack: StackedFrame[];
  worldPhase: WorldPhase;
  /** incoming frame while worldPhase === 'pushing' */
  pendingWorld: StackedFrame | null;
  /** stack index being returned to while worldPhase === 'popping' */
  popTargetDepth: number | null;

  setActiveIndex: (i: number) => void;
  /** Returns true if a descent actually started. */
  requestDescent: (index: number) => boolean;
  /** Called mid-transition, hidden inside the cloud layer. */
  commitYol: () => void;
  finishDescent: () => void;
  /** Returns true if a return actually started. */
  requestReturn: () => boolean;
  commitLine: () => void;
  finishReturn: () => void;
  setNotice: (n: string | null) => void;
  setQuality: (q: QualityTier) => void;

  /* ---- generic world navigation (subject-agnostic) ---- */
  /** Push a deeper world. Returns true if the transition started. */
  pushWorld: (frame: WorldFrame, entry?: { rect: EntryRect; seed: string }) => boolean;
  /** Return one level (top world → previous). At depth 1 this delegates
   *  to the camera return. Returns true if a transition started. */
  popWorld: () => boolean;
  /** Return to an arbitrary shallower depth in one transition
   *  (0 = the parent Line). */
  returnToDepth: (depth: number) => boolean;
  /** Renderers write their live position into the TOP frame's restore
   *  data (called before pushing, and on meaningful settles). */
  updateTopRestore: (partial: Record<string, unknown>) => void;
  /** Transition controller hooks (never called by renderers). */
  commitWorldChange: () => void;
  finishWorldChange: () => void;
}

export const useExperience = create<ExperienceState>((set, get) => ({
  mode: 'line',
  activeIndex: INDEX_2026,
  originIndex: INDEX_1969,
  locked: false,
  notice: null,
  quality: 'high',

  worldStack: [],
  worldPhase: 'idle',
  pendingWorld: null,
  popTargetDepth: null,

  setActiveIndex: (i) => {
    if (get().activeIndex !== i) set({ activeIndex: i });
  },

  requestDescent: (index) => {
    const s = get();
    if (s.locked || s.mode !== 'line') return false;
    const anchor = ANCHORS[index];
    if (!anchor) return false;
    const destination = destinationForAnchor(anchor.id);
    if (!destination) {
      const ids = enterableAnchorIds(ANCHORS.map((a) => a.id));
      set({
        notice: `Descent is prototyped for ${ids.join(' and ')} — travel there to enter a year.`,
      });
      return false;
    }
    const firstWorld: WorldFrame =
      destination.world === 'historical-field'
        ? {
            type: 'historical-field',
            id: `field-${destination.rangeStart}-${destination.rangeEnd}`,
            rangeStart: destination.rangeStart,
            rangeEnd: destination.rangeEnd,
            focusYear: anchor.year,
            title: `${destination.rangeStart}–${destination.rangeEnd}`,
            restore: { time: anchor.year, focusedItemId: null },
          }
        : { type: 'yol', id: `yol-${anchor.id}`, anchorId: anchor.id, restore: {} };
    set({
      mode: 'descending',
      locked: true,
      notice: null,
      originIndex: index,
      activeIndex: index,
      worldStack: [
        { frame: { type: 'line', id: 'root-line', restore: { anchorIndex: index } }, entryRect: null, entrySeed: null },
        { frame: firstWorld, entryRect: null, entrySeed: null },
      ],
    });
    return true;
  },

  commitYol: () => set({ mode: 'yol' }),
  finishDescent: () => set({ locked: false }),

  requestReturn: () => {
    const s = get();
    if (s.locked || s.mode !== 'yol') return false;
    set({ mode: 'ascending', locked: true, worldPhase: 'idle', pendingWorld: null, popTargetDepth: null });
    return true;
  },

  /** Return lands on the SAME anchor the descent started from. */
  commitLine: () =>
    set((s) => ({ mode: 'line', activeIndex: s.originIndex, worldStack: [] })),
  finishReturn: () => set({ locked: false }),

  setNotice: (n) => set({ notice: n }),
  setQuality: (q) => set({ quality: q }),

  /* ------------------------------------------------------------ */
  /* World stack                                                    */
  /* ------------------------------------------------------------ */

  pushWorld: (frame, entry) => {
    const s = get();
    if (s.locked || s.mode !== 'yol' || s.worldPhase !== 'idle') return false;
    if (s.worldStack.length === 0) return false;
    set({
      locked: true,
      worldPhase: 'pushing',
      pendingWorld: {
        frame,
        entryRect: entry?.rect ?? null,
        entrySeed: entry?.seed ?? null,
      },
    });
    return true;
  },

  popWorld: () => {
    const s = get();
    if (s.locked || s.mode !== 'yol' || s.worldPhase !== 'idle') return false;
    const depth = s.worldStack.length - 1;
    if (depth <= 1) return get().requestReturn(); // first world → camera ascent
    set({ locked: true, worldPhase: 'popping', popTargetDepth: depth - 1 });
    return true;
  },

  returnToDepth: (depth) => {
    const s = get();
    if (s.locked || s.mode !== 'yol' || s.worldPhase !== 'idle') return false;
    const top = s.worldStack.length - 1;
    if (depth >= top || depth < 0) return false;
    if (depth === 0) return get().requestReturn(); // straight back to the Line
    set({ locked: true, worldPhase: 'popping', popTargetDepth: depth });
    return true;
  },

  updateTopRestore: (partial) => {
    set((s) => {
      if (s.worldStack.length === 0) return s;
      const stack = [...s.worldStack];
      const top = stack[stack.length - 1];
      stack[stack.length - 1] = {
        ...top,
        frame: { ...top.frame, restore: { ...top.frame.restore, ...partial } } as WorldFrame,
      };
      return { worldStack: stack };
    });
  },

  commitWorldChange: () => {
    set((s) => {
      if (s.worldPhase === 'pushing' && s.pendingWorld) {
        return { worldStack: [...s.worldStack, s.pendingWorld], pendingWorld: null };
      }
      if (s.worldPhase === 'popping' && s.popTargetDepth !== null) {
        return { worldStack: s.worldStack.slice(0, s.popTargetDepth + 1), popTargetDepth: null };
      }
      return s;
    });
  },

  finishWorldChange: () => set({ worldPhase: 'idle', locked: false, pendingWorld: null, popTargetDepth: null }),
}));

/** Live-tunable values, defaults from config.ts. Edited by the debug panel. */
interface TuningState extends Tuning {
  set: (partial: Partial<Tuning>) => void;
  reset: () => void;
}

export const useTuning = create<TuningState>((set) => ({
  ...TUNING_DEFAULTS,
  set: (partial) => set(partial),
  reset: () => set({ ...TUNING_DEFAULTS }),
}));
