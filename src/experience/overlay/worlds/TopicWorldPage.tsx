'use client';

/**
 * The generic Topic World renderer: ONE component for every topic kind
 * (invention / person / organisation / intellectual-movement), driven
 * entirely by the TopicWorldVM and its data-driven identity tokens.
 *
 * Movement: continuous horizontal travel through near-full-viewport
 * chapters with adjacent material peeking at the edges, gentle idle
 * snapping, ←/→ stepping and touch drag — spatial and editorial, never a
 * card carousel and never a route change. Doorways into further Topic
 * Worlds are ordinary chapter content pushed through the SAME generic
 * world stack.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TopicChapterVM, TopicIdentity } from '@/src/domain/worlds';
import { useExperience, useTuning } from '../../store';
import { motionPref, setTopicChapters, topicScrollState } from '../../runtime';
import { approach } from '../../time';
import type { TopicFrame } from '../../worlds';
import { useTopicVM } from '../useWorldData';
import { PlaceholderPlate } from './PlaceholderPlate';

function identityVars(identity: TopicIdentity): Record<string, string> {
  return {
    '--tw-bg': identity.background,
    '--tw-fg': identity.foreground,
    '--tw-muted': identity.muted,
    '--tw-accent': identity.accent,
    '--tw-accent-2': identity.secondaryAccent ?? identity.accent,
    '--tw-surface': identity.surface,
  };
}

export function TopicWorldPage({ frame }: { frame: TopicFrame }) {
  const { vm, status } = useTopicVM(frame.slug);
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeChapter, setActiveChapter] = useState(Math.round(frame.restore.chapterPos));
  const activeRef = useRef(activeChapter);

  // install the chapter axis; restore.chapterPos IS the exact position
  useEffect(() => {
    if (!vm) return;
    setTopicChapters(vm.chapters.length, frame.restore.chapterPos);
    setActiveChapter(Math.round(frame.restore.chapterPos));
    activeRef.current = Math.round(frame.restore.chapterPos);
  }, [vm, frame.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // per-frame: ease/snap the chapter position, translate the track
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (topicScrollState.count === 0) return;
      const t = useTuning.getState();

      const idle = now - topicScrollState.lastInputMs;
      if (idle > t.topicSnapDelayMs) {
        const snap = Math.round(topicScrollState.target);
        topicScrollState.target = approach(topicScrollState.target, snap, t.topicSnapStrength, dt);
        if (Math.abs(topicScrollState.target - snap) < 0.0008) topicScrollState.target = snap;
      }
      topicScrollState.pos = motionPref.reduced
        ? topicScrollState.target
        : approach(topicScrollState.pos, topicScrollState.target, 9, dt);
      const pos = topicScrollState.pos;

      const track = trackRef.current;
      if (track) {
        const w = t.topicChapterVw;
        track.style.transform = `translateX(calc(${((100 - w) / 2).toFixed(2)}vw - ${(pos * w).toFixed(3)}vw))`;
        const chapters = track.children;
        for (let i = 0; i < chapters.length; i++) {
          const el = chapters[i] as HTMLElement;
          const d = Math.abs(i - pos);
          el.style.opacity = String(Math.max(0.28, 1 - d * 0.55));
          el.style.transform = motionPref.reduced ? '' : `scale(${(1 - Math.min(0.05, d * 0.04)).toFixed(3)})`;
        }
      }

      const nearest = Math.min(topicScrollState.count - 1, Math.max(0, Math.round(pos)));
      if (nearest !== activeRef.current) {
        activeRef.current = nearest;
        setActiveChapter(nearest);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // touch/pointer drag (narrow layouts and dragging mice)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let dragging = false;
    let lastX = 0;
    const down = (e: PointerEvent) => {
      if (useExperience.getState().locked) return;
      if ((e.target as HTMLElement).closest('button')) return;
      dragging = true;
      lastX = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (!dragging || topicScrollState.count === 0) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      const unitPx = (window.innerWidth * useTuning.getState().topicChapterVw) / 100;
      topicScrollState.target = Math.min(
        topicScrollState.count - 1,
        Math.max(0, topicScrollState.target - dx / unitPx)
      );
      topicScrollState.lastInputMs = performance.now();
    };
    const up = () => {
      dragging = false;
    };
    root.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      root.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  const vars = useMemo(() => (vm ? identityVars(vm.identity) : {}), [vm]);

  if (!vm) {
    return (
      <div className="tw-root tw-loading" data-testid={`topic-world-${frame.slug}`}>
        {status === 'error' ? <p className="tw-note">This subject is not available yet.</p> : null}
      </div>
    );
  }

  const openRelated = (chapter: TopicChapterVM, el: HTMLElement) => {
    const s = useExperience.getState();
    if (s.locked || !chapter.relatedTopicSlug) return;
    const related = vm.relatedTopics.find((r) => r.slug === chapter.relatedTopicSlug);
    const rect = el.getBoundingClientRect();
    s.updateTopRestore({ chapterPos: topicScrollState.pos });
    s.pushWorld(
      {
        type: 'topic',
        id: `topic-${chapter.relatedTopicSlug}-${s.worldStack.length}`,
        slug: chapter.relatedTopicSlug,
        topicKind: related?.kind ?? 'invention',
        title: chapter.relatedTopicTitle ?? related?.title ?? chapter.relatedTopicSlug,
        restore: { chapterPos: 0 },
      },
      {
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        seed: chapter.media[0]?.id ?? chapter.id,
      }
    );
  };

  return (
    <div
      ref={rootRef}
      className={`tw-root atmosphere-${vm.identity.atmosphere} type-${vm.identity.typeTreatment} motion-${vm.identity.motionCharacter}`}
      data-testid={`topic-world-${frame.slug}`}
      data-kind={vm.kind}
      data-chapter={activeChapter}
      style={vars as React.CSSProperties}
    >
      <header className="tw-mast">
        <span className="tw-kicker">{vm.kind.replace('-', ' ')}</span>
        <h2 className="tw-title">{vm.title}</h2>
        {vm.supportingLine && <p className="tw-support">{vm.supportingLine}</p>}
        {vm.dateLabel && <span className="tw-date">{vm.dateLabel}</span>}
      </header>

      <div ref={trackRef} className="tw-track">
        {vm.chapters.map((chapter, i) => {
          const media = chapter.media[0];
          return (
            <section
              key={chapter.id}
              className="tw-chapter"
              data-idx={i}
              aria-hidden={i !== activeChapter}
            >
              {media && (
                <PlaceholderPlate seed={media.id} kind={vm.kind} aspectRatio={media.aspectRatio} />
              )}
              <div className="tw-chapter-body">
                <span className="tw-chapter-no">
                  {String(i + 1).padStart(2, '0')} / {String(vm.chapters.length).padStart(2, '0')}
                </span>
                <h3 className="tw-chapter-title">{chapter.title}</h3>
                <p className="tw-chapter-text">{chapter.body}</p>
                {chapter.relatedTopicSlug && (
                  <button
                    className="tw-doorway"
                    data-testid={`topic-link-${chapter.relatedTopicSlug}`}
                    onClick={(e) => openRelated(chapter, e.currentTarget)}
                  >
                    <span className="tw-doorway-kicker">Enter</span>
                    {chapter.relatedTopicTitle ?? chapter.relatedTopicSlug}
                    <span aria-hidden> →</span>
                  </button>
                )}
                <span className="tw-provenance">provisional · placeholder chapter</span>
              </div>
            </section>
          );
        })}
      </div>

      <p className="tw-note">
        Provisional world — placeholder media and unresearched copy; never the
        final record.
      </p>
    </div>
  );
}
