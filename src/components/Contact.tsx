'use client';

import { ArrowUpRight, BookOpen, GitBranch, Mic } from 'lucide-react';
import { SectionTag } from './SectionTag';

const SOCIALS = [
  {
    label: 'GitHub',
    href: 'https://github.com/pranavk429/ani-toon',
    icon: <GitBranch size={19} strokeWidth={1.8} />,
  },
  {
    label: 'X',
    href: 'https://x.com/',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.3l7.3-8.3L2.8 2h6.5l4.4 5.8L18.9 2Zm-1.1 18h1.7L8.3 3.9H6.5L17.8 20Z" />
      </svg>
    ),
  },
  {
    label: 'Wispr',
    href: 'https://wisprflow.ai/',
    icon: <Mic size={19} strokeWidth={1.8} />,
  },
  {
    label: 'Notes',
    href: '#process',
    icon: <BookOpen size={19} strokeWidth={1.8} />,
  },
];

export function Contact({ onOpenStudio }: { onOpenStudio: () => void }) {
  return (
    <section id="contact" className="contact" aria-label="Start a character">
      <div className="contact-inner">
        <div data-reveal>
          <SectionTag n="04" label="Let's connect" center />
        </div>
        <h2 className="contact-head" data-reveal style={{ '--reveal-delay': '70ms' } as React.CSSProperties}>
          Let&apos;s make a character
          <br />
          people remember.
        </h2>
        <button
          type="button"
          className="btn-dark contact-cta"
          onClick={onOpenStudio}
          data-reveal
          style={{ '--reveal-delay': '140ms' } as React.CSSProperties}
        >
          Start with a sentence
          <ArrowUpRight size={15} className="text-accent" />
        </button>

        <div className="contact-socials" data-reveal style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
          {SOCIALS.map((social) => (
            <a
              key={social.label}
              href={social.href}
              className="social"
              target={social.href.startsWith('#') ? undefined : '_blank'}
              rel={social.href.startsWith('#') ? undefined : 'noreferrer'}
            >
              <span className="social-tile">{social.icon}</span>
              <span className="social-label">{social.label}</span>
            </a>
          ))}
        </div>

        <span className="thanks-sticker" data-reveal="pop" style={{ '--reveal-delay': '260ms' } as React.CSSProperties}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
            <circle cx="10" cy="10" r="8.2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M6.4 8.2h.01M13.6 8.2h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M6.8 12.1c1.7 1.7 4.7 1.7 6.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Thanks for scrolling!
        </span>

        <div className="contact-foot" data-reveal style={{ '--reveal-delay': '320ms' } as React.CSSProperties}>
          <span>© 2026 Ani · a no-code mascot studio</span>
          <span>Built for WeMakeDevs × Wispr Flow · Track 02 · No templates. Original characters only.</span>
        </div>
      </div>
    </section>
  );
}
