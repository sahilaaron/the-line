import { beforeEach, describe, expect, it } from 'vitest';
import { useExperience } from './store';
import { INDEX_1969, INDEX_2026 } from '@/src/data/anchors';

function reset() {
  useExperience.setState({
    mode: 'line',
    activeIndex: INDEX_2026,
    locked: false,
    notice: null,
    quality: 'high',
  });
}

beforeEach(reset);

describe('descent transitions', () => {
  it('descends only from 1969', () => {
    const s = useExperience.getState();
    expect(s.requestDescent(INDEX_2026)).toBe(false);
    expect(useExperience.getState().mode).toBe('line');
    expect(useExperience.getState().notice).toBeTruthy();

    expect(useExperience.getState().requestDescent(INDEX_1969)).toBe(true);
    expect(useExperience.getState().mode).toBe('descending');
    expect(useExperience.getState().locked).toBe(true);
  });

  it('ignores repeated descent requests while locked (double-click guard)', () => {
    useExperience.getState().requestDescent(INDEX_1969);
    expect(useExperience.getState().requestDescent(INDEX_1969)).toBe(false);
    expect(useExperience.getState().mode).toBe('descending');
  });

  it('completes into yol and unlocks', () => {
    useExperience.getState().requestDescent(INDEX_1969);
    useExperience.getState().commitYol();
    useExperience.getState().finishDescent();
    const s = useExperience.getState();
    expect(s.mode).toBe('yol');
    expect(s.locked).toBe(false);
  });
});

describe('return transitions', () => {
  function enterYol() {
    useExperience.getState().requestDescent(INDEX_1969);
    useExperience.getState().commitYol();
    useExperience.getState().finishDescent();
  }

  it('returns only from yol', () => {
    expect(useExperience.getState().requestReturn()).toBe(false);
    enterYol();
    expect(useExperience.getState().requestReturn()).toBe(true);
    expect(useExperience.getState().mode).toBe('ascending');
  });

  it('restores Line View at the 1969 anchor', () => {
    enterYol();
    useExperience.getState().requestReturn();
    useExperience.getState().commitLine();
    useExperience.getState().finishReturn();
    const s = useExperience.getState();
    expect(s.mode).toBe('line');
    expect(s.locked).toBe(false);
    expect(s.activeIndex).toBe(INDEX_1969);
  });

  it('blocks scroll-mode descents while ascending', () => {
    enterYol();
    useExperience.getState().requestReturn();
    expect(useExperience.getState().requestDescent(INDEX_1969)).toBe(false);
  });
});
