"use client";

/**
 * One MotionRuntime clock per SVG stage.
 *
 * The hook owns the clock; stages and the timeline subscribe to snapshots so a
 * 60 fps animation does not force the whole studio React tree to re-render.
 * Mascot playback intentionally uses MascotStage's built-in sampler and feeds
 * the same display subscribers through `GenerativeStudio`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MotionRuntime } from "@/lib/animation";
import type { MotionDocument, RuntimeSnapshot } from "@/lib/animation/types";

export type AnimationPlaybackOptions = {
  autoplay?: boolean;
  speed?: number;
  loop?: boolean;
  /** Pass the shared media-query result from the studio component. */
  reducedMotion?: boolean;
  respectReducedMotion?: boolean;
};

export type AnimationPlayback = {
  playing: boolean;
  speed: number;
  loop: boolean;
  duration: number;
  reducedMotion: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  restart: () => void;
  seek: (seconds: number) => void;
  setSpeed: (speed: number) => void;
  setLoop: (loop: boolean) => void;
  setHiddenTracks: (ids: Iterable<string>) => void;
  subscribe: (listener: (snapshot: RuntimeSnapshot) => void) => () => void;
  getSnapshot: () => RuntimeSnapshot | null;
};

export type PlaybackListener = (snapshot: RuntimeSnapshot) => void;

/** SSR-safe `prefers-reduced-motion` listener. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return reduced;
}

function documentSignature(document: MotionDocument | null): string {
  if (!document) return "";
  // Full content: revisions may keep the same document id while changing
  // keyframe values or easing. Any change must rebuild the deterministic clock.
  return JSON.stringify(document);
}

export function useAnimationPlayback(
  document: MotionDocument | null,
  options: AnimationPlaybackOptions = {},
): AnimationPlayback {
  const optionsRef = useRef(options);
  const documentRef = useRef(document);
  const reducedRef = useRef(Boolean(options.reducedMotion));

  const runtimeRef = useRef<MotionRuntime | null>(null);
  const listenersRef = useRef<Set<PlaybackListener>>(new Set());
  const hiddenRef = useRef<Set<string>>(new Set());
  const loopRef = useRef(options.loop ?? true);
  const speedRef = useRef(options.speed ?? 1);

  // Keep the effect-scoped copies current without touching refs during render.
  useEffect(() => {
    optionsRef.current = options;
    documentRef.current = document;
    reducedRef.current = Boolean(options.reducedMotion);
  });

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState(options.speed ?? 1);
  const [loop, setLoopState] = useState(options.loop ?? true);
  const [duration, setDuration] = useState(document?.duration ?? 0);
  const reducedMotion = Boolean(options.reducedMotion);

  const emit = useCallback((snapshot: RuntimeSnapshot) => {
    for (const listener of listenersRef.current) {
      listener(snapshot);
    }
  }, []);

  const subscribe = useCallback((listener: PlaybackListener) => {
    listenersRef.current.add(listener);
    const runtime = runtimeRef.current;
    if (runtime) listener(runtime.snapshot());
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const getSnapshot = useCallback((): RuntimeSnapshot | null => {
    return runtimeRef.current?.snapshot() ?? null;
  }, []);

  const signature = useMemo(
    () => documentSignature(document),
    [document],
  );

  // Recreate the clock when the document structure changes. Renaming the
  // document (same id/tracks) must not restart playback.
  useEffect(() => {
    runtimeRef.current = null;
    const nextDocument = documentRef.current;
    if (!nextDocument) {
      setDuration(0);
      setPlaying(false);
      return;
    }

    let runtime: MotionRuntime;
    try {
      runtime = new MotionRuntime(nextDocument, {
        loop: loopRef.current,
        speed: speedRef.current,
        autoplay: false,
        reducedMotion: reducedRef.current,
      });
    } catch {
      setDuration(nextDocument.duration);
      setPlaying(false);
      return;
    }

    runtime.setHiddenTracks(hiddenRef.current);
    runtimeRef.current = runtime;
    setDuration(nextDocument.duration);
    setPlaying(false);
    emit(runtime.snapshot());

    const shouldAutoplay =
      optionsRef.current.autoplay !== false &&
      !(
        optionsRef.current.respectReducedMotion &&
        reducedRef.current
      );

    if (shouldAutoplay) {
      runtime.play();
      setPlaying(true);
      emit(runtime.snapshot());
    }
  }, [signature, emit]);

  // Respect a change to the OS preference while the studio is open.
  useEffect(() => {
    reducedRef.current = reducedMotion;
    if (!reducedMotion || optionsRef.current.respectReducedMotion === false) {
      return;
    }
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.pause();
    runtime.seek(0);
    setPlaying(false);
    emit(runtime.snapshot());
  }, [reducedMotion, emit]);

  // Advance only while playing. Delta is clamped so tab-backgrounding cannot
  // jump the animation forward.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last: number | null = null;

    const tick = (now: number) => {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      const delta = last === null ? 0 : Math.min(100, Math.max(0, now - last));
      last = now;
      const snapshot = runtime.tick(delta);
      emit(snapshot);
      if (!snapshot.playing) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, emit]);

  const play = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const snapshot = runtime.snapshot();
    if (!loopRef.current && snapshot.time >= snapshot.duration - 1e-4) {
      runtime.seek(0);
    }
    runtime.play();
    setPlaying(true);
    emit(runtime.snapshot());
  }, [emit]);

  const pause = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.pause();
    setPlaying(false);
    emit(runtime.snapshot());
  }, [emit]);

  const toggle = useCallback(() => {
    if (playing) {
      pause();
    } else {
      play();
    }
  }, [playing, pause, play]);

  const restart = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.restart();
    runtime.seek(0);
    runtime.play();
    setPlaying(true);
    emit(runtime.snapshot());
  }, [emit]);

  const seek = useCallback(
    (seconds: number) => {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      const current = runtime.snapshot();
      const next = Math.min(
        current.duration,
        Math.max(0, Number.isFinite(seconds) ? seconds : 0),
      );
      runtime.seek(next);
      emit(runtime.snapshot());
    },
    [emit],
  );

  const setSpeed = useCallback((nextSpeed: number) => {
    const safe = Math.max(0.1, Math.min(4, nextSpeed));
    speedRef.current = safe;
    setSpeedState(safe);
    runtimeRef.current?.setSpeed(safe);
  }, []);

  const setLoop = useCallback((nextLoop: boolean) => {
    loopRef.current = nextLoop;
    setLoopState(nextLoop);
    runtimeRef.current?.setLoop(nextLoop);
  }, []);

  const setHiddenTracks = useCallback(
    (ids: Iterable<string>) => {
      const nextHidden = new Set(ids);
      hiddenRef.current = nextHidden;
      const runtime = runtimeRef.current;
      if (!runtime) return;
      const time = runtime.snapshot().time;
      runtime.setHiddenTracks(nextHidden);
      // Re-evaluate at the same timestamp so hidden tracks stop painting now.
      runtime.seek(time);
      emit(runtime.snapshot());
    },
    [emit],
  );

  return {
    playing,
    speed,
    loop,
    duration,
    reducedMotion,
    play,
    pause,
    toggle,
    restart,
    seek,
    setSpeed,
    setLoop,
    setHiddenTracks,
    subscribe,
    getSnapshot,
  };
}
