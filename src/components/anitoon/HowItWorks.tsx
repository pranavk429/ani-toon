import { Download, FileJson, Mic, MonitorPlay } from 'lucide-react';

export function HowItWorks() {
  return (
    <section className="steps" id="how" aria-labelledby="how-title">
      <div className="shell">
        <div className="steps-head" data-reveal>
          <h2 id="how-title" className="h2">
            Brief. Direct.
            <br />
            Perform.
          </h2>
          <p>Three moves, no render farm. Every direction shows its work.</p>
        </div>

        <div className="steps-grid">
          <article className="step" data-reveal>
            <div className="step-num">
              <span>01 / Brief</span>
              <Mic size={14} strokeWidth={1.8} />
            </div>
            <h3>Say it plainly.</h3>
            <p>
              Type it or dictate it with Wispr Flow. The director infers a human genome, a mood, a
              palette, and the actions that matter.
            </p>
            <div className="step-visual" aria-hidden="true">
              <div className="step-prompt">
                <span className="step-prompt-quote">
                  “A warm, proud chef with a thick mustache…”
                </span>
                <span className="step-tokens">
                  <i>body · biped</i>
                  <i>look · short + mustache</i>
                  <i>outfit · apron</i>
                  <i>beats · wave, stir, laugh</i>
                </span>
              </div>
            </div>
          </article>

          <article className="step" data-reveal data-delay="1">
            <div className="step-num">
              <span>02 / Direct</span>
              <FileJson size={14} strokeWidth={1.8} />
            </div>
            <h3>The genome writes itself.</h3>
            <p>
              A human genome, a score, and a cast. Presentation, hair, face, body and outfit are
              data. No pixels are generated yet — only anatomy and intent.
            </p>
            <div className="step-visual" aria-hidden="true">
              <div className="spec-visual step-spec">
                <span className="spec-label">human.genome.json</span>
                <pre>{`{
  "bodyPlan": "biped",
  "name": "Marco",
  "human": "masculine · short · apron",
  "bones": 16,
  "beats": ["wave", "stir", "laugh"],
  "duration": 9600
}`}</pre>
              </div>
            </div>
          </article>

          <article className="step" data-reveal data-delay="2">
            <div className="step-num">
              <span>03 / Perform</span>
              <Download size={14} strokeWidth={1.8} />
            </div>
            <h3>The compiler takes it from there.</h3>
            <p>
              Role-tagged bones, breathing, blinks, waves, points, shrugs, dances, bows, and flat
              world particles. Scrub every frame, share the scene, take the SVG or the JSON.
            </p>
            <div className="step-visual" aria-hidden="true">
              <div className="files-visual step-files">
                <span className="file-row">
                  <MonitorPlay size={12} strokeWidth={1.8} /> scene.svg{' '}
                  <span className="file-ext">vector</span>
                </span>
                <span className="file-row">
                  <FileJson size={12} strokeWidth={1.8} /> scene.json{' '}
                  <span className="file-ext">spec</span>
                </span>
                <span className="file-row">
                  <Download size={12} strokeWidth={1.8} /> share link{' '}
                  <span className="file-ext">url</span>
                </span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
