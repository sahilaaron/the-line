/**
 * The generic world-stack model: the spine of recursive navigation.
 *
 * Every environment the visitor can inhabit is a WorldFrame. The stack
 * grows downward into history (line → historical field → topic → topic →
 * …) with NO depth limit and NO subject-specific frames — a topic opening
 * another topic pushes the same generic frame shape. Each frame OWNS the
 * state needed to restore it exactly (explicit data written before every
 * push, never reconstructed by guesswork), which is what makes return at
 * arbitrary depth non-negotiable and cheap.
 */
import type { TopicKind } from '../domain/worlds';

/** Viewport-relative rect captured from the visual the user entered
 *  through; the pop transition shrinks the world back into it. */
export interface EntryRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LineFrame {
  type: 'line';
  id: 'root-line';
  restore: { anchorIndex: number };
}

export interface YolFrame {
  type: 'yol';
  id: string;
  anchorId: string;
  restore: Record<string, never>;
}

export interface HistoricalFieldFrame {
  type: 'historical-field';
  id: string;
  rangeStart: number;
  rangeEnd: number;
  focusYear: number;
  title: string;
  restore: {
    /** continuous historical time to stand at on return */
    time: number;
    /** the item to re-focus on return (keyboard continuity) */
    focusedItemId: string | null;
  };
}

export interface TopicFrame {
  type: 'topic';
  id: string;
  slug: string;
  topicKind: TopicKind;
  title: string;
  restore: {
    /** continuous chapter position to stand at on return */
    chapterPos: number;
  };
}

export type WorldFrame = LineFrame | YolFrame | HistoricalFieldFrame | TopicFrame;

/** A world frame plus its entry transition geometry (absent on the root
 *  and on the first world, whose entry is the camera descent). */
export interface StackedFrame {
  frame: WorldFrame;
  entryRect: EntryRect | null;
  /** deterministic seed for the shared-element transition plate visual */
  entrySeed: string | null;
}

export type WorldPhase = 'idle' | 'pushing' | 'popping';

/** Human breadcrumb labels, root-first (e.g. Earth / 1769 / Steam Engine). */
export function breadcrumbLabels(stack: StackedFrame[]): string[] {
  return stack.map(({ frame }) => {
    switch (frame.type) {
      case 'line':
        return 'Earth';
      case 'yol':
        return frame.anchorId;
      case 'historical-field':
        return String(frame.focusYear);
      case 'topic':
        return frame.title;
    }
  });
}
