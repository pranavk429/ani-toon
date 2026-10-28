import { ArrowDown, ArrowUpRight } from 'lucide-react';

export function FinalCta() {
  return (
    <section className="cta" aria-labelledby="cta-title">
      <div className="shell">
        <h2 id="cta-title" className="h2-lg" data-reveal>
          Take the first drop
          <br />
          for a spin.
        </h2>
        <p data-reveal data-delay="1">
          Three clips. Three specs. One honest little library, built for the Wispr No Hands Challenge.
        </p>
        <div className="cta-actions" data-reveal data-delay="2">
          <a href="#library" className="btn btn-dark">
            Browse the clips
            <ArrowDown size={16} strokeWidth={1.9} />
          </a>
          <button type="button" className="btn btn-light" data-clip="chef">
            Watch a clip
            <ArrowUpRight size={16} strokeWidth={1.9} />
          </button>
        </div>
        <p className="cta-note" data-reveal data-delay="3">
          No account · no uploads · no stock footage
        </p>
      </div>
    </section>
  );
}
