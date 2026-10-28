import { FileJson, MonitorPlay, Play } from 'lucide-react';
import { CLIPS } from '../../data/clips';

const TICKS = Array.from({ length: 31 }, (_, index) => index);

export function Bento() {
  const chef = CLIPS[0];
  const garden = CLIPS[1];

  return (
    <section className="bento" id="features" aria-labelledby="bento-title">
      <div className="shell">
        <div className="bento-head" data-reveal>
          <h2 id="bento-title" className="h2">
            One library for all
            <br />
            your motion needs.
          </h2>
          <p>Character, scene and reveal. The first drop, in one place.</p>
        </div>

        <div className="bento-grid">
          <article className="bento-card" data-reveal>
            <h3>60fps</h3>
            <p>Every frame is rendered, not interpolated from a GIF.</p>
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
            <p>Scrub to the frame that matters. Every clip is on one clock.</p>
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
            <p>The JSON that made the clip is part of the clip.</p>
            <div className="bento-visual" aria-hidden="true">
              <div className="spec-visual">
                <span className="spec-label">chef-demo.json</span>
                <pre>{`{
  "fps": 60,
  "duration": 9600,
  "beats": ["look", "toss", "hat-catch"]
}`}</pre>
              </div>
            </div>
          </article>

          <article className="bento-card" data-reveal>
            <h3>Live render</h3>
            <p>The same spec runs as live SVG. No video required.</p>
            <div className="bento-visual" aria-hidden="true">
              <div className="live-visual">
                <div className="phone-mini">
                  <img src={garden.poster} alt="" width={720} height={720} loading="lazy" />
                </div>
                <span className="live-pill">
                  <i />
                  live SVG
                </span>
              </div>
            </div>
          </article>

          <article className="bento-card" data-reveal data-delay="1">
            <h3>1080 × 1080</h3>
            <p>A square stage for feeds, product pages and app heroes.</p>
            <div className="bento-visual" aria-hidden="true">
              <div className="ratio-visual">
                <span>1080</span>
                <i />
                <span>1080</span>
              </div>
            </div>
          </article>

          <article className="bento-card" data-reveal data-delay="2">
            <h3>Take it out</h3>
            <p>MP4 for the feed. JSON for the build. Live SVG for the app.</p>
            <div className="bento-visual" aria-hidden="true">
              <div className="files-visual">
                <span className="file-row">
                  <Play size={12} strokeWidth={1.8} /> {chef.id}.mp4 <span className="file-ext">60fps</span>
                </span>
                <span className="file-row">
                  <FileJson size={12} strokeWidth={1.8} /> {chef.id}-demo.json <span className="file-ext">spec</span>
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
