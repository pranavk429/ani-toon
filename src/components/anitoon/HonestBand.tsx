export function HonestBand() {
  return (
    <section className="honest" id="honest" aria-labelledby="honest-title">
      <div className="shell">
        <p className="kicker" data-reveal>
          The first drop
        </p>
        <h2 id="honest-title" className="quote-mark" aria-hidden="true" data-reveal>
          “
        </h2>
        <blockquote className="quote-text" data-reveal data-delay="1">
          No stock footage. No 100,000-clip promise. Three clips, rendered at 60fps, with the spec that made each one.
        </blockquote>
        <p className="quote-attr" data-reveal data-delay="2">
          Anitoon / the first drop
        </p>

        <div className="honest-stats">
          <article className="honest-stat" data-reveal>
            <span className="honest-num">3</span>
            <h3>clips, not a catalogue</h3>
            <p>Character, scene and reveal. Curated, not counted.</p>
          </article>
          <article className="honest-stat" data-reveal data-delay="1">
            <span className="honest-num">60</span>
            <h3>frames every second</h3>
            <p>Rendered from one clock, never sampled from a GIF.</p>
          </article>
          <article className="honest-stat" data-reveal data-delay="2">
            <span className="honest-num">0</span>
            <h3>stock footage</h3>
            <p>No borrowed clips. No fake logos. No filler.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
