'use client';

import { useEffect, useRef, useState } from 'react';

// One clock for every live mascot. Deterministic time in, pose out.
export function useClock(duration: number, loop = true, autoPlay = true, fps = 60) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [reduced, setReduced] = useState(false);
  const startRef = useRef(0);
  const timeRef = useRef(0);
  const rafRef = useRef(0);
  const frameMs = 1000 / Math.max(12, Math.min(60, fps));

  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      if (mq.matches) {
        setReduced(true);
        setPlaying(false);
        const t = Math.min(1000, duration * 0.15);
        setTime(t);
        startRef.current = performance.now() - t;
      }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [duration]);

  useEffect(() => {
    if (!playing || reduced) return;
    let last = 0;
    startRef.current = performance.now() - timeRef.current;
    const tick = (now: number) => {
      if (now - last < frameMs) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      last = now;
      let t = now - startRef.current;
      if (loop) t = t % duration;
      else if (t >= duration) {
        t = duration;
        setPlaying(false);
      }
      timeRef.current = t;
      setTime(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, reduced, duration, loop, frameMs]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const seek = (t: number) => {
    const next = Math.max(0, Math.min(duration, t));
    timeRef.current = next;
    startRef.current = performance.now() - next;
    setTime(next);
  };

  return {
    time,
    playing,
    setPlaying,
    toggle: () => setPlaying((p) => !p),
    seek,
    reduced,
  };
}
