import { beforeEach, describe, expect, it } from 'vitest';
import { useExperience } from './store';
import { ANCHORS, INDEX_1969, INDEX_2026 } from '@/src/data/anchors';

const INDEX_1769 = ANCHORS.findIndex((a) => a.id === '1769');
const INDEX_1450 = ANCHORS.findIndex((a) => a.id === '1450');

function reset() {
  useExperience.setState({
    mode: 'line',
    activeIndex: INDEX_2026,
    originIndex: INDEX_1969,
    locked: false,
    notice: null,
    quality: 'high',
  });
}

beforeEach(reset);

describe('descent transitions', () => {
  it('descends from years with YoL content (1969 and 1769) only', () => {
    const s = useExperience.getState();
    expect(s.requestDescent(INDEX_2026)).toBe(false);
    expect(useExperience.getState().mode).toBe('line');
    expect(useExperience.getState().notice).toBeTruthy();

    expect(useExperience.getState().requestDescent(INDEX_1450)).toBe(false);
    expect(useExperience.getState().mode).toBe('line');

    expect(useExperience.getState().requestDescent(INDEX_1969)).toBe(true);
    expect(useExperience.getState().mode).toBe('descending');
    expect(useExperience.getState().locked).toBe(true);
  });

  it('descends into 1769', () => {
    expect(useExperience.getState().requestDescent(INDEX_1769)).toBe(true);
    const s = useExperience.getState();
    expect(s.mode).toBe('descending');
    expect(s.originIndex).toBe(INDEX_1769);
    expect(s.activeIndex).toBe(INDEX_1769);
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
  function enterYol(index: number) {
    useExperience.getState().requestDescent(index);
    useExperience.getState().commitYol();
    useExperience.getState().finishDescent();
  }

  it('returns to the Line only from yol', () => {
    expect(useExperience.getState().requestReturn()).toBe(false);
    enterYol(INDEX_1969);
    expect(useExperience.getState().requestReturn()).toBe(true);
    expect(useExperience.getState().mode).toBe('ascending');
    expect(useExperience.getState().locked).toBe(true);
  });

  it('lands on the same anchor the descent started from (1969)', () => {
    enterYol(INDEX_1969);
    useExperience.getState().requestReturn();
    useExperience.getState().commitLine();
    useExperience.getState().finishReturn();
    const s = useExperience.getState();
    expect(s.mode).toBe('line');
    expect(s.activeIndex).toBe(INDEX_1969);
    expect(s.locked).toBe(false);
  });

  it('lands on the same anchor the descent started from (1769)', () => {
    enterYol(INDEX_1769);
    useExperience.getState().requestReturn();
    useExperience.getState().commitLine();
    useExperience.getState().finishReturn();
    const s = useExperience.getState();
    expect(s.mode).toBe('line');
    expect(s.activeIndex).toBe(INDEX_1769);
  });

  it('ignores return requests while locked', () => {
    enterYol(INDEX_1969);
    useExperience.getState().requestReturn();
    expect(useExperience.getState().requestReturn()).toBe(false);
  });
});
