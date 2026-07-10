'use client';

/**
 * The generic shared-element world transition.
 *
 * Push: a transition plate carrying the SAME deterministic visual as the
 * clicked element expands from its captured viewport rect until it fills
 * the screen; the world swap happens fully covered (the same trick the
 * cloud layer plays for the camera descent, one depth deeper); the plate
 * then dissolves into the new world. The destination's data is awaited
 * before the swap, and the transition lock releases only at the end —
 * "the selected subject becomes the environment", never a modal.
 *
 * Pop reverses it: the plate fades in over the departing world, the stack
 * commits back to the parent (whose frame restores its exact state), and
 * the plate shrinks to the rect the visitor originally entered through.
 *
 * Reduced motion: a short opacity-only cover with identical locking and
 * data-readiness semantics.
 */
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useExperience, useTuning } from '../../store';
import { motionPref, worldTransitionState } from '../../runtime';
import { prefetchWorld } from '../useWorldData';
import { plateStyle } from './PlaceholderPlate';

export function WorldTransition() {
  const plateRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const plate = plateRef.current;
    if (!plate) return;

    const setRect = (r: { x: number; y: number; width: number; height: number }) => {
      plate.style.left = `${r.x}px`;
      plate.style.top = `${r.y}px`;
      plate.style.width = `${r.width}px`;
      plate.style.height = `${r.height}px`;
    };
    const fullRect = () => ({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight });
    const applyProgress = (from: DOMRectLike, to: DOMRectLike, k: number) => {
      setRect({
        x: from.x + (to.x - from.x) * k,
        y: from.y + (to.y - from.y) * k,
        width: from.width + (to.width - from.width) * k,
        height: from.height + (to.height - from.height) * k,
      });
    };
    type DOMRectLike = { x: number; y: number; width: number; height: number };

    const runPush = async () => {
      const s = useExperience.getState();
      const pending = s.pendingWorld;
      if (!pending) return;
      const seed = pending.entrySeed ?? pending.frame.id;
      const from = pending.entryRect ?? {
        x: window.innerWidth * 0.5 - 40,
        y: window.innerHeight * 0.5 - 40,
        width: 80,
        height: 80,
      };
      worldTransitionState.direction = 'push';
      worldTransitionState.rect = from;
      worldTransitionState.seed = seed;

      Object.assign(plate.style, plateStyle(seed));
      plate.style.opacity = '0';
      plate.style.display = 'block';
      setRect(from);

      // the destination must be READY before it becomes the environment
      const ready = prefetchWorld(pending.frame);

      const duration = useTuning.getState().worldTransitionSec;
      if (motionPref.reduced) {
        plate.style.opacity = '1';
        setRect(fullRect());
        await ready;
        useExperience.getState().commitWorldChange();
        await new Promise((r) => setTimeout(r, 120));
        gsap.to(plate, {
          opacity: 0,
          duration: 0.2,
          onComplete: () => {
            plate.style.display = 'none';
            useExperience.getState().finishWorldChange();
          },
        });
        return;
      }

      const state = { k: 0 };
      const to = fullRect();
      tlRef.current?.kill();
      const tl = gsap.timeline();
      tl.to(plate, { opacity: 1, duration: duration * 0.22, ease: 'power1.in' }, 0);
      tl.to(
        state,
        {
          k: 1,
          duration: duration * 0.55,
          ease: 'power3.inOut',
          onUpdate: () => {
            applyProgress(from, to, state.k);
            worldTransitionState.progress = state.k * 0.5;
          },
        },
        0
      );
      // swap fully covered, destination data guaranteed
      tl.add(async () => {
        tl.pause();
        await ready;
        useExperience.getState().commitWorldChange();
        requestAnimationFrame(() => tl.resume());
      }, duration * 0.58);
      tl.to(
        plate,
        {
          opacity: 0,
          duration: duration * 0.4,
          ease: 'power2.out',
          onUpdate: () => {
            worldTransitionState.progress = 0.5 + tl.progress() * 0.5;
          },
          onComplete: () => {
            plate.style.display = 'none';
            worldTransitionState.progress = 0;
            useExperience.getState().finishWorldChange();
          },
        },
        duration * 0.62
      );
      tlRef.current = tl;
    };

    const runPop = () => {
      const s = useExperience.getState();
      const targetDepth = s.popTargetDepth;
      if (targetDepth === null) return;
      // shrink toward the rect the visitor entered the departing branch through
      const branchRoot = s.worldStack[targetDepth + 1];
      const to = branchRoot?.entryRect ?? {
        x: window.innerWidth * 0.5 - 40,
        y: window.innerHeight * 0.5 - 40,
        width: 80,
        height: 80,
      };
      const seed = branchRoot?.entrySeed ?? branchRoot?.frame.id ?? 'pop';
      worldTransitionState.direction = 'pop';
      worldTransitionState.rect = to;
      worldTransitionState.seed = seed;

      Object.assign(plate.style, plateStyle(seed));
      plate.style.display = 'block';
      plate.style.opacity = '0';
      const from = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
      setRect(from);

      const duration = useTuning.getState().worldTransitionSec * 0.9;
      if (motionPref.reduced) {
        plate.style.opacity = '1';
        useExperience.getState().commitWorldChange();
        setTimeout(() => {
          gsap.to(plate, {
            opacity: 0,
            duration: 0.2,
            onComplete: () => {
              plate.style.display = 'none';
              useExperience.getState().finishWorldChange();
            },
          });
        }, 120);
        return;
      }

      const state = { k: 0 };
      tlRef.current?.kill();
      const tl = gsap.timeline();
      tl.to(plate, { opacity: 1, duration: duration * 0.32, ease: 'power1.in' }, 0);
      tl.add(() => {
        // parent restored beneath full cover
        useExperience.getState().commitWorldChange();
      }, duration * 0.36);
      tl.to(
        state,
        {
          k: 1,
          duration: duration * 0.5,
          ease: 'power3.inOut',
          onUpdate: () => applyProgress(from, to, state.k),
        },
        duration * 0.4
      );
      tl.to(
        plate,
        {
          opacity: 0,
          duration: duration * 0.24,
          ease: 'power2.out',
          onComplete: () => {
            plate.style.display = 'none';
            useExperience.getState().finishWorldChange();
          },
        },
        duration * 0.72
      );
      tlRef.current = tl;
    };

    const unsub = useExperience.subscribe((state, prev) => {
      if (state.worldPhase === prev.worldPhase) return;
      if (state.worldPhase === 'pushing') void runPush();
      if (state.worldPhase === 'popping') runPop();
    });
    return () => {
      unsub();
      tlRef.current?.kill();
    };
  }, []);

  return <div ref={plateRef} className="wx-plate" aria-hidden />;
}
