export function Statement() {
  return (
    <section className="statement" aria-labelledby="statement-title">
      <div className="shell">
        <h2 id="statement-title" className="h2" data-reveal>
          Direction is cheap.
          <br />
          Performance is compiled.
        </h2>
        <p data-reveal data-delay="1">
          The director writes a human genome and a score: presentation, hair, face, body, outfit, a
          palette, and timed beats. The compiler builds the skeleton, owns the physics, and draws
          every frame. That is why the first brief and the thousandth brief both land at 60fps.
        </p>
      </div>
    </section>
  );
}
