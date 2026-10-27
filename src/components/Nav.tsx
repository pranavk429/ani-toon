'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';

export function AniMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden className="mark">
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
  { id: 'work', href: '#work', label: 'Work' },
  { id: 'about', href: '#about', label: 'About' },
  { id: 'process', href: '#process', label: 'Process' },
  { id: 'contact', href: '#contact', label: 'Contact' },
];

export function Nav({ onOpenStudio }: { onOpenStudio: () => void }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState('work');
  const [hovered, setHovered] = useState<string | null>(null);
  const [ink, setInk] = useState({ left: 5, width: 0 });
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const active = hovered ?? section;

  useEffect(() => {
    const measure = () => {
      const el = linkRefs.current[active];
      if (!el) return;
      setInk({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [active]);

  useEffect(() => {
    const ids = ['work', 'about', 'process', 'contact'];
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => Boolean(node));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setSection(visible[0].target.id);
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.1, 0.25] },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <header className="nav-shell">
      <div className="nav-inner">
        <a href="#top" className="nav-brand" aria-label="Ani, back to top">
          <AniMark size={28} />
          <span>ani</span>
        </a>

        <nav className="nav-center" aria-label="Primary" onMouseLeave={() => setHovered(null)}>
          <span className="nav-ink" aria-hidden style={{ left: ink.left, width: ink.width }} />
          {links.map((link) => (
            <a
              key={link.id}
              ref={(node) => {
                linkRefs.current[link.id] = node;
              }}
              href={link.href}
              className="nav-link"
              data-active={active === link.id}
              onMouseEnter={() => setHovered(link.id)}
              onFocus={() => setHovered(link.id)}
              onBlur={() => setHovered(null)}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button type="button" className="nav-talk" onClick={onOpenStudio}>
            Open studio
          </button>
          <button
            type="button"
            className="nav-hamburger"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="nav-mobile">
          {links.map((link) => (
            <a key={link.id} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
              <span aria-hidden>↗</span>
            </a>
          ))}
          <a
            href="#studio"
            onClick={(event) => {
              event.preventDefault();
              setOpen(false);
              onOpenStudio();
            }}
            className="!mt-1 !justify-center !rounded-2xl !bg-ink !text-paper"
          >
            Open studio <ArrowUpRight size={15} className="text-accent" />
          </a>
        </div>
      )}
    </header>
  );
}
