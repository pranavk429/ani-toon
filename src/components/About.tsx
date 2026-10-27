'use client';

import { ArrowUpRight } from 'lucide-react';
import { useClock } from '../hooks/useClock';
import { SHOWCASE, type Showcase } from '../showcase';
import { Stage } from './Stage';
import { HandInk, SectionTag } from './SectionTag';

const CHANNELS = [
  ['lift', 'squash', 'stretch', 'lean', 'shift', 'yaw', 'head', 'arm L', 'arm R', 'leg L', 'leg R', 'tail'],
  ['ear L', 'ear R', 'gaze X', 'gaze Y', 'lid', 'cheek', 'mouth', 'breath', 'follow-through', 'blinks', 'accents', 'loop'],
];

export function About({ onOpen }: { onOpen: (showcase: Showcase) => void }) {
  const { time } = useClock(9000, true, true, 20);
  const mochi = SHOWCASE[0];

  return (
    <section id="about" className="section" aria-label="About the studio">
      <div className="container">
        <div data-reveal>
          <SectionTag n="02" label="About the studio" />
        </div>

        <div className="about-grid">
          <div data-reveal style={{ '--reveal-delay': '70ms' } as React.CSSProperties}>
            <h2 className="about-head">
              I&apos;m Ani, a{' '}
              <span className="relative inline-block text-accent">
                motion studio
                <HandInk />
              </span>{' '}
              that writes performances in code.
            </h2>
            <p className="about-copy">
              I care how a character feels in motion: the weight of a blink, the delay in a head turn, the way a
              foot stays planted. So the studio writes the performance as data, then renders every frame as vector.
            </p>
            <a href="#process" className="btn-quiet about-link">
              See the motion system
              <ArrowUpRight size={12} />
            </a>
          </div>

          <div className="portrait-wrap" data-reveal="pop" style={{ '--reveal-delay': '140ms' } as React.CSSProperties}>
            <button type="button" className="portrait-card" onClick={() => onOpen(mochi)} aria-label="Open Mochi in the studio">
              <span className="portrait-stage">
                <Stage compiled={mochi.compiled} time={time} />
              </span>
              <span className="portrait-tag">
                that&apos;s Mochi
                <svg width="20" height="18" viewBox="0 0 22 20" fill="none" aria-hidden>
                  <path d="M20 17 C13 16 6 13 3 4" stroke="#4b63ff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 4 L9 6 M3 4 L4 10" stroke="#4b63ff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          </div>
        </div>

        <div className="graph-block" data-reveal style={{ '--reveal-delay': '100ms' } as React.CSSProperties}>
          <div className="graph-eyebrow">
            Motion graph
            <span className="stack-count">60 fps</span>
          </div>
          <div className="graph-card">
            <div className="graph-months">
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month) => (
                <span key={month}>{month}</span>
              ))}
            </div>
            <div className="graph-body">
              <div className="graph-days" aria-hidden>
                <span style={{ gridRow: 2 }}>Mon</span>
                <span style={{ gridRow: 4 }}>Wed</span>
                <span style={{ gridRow: 6 }}>Fri</span>
              </div>
              <div className="graph-grid" aria-hidden>
                {Array.from({ length: 53 }, (_, week) =>
                  Array.from({ length: 7 }, (_, day) => {
                    const wave = (Math.sin(week * 0.61 + day * 1.37) + 1) / 2;
                    const noise = (((week * 7 + day) * 17) % 11) / 11;
                    const score = wave * 0.65 + noise * 0.35;
                    const level = score > 0.82 ? 4 : score > 0.64 ? 3 : score > 0.44 ? 2 : score > 0.24 ? 1 : 0;
                    return <span key={`${week}-${day}`} className="graph-cell" data-level={level} />;
                  }),
                )}
              </div>
            </div>
            <div className="graph-foot">
              <span>1,284 beats written in the last year</span>
              <span className="graph-legend">
                Less
                {[0, 1, 2, 3, 4].map((level) => (
                  <i key={level} className="graph-cell" data-level={level} />
                ))}
                More
              </span>
            </div>
          </div>
        </div>

        <div className="stack-block" data-reveal style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
          <div className="stack-eyebrow">
            Motion stack
            <span className="stack-count">18 channels</span>
          </div>
          <div className="stack-marquee">
            {CHANNELS.map((row, rowIndex) => (
              <div key={rowIndex} className={`stack-row ${rowIndex === 1 ? 'stack-row-rev' : ''}`}>
                {[...row, ...row].map((channel, index) => (
                  <span key={`${channel}-${index}`} className="stack-pill">
                    <svg viewBox="0 0 9 9" aria-hidden>
                      <path d="M4.5 0 5.55 3.45 9 4.5 5.55 5.55 4.5 9 3.45 5.55 0 4.5 3.45 3.45Z" />
                    </svg>
                    {channel}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
