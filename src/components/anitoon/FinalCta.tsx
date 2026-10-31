import { ArrowUpRight } from 'lucide-react';

export function FinalCta() {
  return (
    <section className="cta" aria-labelledby="cta-title">
      <div className="shell">
        <h2 id="cta-title" className="h2-lg" data-reveal>
          Give it a sentence.
        </h2>
        <p data-reveal data-delay="1">
          One brief. One spec. One performance you can scrub, share and ship. Built for the Wispr No
          Hands Challenge.
        </p>
        <div className="cta-actions" data-reveal data-delay="2">
          <a href="/creature" className="btn btn-dark">
            Open the compiler
            <ArrowUpRight size={16} strokeWidth={1.9} />
          </a>
          <a href="#briefs" className="btn btn-light">
            Browse starter briefs
            <ArrowUpRight size={16} strokeWidth={1.9} />
          </a>
        </div>
        <p className="cta-note" data-reveal data-delay="3">
          No account · no uploads · no stock footage
        </p>
      </div>
    </section>
  );
}
