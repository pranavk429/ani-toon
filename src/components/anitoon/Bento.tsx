import { FileJson, Link2, MonitorPlay } from 'lucide-react';
import { buildMaraScene } from '@/creature/examples';
import { SceneFrame } from '@/creature/render';

const TICKS = Array.from({ length: 31 }, (_, index) => index);
const SAMPLE = buildMaraScene();

export function Bento() {
  return (
    <section className="bento" id="features" aria-labelledby="bento-title">
      <div className="shell">
        <div className="bento-head" data-reveal>
          <h2 id="bento-title" className="h2">
            A whole motion system
            <br />
            in one sentence.
          </h2>
          <p>Not a clip library. A compiler that turns language into performance.</p>
        </div>

        <div className="bento-grid">
          <article className="bento-card" data-reveal>
            <h3>60fps</h3>
            <p>Every frame is solved from pose, not sampled from a video or a GIF.</p>
            <div className="bento-visual" aria-hidden="true">
              <div className="fps-visual">
                <span className="fps-big">
                  60<small>fps</small>
                </span>
                <div className="fps-ticks">
                  {TICKS.map((tick) => (
                    <i key={tick} style={{ height: `${tick % 5 === 0 ? 28 : 12}px` }} />
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article className="bento-card" data-reveal data-delay="1">
            <h3>Frame-accurate</h3>
            <p>Scrub to any moment. One clock runs the whole performance.</p>
            <div className="bento-visual" aria-hidden="true">
              <div className="frame-visual">
                <div className="frame-top">
                  <span>0f</span>
                  <span>30f</span>
                  <span>60f</span>
                </div>
                <div className="frame-track">
                  {TICKS.map((tick) => (
                    <i key={tick} className={tick % 5 === 0 ? 'is-major' : ''} />
                  ))}
                  <span className="frame-playhead" />
                </div>
              </div>
            </div>
          </article>

          <article className="bento-card" data-reveal data-delay="2">
            <h3>Spec included</h3>
            <p>The whole direction is a small JSON object you can read and edit.</p>
            <div className="bento-visual" aria-hidden="true">
              <div className="spec-visual">
                <span className="spec-label">scene.spec.json</span>
                <pre>{`{
  "human": { "presentation": "feminine", "hair": "afro", "top": "coat" },
  "world": { "preset": "meadow" },
  "beats": ["wave", "laugh", "point"],
  "duration": 9600
}`}</pre>
              </div>
            </div>
          </article>

          <article className="bento-card" data-reveal>
            <h3>Live render</h3>
            <p>The same spec draws as SVG in the browser. No video required.</p>
            <div className="bento-visual" aria-hidden="true">
              <div className="live-visual">
                <div className="phone-mini phone-live" style={{ width: 132, height: 132, borderRadius: 22 }}>
                  <SceneFrame scene={SAMPLE} t={3600} />
                </div>
                <span className="live-pill">
                  <i />
                  live SVG
                </span>
              </div>
            </div>
          </article>

          <article className="bento-card" data-reveal data-delay="1">
            <h3>720 × 720</h3>
            <p>A square stage built for feeds, stories and app heroes.</p>
            <div className="bento-visual" aria-hidden="true">
              <div className="ratio-visual ratio-vertical">
                <span>720</span>
                <i />
                <span>720</span>
              </div>
            </div>
          </article>

          <article className="bento-card" data-reveal data-delay="2">
            <h3>Take it out</h3>
            <p>SVG for the animation. JSON for the build. A link for the room.</p>
            <div className="bento-visual" aria-hidden="true">
              <div className="files-visual">
                <span className="file-row">
                  <MonitorPlay size={12} strokeWidth={1.8} /> scene.svg <span className="file-ext">vector</span>
                </span>
                <span className="file-row">
                  <FileJson size={12} strokeWidth={1.8} /> scene.json <span className="file-ext">spec</span>
                </span>
                <span className="file-row">
                  <Link2 size={12} strokeWidth={1.8} /> share link <span className="file-ext">url</span>
                </span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
