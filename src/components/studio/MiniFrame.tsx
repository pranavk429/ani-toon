'use client';

import { useMemo } from 'react';
import { compile } from '@/toon/compile';
import { ToonFrame } from '@/toon/ToonScene';
import type { SceneSpec } from '@/toon/types';
import { useHydrated } from './useHydrated';

export function MiniFrame({
  spec,
  at = 0.4,
  animate = false,
}: {
  spec: SceneSpec;
  at?: number;
  animate?: boolean;
}) {
  const compiled = useMemo(() => compile(spec), [spec]);
  // SVG is drawn from trig. Node and the browser disagree in the last float
  // digit, which React reports as a hydration mismatch. Draw after mount so
  // the server never ships a frame the client will immediately replace.
  const ready = useHydrated();

  return (
    <div className={`mini-frame${animate ? ' is-live' : ''}`} aria-hidden="true">
      {ready ? (
        <ToonFrame compiled={compiled} t={compiled.spec.duration * at} />
      ) : (
        <span className="mini-frame-wait" />
      )}
    </div>
  );
}
