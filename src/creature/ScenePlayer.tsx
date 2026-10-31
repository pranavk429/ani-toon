'use client';

import { useEffect, useRef, useState } from 'react';

import { SceneFrame } from './render';
import type { Scene } from './types';

export function ScenePlayer({
  scene,
  showSkeleton = false,
}: {
  scene: Scene;
  showSkeleton?: boolean;
}) {
  const [t, setT] = useState(0);
  const [mounted, setMounted] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      queueMicrotask(() => setT(scene.score.duration * 0.42));
      return;
    }

    queueMicrotask(() => setT(0));
    const start = performance.now();
    const tick = (now: number) => {
      setT((now - start) % scene.score.duration);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf.current);
  }, [scene, mounted]);

  // The server and the hydration pass render the same empty stage. The animated
  // SVG only exists after mount, so float jitter in the transform math cannot
  // produce a hydration mismatch.
  if (!mounted) return <div className="h-full w-full" aria-hidden="true" />;

  return <SceneFrame scene={scene} t={t} showSkeleton={showSkeleton} />;
}
