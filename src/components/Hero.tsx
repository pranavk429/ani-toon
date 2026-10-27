'use client';

import { useClock } from '../hooks/useClock';
import { HERO_MASCOTS, type Showcase } from '../showcase';
import { Stage } from './Stage';
import { AniWordmark } from './AniWordmark';
import { Cone, HandInk } from './SectionTag';

type Props = {
  onPick: (showcase: Showcase) => void;
  onOpenStudio: () => void;
};

const FAN = [
  { angle: '-18deg', y: '6px' },
  { angle: '-4deg', y: '0px' },
  { angle: '4deg', y: '0px' },
  { angle: '18deg', y: '6px' },
];

export function Hero({ onPick, onOpenStudio }: Props) {
  const { time } = useClock(9000, true, true, 30);

  return (
    <section id="top" className="hero">
      <h1 className="sr-only">Ani — mascots that move</h1>

      <div className="rise" style={{ animationDelay: '80ms' }}>
        <AniWordmark />
      </div>

      <p className="hero-note rise" style={{ animationDelay: '260ms' }}>
        hey, I&apos;m Ani, a{' '}
        <button type="button" className="hero-role" onClick={onOpenStudio}>
          mascot studio
          <HandInk />
        </button>{' '}
        from your browser.
        <span className="cone-wrap" aria-hidden>
          <Cone />
        </span>
      </p>

      <div className="hero-fan rise" style={{ animationDelay: '420ms' }} role="list" aria-label="Selected characters">
        {HERO_MASCOTS.map((m, i) => (
          <div key={m.id} className="fan-slot" role="listitem" style={{ '--angle': FAN[i].angle, '--y': FAN[i].y } as React.CSSProperties}>
            <button
              type="button"
              className="fan-card"
              onClick={() => onPick(m)}
              aria-label={`Open ${m.compiled.genome.name} in the studio`}
            >
              <span className="fan-shot">
                <Stage compiled={m.compiled} time={(time + i * 1250) % m.compiled.score.duration} />
              </span>
              <span className="fan-cap">{m.compiled.genome.name}</span>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
