'use client';

import { Activity, Dna, PenLine, Play } from 'lucide-react';
import { SectionTag } from './SectionTag';

const STEPS = [
  {
    name: 'Brief',
    sub: 'sentence in',
    role: 'A sentence in, a character out.',
    desc:
      'Say the brand, the role, the feeling. Or hold Fn + Space and let Wispr Flow dictate it. The director reads species, mood, prop and personality from the same paragraph.',
    bullets: ['brand + role', 'mood + species', 'voice-first'],
    date: 'no key',
    icon: PenLine,
  },
  {
    name: 'Director',
    sub: 'words → data',
    role: 'Words become a genome and a score.',
    desc:
      'A seed decides proportions, palette, outfit and extras. The same paragraph writes beats, gaze, blinks and accents. Change one word and the acting changes with it.',
    bullets: ['genome', 'motion score', 'deterministic'],
    date: 'local',
    icon: Dna,
  },
  {
    name: 'Compiler',
    sub: 'score → curves',
    role: 'The score becomes channel curves.',
    desc:
      'Key poses are read with a monotone flow, then layered with idle breath, weight shift, follow-through and contact-aware props. Nothing loops from a menu.',
    bullets: ['flow poses', 'follow-through', 'volume-preserving'],
    date: '0 ms',
    icon: Activity,
  },
  {
    name: 'Renderer',
    sub: 'curves → svg',
    role: 'One clock, one pure function, real SVG.',
    desc:
      'Every frame is computed from time and the score. Transparent, crisp, tiny, and interactive. Export the current frame as SVG or the whole character and score as JSON.',
    bullets: ['60 fps', 'transparent', '~10 KB'],
    date: 'browser',
    icon: Play,
  },
];

export function Process() {
  return (
    <section id="process" className="section" aria-label="How it works">
      <div className="container">
        <div data-reveal>
          <SectionTag n="03" label="How it works" />
        </div>
        <h2 className="section-head" data-reveal style={{ '--reveal-delay': '70ms' } as React.CSSProperties}>
          Where a brief becomes
          <br />
          a performance.
        </h2>
        <p className="section-lede" data-reveal style={{ '--reveal-delay': '140ms' } as React.CSSProperties}>
          No timeline. No rigging. No keyframes. Just a director with a point of view.
        </p>

        <ul className="process-list">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.name}
                className="process-row"
                data-reveal
                style={{ '--reveal-delay': `${index * 70}ms` } as React.CSSProperties}
              >
                <div className="process-who">
                  <span className="process-icon">
                    <Icon size={19} strokeWidth={1.8} />
                  </span>
                  <span>
                    <span className="process-name">{step.name}</span>
                    <span className="process-sub">{step.sub}</span>
                  </span>
                </div>
                <div>
                  <h3 className="process-role">{step.role}</h3>
                  <p className="process-desc">{step.desc}</p>
                  <div className="process-bullets">
                    {step.bullets.map((bullet) => (
                      <span key={bullet} className="process-bullet">
                        {bullet}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="process-date">{step.date}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
