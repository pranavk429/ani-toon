"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaybackChannel } from "./types";

export type StudioClockOptions = {
  duration: number;
  speed?: number;
  loop?: boolean;
  autoplay?: boolean;
  reducedMotion?: boolean;
};

export type TimeSubscriber = (time: number, duration: number) => void;
export type FrameSubscriber = (time: number) => void;

/**
 * SSR-safe prefers-reduced-motion hook.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    queueMicrotask(() => setReduced(media.matches));

    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  return reduced;
}

/**
 * Authoritative deterministic studio clock.
 * Drives rAF, pause/resume/seek/speed/loop, and subscribers.
 * Only subscribers (like stage frame and timeline playhead) update each frame,
 * preventing expensive root re-renders.
 */
export function useStudioClock(options: StudioClockOptions): PlaybackChannel {
  const duration = Math.max(0.2, options.duration);
  const reducedMotion = Boolean(options.reducedMotion);

  const [playing, setPlaying] = useState(
    options.autoplay && !reducedMotion ? true : false,
  );
  const [speed, setSpeedState] = useState(options.speed ?? 1);
  const [loop, setLoopState] = useState(options.loop ?? true);

  const timeRef = useRef(0);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const loopRef = useRef(loop);
  const durationRef = useRef(duration);
  const rafIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  const timeSubscribers = useRef<Set<TimeSubscriber>>(new Set());
  const frameSubscribers = useRef<Set<FrameSubscriber>>(new Set());

  // Keep refs synchronized
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  useEffect(() => {
    durationRef.current = duration;
    // Notify subscribers of potential duration change
    for (const sub of timeSubscribers.current) {
      sub(timeRef.current, duration);
    }
  }, [duration]);

  const emit = useCallback((t: number) => {
    const curDuration = durationRef.current;
    for (const sub of timeSubscribers.current) {
      sub(t, curDuration);
    }
    for (const sub of frameSubscribers.current) {
      sub(t);
    }
  }, []);

  const seek = useCallback(
    (targetSeconds: number) => {
      const curDuration = durationRef.current;
      const clamped = Math.max(0, Math.min(curDuration, targetSeconds));
      timeRef.current = clamped;
      lastTimestampRef.current = null;
      emit(clamped);
    },
    [emit],
  );

  const play = useCallback(() => {
    if (playingRef.current) return;
    const curDuration = durationRef.current;
    if (timeRef.current >= curDuration) {
      timeRef.current = 0;
      emit(0);
    }
    lastTimestampRef.current = null;
    setPlaying(true);
  }, [emit]);

  const pause = useCallback(() => {
    if (!playingRef.current) return;
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (playingRef.current) {
      pause();
    } else {
      play();
    }
  }, [play, pause]);

  const restart = useCallback(() => {
    seek(0);
  }, [seek]);

  const setSpeed = useCallback((s: number) => {
    const safe = Math.max(0.1, Math.min(4, s));
    setSpeedState(safe);
  }, []);

  const setLoop = useCallback((l: boolean) => {
    setLoopState(l);
  }, []);

  const onToggleLoop = useCallback(() => {
    setLoopState((prev) => !prev);
  }, []);

  // rAF loop
  useEffect(() => {
    if (!playing) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      lastTimestampRef.current = null;
      return;
    }

    const loopStep = (now: number) => {
      if (!playingRef.current) return;

      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = now;
      }

      const deltaMs = now - lastTimestampRef.current;
      lastTimestampRef.current = now;

      // Guard against huge step when tab was backgrounded
      const stepSec = Math.min(0.2, (deltaMs / 1000) * speedRef.current);
      let nextTime = timeRef.current + stepSec;
      const maxDur = durationRef.current;

      if (nextTime >= maxDur) {
        if (loopRef.current) {
          nextTime = nextTime % maxDur;
        } else {
          nextTime = maxDur;
          timeRef.current = nextTime;
          emit(nextTime);
          setPlaying(false);
          return;
        }
      }

      timeRef.current = nextTime;
      emit(nextTime);

      rafIdRef.current = requestAnimationFrame(loopStep);
    };

    rafIdRef.current = requestAnimationFrame(loopStep);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [playing, emit]);

  const subscribeTime = useCallback(
    (listener: (time: number, duration: number) => void) => {
      timeSubscribers.current.add(listener);
      // Immediate call with current values
      listener(timeRef.current, durationRef.current);
      return () => {
        timeSubscribers.current.delete(listener);
      };
    },
    [],
  );

  const subscribeFrame = useCallback((listener: FrameSubscriber) => {
    frameSubscribers.current.add(listener);
    listener(timeRef.current);
    return () => {
      frameSubscribers.current.delete(listener);
    };
  }, []);

  const getTime = useCallback(() => timeRef.current, []);

  return {
    playing,
    speed,
    duration,
    loop,
    reducedMotion,
    onToggle: toggle,
    onRestart: restart,
    onSeek: seek,
    onSpeed: setSpeed,
    onToggleLoop,
    subscribeTime,
    getTime,
    subscribeFrame,
  };
}
