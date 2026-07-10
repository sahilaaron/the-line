import { create } from 'zustand';
import { ANCHORS, INDEX_1969, INDEX_2026 } from '@/src/data/anchors';
import { hasYol, YOL_YEAR_IDS } from '@/src/data/yol';
import {
  TUNING_DEFAULTS,
  type QualityTier,
  type Tuning,
} from './config';

export type Mode = 'line' | 'descending' | 'yol' | 'ascending';

interface ExperienceState {
  mode: Mode;
  /** nearest anchor index (discrete; continuous position lives in runtime.ts) */
  activeIndex: number;
  /** the anchor index a descent started from — the return restores it */
  originIndex: number;
  /** input lock during descent/return transitions */
  locked: boolean;
  notice: string | null;
  quality: QualityTier;

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
}

export const useExperience = create<ExperienceState>((set, get) => ({
  mode: 'line',
  activeIndex: INDEX_2026,
  originIndex: INDEX_1969,
  locked: false,
  notice: null,
  quality: 'high',

  setActiveIndex: (i) => {
    if (get().activeIndex !== i) set({ activeIndex: i });
  },

  requestDescent: (index) => {
    const s = get();
    if (s.locked || s.mode !== 'line') return false;
    const anchor = ANCHORS[index];
    if (!anchor) return false;
    if (!hasYol(anchor.id)) {
      set({
        notice: `Descent is prototyped for ${YOL_YEAR_IDS.join(
          ' and '
        )} — travel there to enter a year.`,
      });
      return false;
    }
    set({
      mode: 'descending',
      locked: true,
      notice: null,
      originIndex: index,
      activeIndex: index,
    });
    return true;
  },

  commitYol: () => set({ mode: 'yol' }),
  finishDescent: () => set({ locked: false }),

  requestReturn: () => {
    const s = get();
    if (s.locked || s.mode !== 'yol') return false;
    set({ mode: 'ascending', locked: true });
    return true;
  },

  /** Return lands on the SAME anchor the descent started from. */
  commitLine: () => set((s) => ({ mode: 'line', activeIndex: s.originIndex })),
  finishReturn: () => set({ locked: false }),

  setNotice: (n) => set({ notice: n }),
  setQuality: (q) => set({ quality: q }),
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
