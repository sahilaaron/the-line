import { beforeEach, describe, expect, it } from 'vitest';
import { useExperience } from './store';
import { INDEX_2026 } from '@/src/data/anchors';
import type { TopicFrame } from './worlds';
import { breadcrumbLabels } from './worlds';

const INDEX_1769 = 2;

function reset() {
  useExperience.setState({
    mode: 'line',
    activeIndex: INDEX_2026,
    originIndex: INDEX_2026,
    locked: false,
    notice: null,
    worldStack: [],
    worldPhase: 'idle',
    pendingWorld: null,
    popTargetDepth: null,
  });
}

function topicFrame(slug: string): TopicFrame {
  return {
    type: 'topic',
    id: `topic-${slug}`,
    slug,
    topicKind: 'invention',
    title: slug,
    restore: { chapterPos: 0 },
  };
}

/** Drive a full world transition the way the controller does. */
function completeWorldChange() {
  useExperience.getState().commitWorldChange();
  useExperience.getState().finishWorldChange();
}

function enterField() {
  const s = useExperience.getState();
  expect(s.requestDescent(INDEX_1769)).toBe(true);
  s.commitYol();
  s.finishDescent();
}

describe('world stack', () => {
  beforeEach(reset);

  it('descending into 1769 seeds [line, historical-field]; 1969 seeds [line, yol]', () => {
    enterField();
    let stack = useExperience.getState().worldStack;
    expect(stack.map((f) => f.frame.type)).toEqual(['line', 'historical-field']);
    expect(stack[0].frame.restore).toEqual({ anchorIndex: INDEX_1769 });
    const field = stack[1].frame;
    if (field.type !== 'historical-field') throw new Error('expected field');
    expect(field.rangeStart).toBe(1760);
    expect(field.rangeEnd).toBe(1780);
    expect(field.restore.time).toBe(1769);

    reset();
    const s = useExperience.getState();
    expect(s.requestDescent(3)).toBe(true); // 1969
    s.commitYol();
    stack = useExperience.getState().worldStack;
    expect(stack.map((f) => f.frame.type)).toEqual(['line', 'yol']);
  });

  it('pushWorld grows the stack generically to arbitrary depth', () => {
    enterField();
    const chain = ['steam-engine', 'james-watt', 'university-of-glasgow', 'scottish-enlightenment'];
    for (const slug of chain) {
      expect(useExperience.getState().pushWorld(topicFrame(slug))).toBe(true);
      expect(useExperience.getState().locked).toBe(true); // transition lock engaged
      completeWorldChange();
      expect(useExperience.getState().locked).toBe(false);
    }
    const stack = useExperience.getState().worldStack;
    expect(stack).toHaveLength(6); // line + field + 4 topics
    expect(stack.at(-1)!.frame.type).toBe('topic');
    expect(breadcrumbLabels(stack)).toEqual([
      'Earth', '1769', 'steam-engine', 'james-watt', 'university-of-glasgow', 'scottish-enlightenment',
    ]);
  });

  it('pushWorld is refused while locked, outside worlds, and mid-transition', () => {
    expect(useExperience.getState().pushWorld(topicFrame('x'))).toBe(false); // line mode
    enterField();
    useExperience.getState().pushWorld(topicFrame('a'));
    // second push while the first is still transitioning must be swallowed
    expect(useExperience.getState().pushWorld(topicFrame('b'))).toBe(false);
    completeWorldChange();
    expect(useExperience.getState().worldStack).toHaveLength(3);
  });

  it('updateTopRestore records restoration data in the TOP frame only', () => {
    enterField();
    useExperience.getState().updateTopRestore({ time: 1766.0, focusedItemId: 'hf-steam-engine' });
    useExperience.getState().pushWorld(topicFrame('steam-engine'));
    completeWorldChange();
    useExperience.getState().updateTopRestore({ chapterPos: 1 });
    const stack = useExperience.getState().worldStack;
    expect(stack[1].frame.restore).toEqual({ time: 1766.0, focusedItemId: 'hf-steam-engine' });
    expect(stack[2].frame.restore).toEqual({ chapterPos: 1 });
  });

  it('popWorld returns exactly one level and preserves the parent frame untouched', () => {
    enterField();
    useExperience.getState().updateTopRestore({ time: 1771.0, focusedItemId: 'hf-boston-tea-party' });
    useExperience.getState().pushWorld(topicFrame('steam-engine'));
    completeWorldChange();
    expect(useExperience.getState().popWorld()).toBe(true);
    expect(useExperience.getState().worldPhase).toBe('popping');
    expect(useExperience.getState().locked).toBe(true);
    completeWorldChange();
    const stack = useExperience.getState().worldStack;
    expect(stack.map((f) => f.frame.type)).toEqual(['line', 'historical-field']);
    expect(stack[1].frame.restore).toEqual({ time: 1771.0, focusedItemId: 'hf-boston-tea-party' });
  });

  it('popWorld at the first world delegates to the camera return and clears on landing', () => {
    enterField();
    expect(useExperience.getState().popWorld()).toBe(true);
    expect(useExperience.getState().mode).toBe('ascending');
    useExperience.getState().commitLine();
    useExperience.getState().finishReturn();
    expect(useExperience.getState().worldStack).toEqual([]);
    expect(useExperience.getState().activeIndex).toBe(INDEX_1769); // exact anchor restored
  });

  it('returnToDepth pops multiple frames in one transition', () => {
    enterField();
    for (const slug of ['a', 'b', 'c']) {
      useExperience.getState().pushWorld(topicFrame(slug));
      completeWorldChange();
    }
    expect(useExperience.getState().worldStack).toHaveLength(5);
    expect(useExperience.getState().returnToDepth(1)).toBe(true); // back to the field
    completeWorldChange();
    const stack = useExperience.getState().worldStack;
    expect(stack.map((f) => f.frame.type)).toEqual(['line', 'historical-field']);
  });

  it('returnToDepth(0) delegates to the camera return', () => {
    enterField();
    useExperience.getState().pushWorld(topicFrame('a'));
    completeWorldChange();
    expect(useExperience.getState().returnToDepth(0)).toBe(true);
    expect(useExperience.getState().mode).toBe('ascending');
  });

  it('entry geometry rides the pushed frame for the pop transition', () => {
    enterField();
    const rect = { x: 100, y: 120, width: 240, height: 180 };
    useExperience.getState().pushWorld(topicFrame('steam-engine'), { rect, seed: 'm-steam' });
    expect(useExperience.getState().pendingWorld?.entryRect).toEqual(rect);
    completeWorldChange();
    expect(useExperience.getState().worldStack.at(-1)!.entryRect).toEqual(rect);
    expect(useExperience.getState().worldStack.at(-1)!.entrySeed).toBe('m-steam');
  });
});
