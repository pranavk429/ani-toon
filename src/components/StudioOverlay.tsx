'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { AniMark } from './Nav';

export function StudioOverlay({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="studio-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Ani studio"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="studio-sheet">
        <div className="studio-bar">
          <span className="studio-bar-brand">
            <AniMark size={24} />
            ani studio
          </span>
          <button ref={closeRef} type="button" className="studio-close" onClick={onClose}>
            <X size={13} />
            Esc to close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
