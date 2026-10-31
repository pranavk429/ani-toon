import { ArrowUpRight, Check, Mic } from 'lucide-react';
import { buildChefScene } from '@/creature/examples';
import { SceneFrame } from '@/creature/render';

const BARS = [24, 46, 66, 38, 82, 54, 32, 74, 92, 48, 62, 36, 78, 56, 28, 70, 88, 42, 60, 34, 76, 50, 26, 64];
const SAMPLE_PROMPT =
  'A warm, proud chef with a thick brown mustache for a breakfast brand. He laughs, stirs, and waves.';
const SAMPLE = buildChefScene();

export function VoiceSection() {
  return (
    <section className="voice" id="voice" aria-labelledby="voice-title">
      <div className="shell voice-grid">
        <div className="voice-copy" data-reveal>
          <h2 id="voice-title" className="h2">
            No hands.
            <br />
            No filler.
          </h2>
          <p className="lede">
            Anitoon was directed with Wispr Flow: the briefs, the follow-ups, even the copy on this
            page. The studio has a mic button too. If the browser blocks it, Wispr Flow types into any
            field.
          </p>
          <ul className="voice-list">
            <li>
              <Check size={15} strokeWidth={2.2} />
              One sentence becomes a playable scene.
            </li>
            <li>
              <Check size={15} strokeWidth={2.2} />
              Follow-ups are spoken, not clicked.
            </li>
            <li>
              <Check size={15} strokeWidth={2.2} />
              No account, no upload, no render queue.
            </li>
          </ul>
          <a href="https://www.wemakedevs.org/wispr" target="_blank" rel="noreferrer" className="btn btn-light">
            Read the challenge
            <ArrowUpRight size={16} strokeWidth={1.9} />
          </a>
        </div>

        <div className="voice-card" data-reveal data-delay="1">
          <div className="voice-status">
            <span className="live-dot" aria-hidden="true" />
            Wispr Flow · brief
            <Mic size={13} strokeWidth={1.9} style={{ marginLeft: 'auto' }} />
          </div>
          <div className="waveform" aria-hidden="true">
            {BARS.map((height, index) => (
              <i key={index} style={{ '--h': `${height}%`, '--d': `${index * 52}ms` } as React.CSSProperties} />
            ))}
          </div>
          <p className="voice-transcript">
            “{SAMPLE_PROMPT}”
            <span className="voice-transcript-attr">— the brief, spoken</span>
          </p>
          <div className="voice-result">
            <span className="voice-clip voice-live" style={{ width: 64, height: 64 }}>
              <SceneFrame scene={SAMPLE} t={3000} />
            </span>
            <span>
              <span className="voice-result-name">{SAMPLE.title}</span>
              <span className="voice-result-meta">
                {SAMPLE.score.beats.length} beats · {(SAMPLE.score.duration / 1000).toFixed(1)}s ·{' '}
                {SAMPLE.world.preset}
              </span>
            </span>
            <ArrowUpRight size={16} className="voice-arrow" strokeWidth={1.8} />
          </div>
        </div>
      </div>
    </section>
  );
}
