import { ArrowUpRight, Check, Mic } from 'lucide-react';
import { CLIPS } from '../../data/clips';

const BARS = [24, 46, 66, 38, 82, 54, 32, 74, 92, 48, 62, 36, 78, 56, 28, 70, 88, 42, 60, 34, 76, 50, 26, 64];

export function VoiceSection() {
  const chef = CLIPS[0];

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
            The Wispr challenge asked for a build without typing. The clips, the specs and this page were directed with
            Wispr Flow.
          </p>
          <ul className="voice-list">
            <li>
              <Check size={15} strokeWidth={2.2} />
              Briefs dictated, not typed.
            </li>
            <li>
              <Check size={15} strokeWidth={2.2} />
              Fixes spoken into the editor.
            </li>
            <li>
              <Check size={15} strokeWidth={2.2} />
              No account, no upload, no stock.
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
            “Three clips at sixty frames a second. Show the spec. Keep every claim honest. Make it feel premium.”
            <span className="voice-transcript-attr">— the brief, spoken</span>
          </p>
          <div className="voice-result">
            <img className="voice-clip" src={chef.chip} alt="" width={240} height={240} loading="lazy" />
            <span>
              <span className="voice-result-name">First drop</span>
              <span className="voice-result-meta">3 clips · 3 specs · this page</span>
            </span>
            <ArrowUpRight size={16} className="voice-arrow" strokeWidth={1.8} />
          </div>
        </div>
      </div>
    </section>
  );
}
