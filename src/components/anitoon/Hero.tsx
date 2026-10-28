import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { CLIPS } from '../../data/clips';
import { ClipChip } from './ClipChip';

export function Hero() {
  const [chef, garden, reveal] = CLIPS;

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="shell">
        <h1 id="hero-title" className="display hero-title">
          <span className="hero-line" style={{ '--i': 0 } as React.CSSProperties}>
            Clips that <ClipChip clip={chef} label="Pancake Catch" /> feel
          </span>
          <span className="hero-line" style={{ '--i': 1 } as React.CSSProperties}>
            alive — at <ClipChip clip={garden} label="Garden Bloom" /> sixty
          </span>
          <span className="hero-line" style={{ '--i': 2 } as React.CSSProperties}>
            frames a second. <ClipChip clip={reveal} label="Champion Reveal" />
          </span>
        </h1>

        <p className="hero-sub">
          A small library of 60fps, code-rendered motion clips. Play, scrub, inspect the spec, take the motion.
        </p>

        <div className="hero-actions">
          <a href="#library" className="btn btn-dark">
            Browse the clips
            <ArrowDown size={16} strokeWidth={1.9} />
          </a>
          <button type="button" className="btn btn-light" data-clip="chef">
            Watch a clip
            <ArrowUpRight size={16} strokeWidth={1.9} />
          </button>
        </div>

        <p className="hero-note">
          Built for the Wispr No Hands Challenge · First drop: 3 clips · No account
        </p>
      </div>
    </section>
  );
}
