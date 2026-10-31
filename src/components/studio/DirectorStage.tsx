'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { compile } from '@/toon/compile';
import { ToonFrame } from '@/toon/ToonScene';
import { useDirector } from './DirectorProvider';
import { useHydrated } from './useHydrated';

function clock(ms: number) {
  const seconds = ms / 1000;
  return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
}

export function DirectorStage() {
  const { current } = useDirector();
  const compiled = useMemo(() => compile(current.spec), [current.spec]);
  const duration = compiled.spec.duration;
  const [t, setT] = useState(() => duration * 0.28);
  const [playing, setPlaying] = useState(true);
  const ready = useHydrated();
  const last = useRef(0);

  useEffect(() => {
    // A new scene resets the transport to its opening pose.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setT(compiled.spec.duration * 0.28);
    setPlaying(true);
  }, [compiled]);

  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Media queries are client-only; this runs after hydration on purpose.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlaying(false);
      setT(compiled.spec.duration * 0.46);
      return;
    }
    let raf = 0;
    last.current = performance.now();
    const tick = (now: number) => {
      const delta = now - last.current;
      last.current = now;
      if (document.visibilityState === 'visible') {
        setT((value) => {
          const next = value + delta;
          return next >= compiled.spec.duration ? next % compiled.spec.duration : next;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, compiled]);

  const world = compiled.spec.world.preset;
  const beatMarkers = compiled.spec.beats.map((beat) => ({
    at: beat.at,
    verb: beat.verb,
  }));

  return (
    <div className="stage-wrap">
      <div className="stage-glow" aria-hidden="true" />
      <div className="stage" id="director-stage" role="img" aria-label={compiled.spec.title}>
        {ready ? (
          <ToonFrame compiled={compiled} t={t} />
        ) : (
          <span className="stage-wait" aria-hidden="true" />
        )}
        <div className="stage-hud stage-hud-top">
          <span className="stage-live">
            <i aria-hidden="true" />
            live svg
          </span>
          <span className="stage-world">{world}</span>
        </div>
        <div className="stage-title-card">
          <span className="stage-eyebrow">Now performing</span>
          <strong>{compiled.spec.character.name}</strong>
          <span>{compiled.spec.title.split(' — ')[1] ?? 'original character'}</span>
        </div>
      </div>

      <div className="transport">
        <button
          type="button"
          className="transport-btn"
          onClick={() => {
            setPlaying((value) => !value);
            if (!playing && t >= duration - 80) setT(0);
          }}
          aria-label={playing ? 'Pause performance' : 'Play performance'}
        >
          {playing ? <Pause size={15} strokeWidth={2} /> : <Play size={15} strokeWidth={2} />}
        </button>
        <button
          type="button"
          className="transport-btn transport-ghost"
          onClick={() => {
            setT(0);
            setPlaying(true);
          }}
          aria-label="Restart performance"
        >
          <RotateCcw size={14} strokeWidth={2} />
        </button>
        <span className="transport-time">{clock(t)}</span>
        <div className="transport-track">
          <input
            type="range"
            min={0}
            max={duration}
            step={10}
            value={Math.min(t, duration)}
            onChange={(event) => {
              setPlaying(false);
              setT(Number(event.target.value));
            }}
            aria-label="Scrub the performance"
          />
          <div className="transport-beats" aria-hidden="true">
            {beatMarkers.map((marker, index) => (
              <span
                key={`${marker.verb}-${index}`}
                className="transport-beat"
                style={{ left: `${(marker.at / duration) * 100}%` }}
                title={marker.verb}
              />
            ))}
          </div>
        </div>
        <span className="transport-time transport-time-end">{clock(duration)}</span>
      </div>
    </div>
  );
}
