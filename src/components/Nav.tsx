'use client';

import { useEffect, useState } from 'react';
import { Menu, X, ArrowUpRight } from 'lucide-react';

export function AniMark({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden>
      <path
        d="M22 3c9.4 0 17 6.8 17 16.2 0 9.8-7.2 18.8-17 18.8S5 29 5 19.2C5 9.8 12.6 3 22 3Z"
        fill="#4b63ff"
      />
      <path d="M22 7.5c7.4 0 13 5 13 12.2 0 8-5.4 14.8-13 14.8S9 27.7 9 19.7C9 12.5 14.6 7.5 22 7.5Z" fill="#6d80ff" />
      <ellipse cx="16.2" cy="19.4" rx="3.5" ry="4.6" fill="#fefdf9" />
      <ellipse cx="27.8" cy="19.4" rx="3.5" ry="4.6" fill="#fefdf9" />
      <circle cx="16.8" cy="20.2" r="1.9" fill="#111" />
      <circle cx="27.2" cy="20.2" r="1.9" fill="#111" />
      <circle cx="16.1" cy="19.3" r="0.7" fill="#fff" />
      <circle cx="26.5" cy="19.3" r="0.7" fill="#fff" />
      <path d="M18.3 27.2c2.4 2 5 2 7.4 0" stroke="#111" strokeWidth="2" strokeLinecap="round" fill="none" />
      <ellipse cx="12.7" cy="25.5" rx="2.2" ry="1.3" fill="#ffb7c8" opacity="0.85" />
      <ellipse cx="31.3" cy="25.5" rx="2.2" ry="1.3" fill="#ffb7c8" opacity="0.85" />
      <path d="M17 8.5c2.7-1.8 8-1.8 10.8.2" stroke="#fefdf9" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

const links = [
  { href: '#studio', label: 'Studio' },
  { href: '#how', label: 'How it works' },
  { href: '#examples', label: 'Examples' },
  { href: '#why', label: 'Why code' },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 bg-gradient-to-b from-paper via-paper/90 to-transparent px-4 pb-5 pt-4 sm:pt-5">
      <div className="mx-auto flex max-w-[1140px] items-center justify-between">
        <a href="#top" className="group flex items-center gap-2.5 rounded-full pr-2" aria-label="Ani home">
          <span className="block transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
            <AniMark size={40} />
          </span>
          <span className="font-display text-[26px] leading-none tracking-tight">Ani</span>
        </a>

        <nav
          className={`absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-line/80 bg-surface px-2 py-2 shadow-[var(--shadow-pill)] backdrop-blur-md transition-all md:flex ${
            scrolled ? 'top-0' : 'top-0'
          }`}
          aria-label="Main"
        >
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 font-hand text-[15px] font-medium text-ink/85 transition hover:bg-paper hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="https://github.com/pranavk429/ani-toon"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted transition hover:text-ink sm:flex"
          >
            GitHub <ArrowUpRight size={13} />
          </a>
          <a
            href="#studio"
            className="hidden items-center gap-2 rounded-full bg-ink px-5 py-3 font-hand text-[15px] font-semibold text-paper shadow-[var(--shadow-pill)] transition hover:-translate-y-0.5 hover:bg-ink-2 sm:flex"
          >
            Open studio
            <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] text-white">→</span>
          </a>
          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="mx-auto mt-3 max-w-[1140px] rounded-3xl border border-line bg-surface p-3 shadow-[var(--shadow-lg)] md:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-2xl px-4 py-3 font-hand text-[17px] hover:bg-paper"
            >
              {l.label}
              <span className="text-muted">↗</span>
            </a>
          ))}
          <a
            href="#studio"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 font-hand text-[16px] font-semibold text-paper"
          >
            Open studio <span className="text-accent">→</span>
          </a>
        </div>
      )}
      </header>
    </>
  );
}
