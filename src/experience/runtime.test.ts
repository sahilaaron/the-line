import { beforeEach, describe, expect, it } from 'vitest';
import {
  destinationStyle,
  localTimeState,
  setLocalTimeline,
  resetRuntime,
  resetThemeFocus,
  setDestinationStyle,
  setThemeLenses,
  themeFocus,
} from './runtime';

beforeEach(() => {
  setThemeLenses(['spaceflight', 'computing', 'signal', 'coldwar']);
  resetRuntime();
});

describe('dynamic theme lenses', () => {
  it('installs the active year lens keys', () => {
    setThemeLenses(['steam', 'knowledge', 'trade', 'labour']);
    expect(Object.keys(themeFocus.target)).toEqual([
      'steam',
      'knowledge',
      'trade',
      'labour',
    ]);
    expect(Object.keys(themeFocus.current)).toEqual(
      Object.keys(themeFocus.target)
    );
    expect(Object.values(themeFocus.target).every((v) => v === 0)).toBe(true);
  });

  it('resets focus values across whatever keys are installed', () => {
    setThemeLenses(['steam', 'labour']);
    themeFocus.target.steam = 1;
    themeFocus.current.steam = 0.7;
    resetThemeFocus();
    expect(themeFocus.target.steam).toBe(0);
    expect(themeFocus.current.steam).toBe(0);
  });
});

describe('destination style', () => {
  it('carries the destination year atmosphere for the shared transition', () => {
    setDestinationStyle({ sky: '#241e17', cloudLo: '#5f5341', cloudHi: '#e0d0b0' });
    expect(destinationStyle.sky).toBe('#241e17');
    expect(destinationStyle.cloudLo).toBe('#5f5341');
    expect(destinationStyle.cloudHi).toBe('#e0d0b0');
  });
});

describe('local timeline runtime', () => {
  it('setLocalTimeline installs count and initial position', () => {
    setLocalTimeline(14, 3);
    expect(localTimeState.count).toBe(14);
    expect(localTimeState.pos).toBe(3);
    expect(localTimeState.target).toBe(3);
    expect(localTimeState.lastInputMs).toBeLessThan(0);
  });

  it('resetRuntime clears the local timeline', () => {
    setLocalTimeline(9, 4);
    localTimeState.target = 7;
    resetRuntime();
    expect(localTimeState.count).toBe(0);
    expect(localTimeState.pos).toBe(0);
    expect(localTimeState.target).toBe(0);
  });
});
