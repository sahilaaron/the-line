'use client';

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { INDEX_1969 } from '@/src/data/anchors';
import { useExperience, useTuning } from '../store';
import {
  descentState,
  motionPref,
  resetYolReveal,
  timeState,
  yolReveal,
} from '../runtime';
import { vhLayout } from '../config';
import { arrivalSchedule } from '../arrival';

/**
 * Owns the descent/return choreography. Reacts to store mode changes (already
 * guarded + locked by the store) and drives the camera, orb flyby, cloud
 * layer, destination signals, scene swap, and the staged arrival reveal with
 * GSAP timelines. The swap happens at the cloud peak so it is never visible.
 *
 * Descent stages: approach → orbs sweep past → Earth overfills the frame →
 * clouds take over → destination signals emerge → clear into the tableau,
 * which then reveals in stages (env → subject → text → themes → line).
 */
export function DescentController() {
  const camera = useThree((s) => s.camera);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const arrivalRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const startArrival = () => {
      const t = useTuning.getState();
      arrivalRef.current?.kill();
      const stages = arrivalSchedule(
        t.arrivalStagger,
        t.arrivalStageDur,
        motionPref.reduced
      );
      const tl = gsap.timeline();
      stages.forEach((st) => {
        tl.to(
          yolReveal,
          { [st.key]: 1, duration: st.duration, ease: 'power2.out' },
          st.start
        );
      });
      arrivalRef.current = tl;
    };

    const startDescent = () => {
      const t = useTuning.getState();
      const { earthY, halfH } = vhLayout(t);
      tlRef.current?.kill();
      arrivalRef.current?.kill();
      resetYolReveal();

      if (motionPref.reduced) {
        // Short atmospheric crossfade, no camera dive, no signal flicker.
        const tl = gsap.timeline({
          onComplete: () => useExperience.getState().finishDescent(),
        });
        tl.to(descentState, { cloud: 1, duration: 0.5, ease: 'power1.in' }, 0);
        tl.add(() => {
          useExperience.getState().commitYol();
          descentState.blend = 1;
          camera.position.set(0, 0, t.cameraDistance);
          startArrival();
        }, 0.55);
        tl.to(descentState, { cloud: 0, duration: 0.6, ease: 'power1.out' }, 0.7);
        tlRef.current = tl;
        return;
      }

      const d = t.descentDuration;
      const tl = gsap.timeline({
        onComplete: () => useExperience.getState().finishDescent(),
      });

      // 1–2: leave the Line; theme spheres and orbit lines sweep past
      tl.to(descentState, {
        orbFly: 1,
        duration: d * 0.4,
        ease: 'power2.in',
      }, 0);
      // 3: dive — Earth expands beyond the viewport
      tl.to(camera.position, {
        z: 2.2,
        y: earthY * 0.62,
        duration: d * 0.5,
        ease: 'power2.in',
      }, 0);
      // 4: clouds take over
      tl.to(descentState, {
        cloud: 1,
        duration: d * 0.32,
        ease: 'power1.in',
      }, d * 0.16);
      // 5: destination signals begin inside the cloud passage
      tl.to(descentState, {
        signals: 1,
        duration: d * 0.3,
        ease: 'power1.inOut',
      }, d * Math.min(0.95, Math.max(0, t.signalsLead)));
      // hidden swap at the cloud peak; re-seat the camera high in the YoL sky
      tl.add(() => {
        useExperience.getState().commitYol();
        descentState.blend = 1;
        camera.position.set(0, halfH * 1.15, t.cameraDistance * 0.55);
        startArrival();
      }, d * 0.5);
      // 6: fall out of the clouds into the tableau
      tl.to(camera.position, {
        y: 0,
        z: t.cameraDistance,
        duration: d * 0.5,
        ease: 'power2.out',
      }, d * 0.5 + 0.001);
      tl.to(descentState, {
        cloud: 0,
        duration: d * 0.45,
        ease: 'power1.out',
      }, d * 0.58);
      // signals persist a moment after the clouds clear, then hand over
      tl.to(descentState, {
        signals: 0,
        duration: d * 0.34,
        ease: 'power1.out',
      }, d * 0.78);

      tlRef.current = tl;
    };

    const startReturn = () => {
      const t = useTuning.getState();
      const { earthY, halfH } = vhLayout(t);
      tlRef.current?.kill();
      arrivalRef.current?.kill();

      const finishOnLine = () => {
        useExperience.getState().commitLine();
        timeState.pos = INDEX_1969;
        timeState.target = INDEX_1969;
        descentState.blend = 0;
        descentState.orbFly = 0;
        descentState.signals = 0;
        resetYolReveal();
      };

      if (motionPref.reduced) {
        const tl = gsap.timeline({
          onComplete: () => useExperience.getState().finishReturn(),
        });
        tl.to(descentState, { cloud: 1, duration: 0.5, ease: 'power1.in' }, 0);
        tl.add(() => {
          finishOnLine();
          camera.position.set(0, 0, t.cameraDistance);
        }, 0.55);
        tl.to(descentState, { cloud: 0, duration: 0.6, ease: 'power1.out' }, 0.7);
        tlRef.current = tl;
        return;
      }

      const d = t.descentDuration * 0.85;
      const tl = gsap.timeline({
        onComplete: () => useExperience.getState().finishReturn(),
      });

      // rise from the tableau into the clouds
      tl.to(camera.position, {
        y: halfH * 1.15,
        z: t.cameraDistance * 0.55,
        duration: d * 0.5,
        ease: 'power2.in',
      }, 0);
      tl.to(descentState, {
        cloud: 1,
        duration: d * 0.32,
        ease: 'power1.in',
      }, d * 0.14);
      // hidden swap: back to the Line world near the Earth, 1969 active
      tl.add(() => {
        finishOnLine();
        camera.position.set(0, earthY * 0.62, 2.2);
      }, d * 0.5);
      tl.to(camera.position, {
        y: 0,
        z: t.cameraDistance,
        duration: d * 0.5,
        ease: 'power2.out',
      }, d * 0.5 + 0.001);
      tl.to(descentState, {
        cloud: 0,
        duration: d * 0.42,
        ease: 'power1.out',
      }, d * 0.55);

      tlRef.current = tl;
    };

    const unsub = useExperience.subscribe((state, prev) => {
      if (state.mode === prev.mode) return;
      if (state.mode === 'descending') startDescent();
      if (state.mode === 'ascending') startReturn();
    });

    return () => {
      unsub();
      tlRef.current?.kill();
      arrivalRef.current?.kill();
    };
  }, [camera]);

  return null;
}
