export function HonestBand() {
  return (
    <section className="honest" id="honest" aria-labelledby="honest-title">
      <div className="shell">
        <p className="kicker" data-reveal>
          Under the hood
        </p>
        <h2 id="honest-title" className="quote-mark" aria-hidden="true" data-reveal>
          “
        </h2>
        <blockquote className="quote-text" data-reveal data-delay="1">
          No stock footage. No render farm. A director writes a genome and a score; a compiler
          builds the skeleton and performs every frame. The same brief performs the same way every
          time.
        </blockquote>
        <p className="quote-attr" data-reveal data-delay="2">
          Anitoon / the honest version
        </p>

        <div className="honest-stats">
          <article className="honest-stat" data-reveal>
            <span className="honest-num">16</span>
            <h3>bones in every human rig</h3>
            <p>The same skeleton carries every presentation, hair style, outfit and action.</p>
          </article>
          <article className="honest-stat" data-reveal data-delay="1">
            <span className="honest-num">9</span>
            <h3>human actions in the library</h3>
            <p>Wave, point, think, shrug, clap, laugh, dance, bow, run, stretch, yawn, wink.</p>
          </article>
          <article className="honest-stat" data-reveal data-delay="2">
            <span className="honest-num">9</span>
            <h3>flat nature worlds</h3>
            <p>Meadow, forest, sunset, desert, winter, ocean, autumn, rain, sakura.</p>
          </article>
        </div>

        <p className="honest-note" data-reveal>
          The hosted director is Claude Haiku. The offline grammar is the fallback. The compiler
          always runs locally, so the stage works offline.
        </p>
      </div>
    </section>
  );
}
