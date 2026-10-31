'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { BrandLink } from './Brand';

const LINKS = [
  { href: '/creature', label: 'Studio' },
  { href: '/#briefs', label: 'Starter briefs' },
  { href: '/#how', label: 'How it works' },
  { href: '/#honest', label: 'Under the hood' },
];

export function SiteNav() {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className={`nav${stuck ? ' is-stuck' : ''}`}>
      <div className="shell nav-inner">
        <BrandLink />

        <nav className="nav-links" aria-label="Primary">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="nav-actions">
          <Link href="/#briefs" className="nav-ghost">
            Try a brief
          </Link>
          <Link href="/creature" className="btn btn-dark">
            Direct a person
            <ArrowUpRight size={15} strokeWidth={1.9} />
          </Link>
          <button
            type="button"
            className="nav-burger"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      <div id="mobile-menu" className={`mobile-menu${open ? ' is-open' : ''}`}>
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
            {link.label}
            <ArrowUpRight size={17} strokeWidth={1.8} />
          </Link>
        ))}
        <Link href="/creature" className="btn btn-dark" onClick={() => setOpen(false)}>
          Direct a person
          <ArrowUpRight size={16} strokeWidth={1.9} />
        </Link>
      </div>
    </header>
  );
}
