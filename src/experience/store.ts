import { create } from 'zustand';
import { ANCHORS, INDEX_1969, INDEX_2026 } from '@/src/data/anchors';
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
    if (anchor.id !== '1969') {
      set({
        notice: 'Descent is prototyped for 1969 only — travel there to enter the year.',
      });
      return false;
    }
    set({ mode: 'descending', locked: true, notice: null });
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

  commitLine: () => set({ mode: 'line', activeIndex: INDEX_1969 }),
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
