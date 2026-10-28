import { Download, FileJson, MonitorPlay, Play } from 'lucide-react';
import { CLIPS } from '../../data/clips';

export function HowItWorks() {
  return (
    <section className="steps" id="how" aria-labelledby="how-title">
      <div className="shell">
        <div className="steps-head" data-reveal>
          <h2 id="how-title" className="h2">
            Play. Inspect.
            <br />
            Take it.
          </h2>
          <p>Three moves, no guesswork. Every clip shows its work.</p>
        </div>

        <div className="steps-grid">
          <article className="step" data-reveal>
            <div className="step-num">
              <span>01 / Browse</span>
              <Play size={14} strokeWidth={1.8} />
            </div>
            <h3>Open the first drop.</h3>
            <p>Every clip is a real 60fps render, not a mockup. Pick one and watch it play.</p>
            <div className="step-visual" aria-hidden="true">
              <div className="step-clips">
                {CLIPS.map((clip) => (
                  <span key={clip.id} className="step-clip">
                    <img src={clip.chip} alt="" width={240} height={240} loading="lazy" />
                  </span>
                ))}
              </div>
            </div>
          </article>

          <article className="step" data-reveal data-delay="1">
            <div className="step-num">
              <span>02 / Inspect</span>
              <FileJson size={14} strokeWidth={1.8} />
            </div>
            <h3>Read the spec.</h3>
            <p>Scrub the video, open the JSON, or switch to the live SVG render. The motion is not a black box.</p>
            <div className="step-visual" aria-hidden="true">
              <div className="spec-visual step-spec">
                <span className="spec-label">garden-demo.json</span>
                <pre>{`{
  "fps": 60,
  "duration": 10000,
  "beats": ["look", "pour", "bloom"]
}`}</pre>
              </div>
            </div>
          </article>

          <article className="step" data-reveal data-delay="2">
            <div className="step-num">
              <span>03 / Take it</span>
              <Download size={14} strokeWidth={1.8} />
            </div>
            <h3>Use the motion.</h3>
            <p>Download the MP4, copy the spec, or take the live component into your build.</p>
            <div className="step-visual" aria-hidden="true">
              <div className="files-visual step-files">
                <span className="file-row">
                  <Play size={12} strokeWidth={1.8} /> garden.mp4 <span className="file-ext">60fps</span>
                </span>
                <span className="file-row">
                  <FileJson size={12} strokeWidth={1.8} /> garden-demo.json <span className="file-ext">spec</span>
                </span>
                <span className="file-row">
                  <MonitorPlay size={12} strokeWidth={1.8} /> live render <span className="file-ext">svg</span>
                </span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
