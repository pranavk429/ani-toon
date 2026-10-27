'use client';

// Hand-drawn punctuation. Everything is inline SVG so it stays crisp and can
// inherit the accent token instead of shipping illustrations.

export function Crown({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 42" className={className} fill="none" aria-hidden>
      <path
        d="M5 34 9 12 21 23 34 4 47 23 59 12 65 34"
        stroke="#4b63ff"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 36.5c14 2.5 43 2.5 55 0" stroke="#4b63ff" strokeWidth="3.2" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

export function Underline({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 340 26" className={className} fill="none" aria-hidden preserveAspectRatio="none">
      <path d="M5 16C72 6 146 5 214 10c44 3 82 8 120 5" stroke="#4b63ff" strokeWidth="5" strokeLinecap="round" />
      <path d="M24 23c63-5 136-6 206-2 35 2 66 4 92 2" stroke="#4b63ff" strokeWidth="2.6" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

export function Sparkle({ className = '', color = '#4b63ff' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M12 1.5c1.4 6.4 4.1 9.1 10.5 10.5C16.1 13.4 13.4 16.1 12 22.5 10.6 16.1 7.9 13.4 1.5 12 7.9 10.6 10.6 7.9 12 1.5Z" fill={color} />
    </svg>
  );
}

export function Star({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path
        d="M32 4 39.6 22.6 59 24.4 44.2 37.2 48.8 56.2 32 46 15.2 56.2 19.8 37.2 5 24.4 24.4 22.6Z"
        fill="#f4c84f"
        stroke="#c9971e"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M24 20c4-2 9-2 12 0" stroke="#fff7d6" strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

export function CoffeeCup({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 116" className={className} aria-hidden>
      <defs>
        <linearGradient id="cup-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.55" stopColor="#f4e6ce" />
          <stop offset="1" stopColor="#e4cfae" />
        </linearGradient>
        <linearGradient id="cup-lid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffdf7" />
          <stop offset="1" stopColor="#e8dcc7" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="108" rx="30" ry="6" fill="#2c2823" opacity="0.14" />
      <path d="M18 40h60l-7 58c-.5 4-3.6 7-7.6 7H32.6c-4 0-7.1-3-7.6-7Z" fill="url(#cup-body)" stroke="#d9c9ae" strokeWidth="1.2" />
      <path d="M21 64h54l-2.5 22c-.5 4-3.6 7-7.6 7H31c-4 0-7-3-7.5-7Z" fill="#3e6b57" />
      <path d="M27 68h42" stroke="#79a88f" strokeWidth="2.4" strokeLinecap="round" opacity="0.7" />
      <ellipse cx="48" cy="40" rx="30" ry="9" fill="url(#cup-lid)" stroke="#d9c9ae" strokeWidth="1.2" />
      <ellipse cx="48" cy="37.5" rx="22" ry="6.2" fill="#6b4b36" />
      <ellipse cx="48" cy="36.8" rx="16" ry="4" fill="#8a6449" />
      <path d="M44 34c4-3 8-1 8 3" stroke="#e9d3b8" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M39 95h18" stroke="#c9b38f" strokeWidth="2.4" strokeLinecap="round" opacity="0.6" />
      <g stroke="#b9ae9d" strokeWidth="3.2" strokeLinecap="round" fill="none" opacity="0.7">
        <path d="M38 24c-4-5 3-8-1-13" />
        <path d="M49 26c-4-5 3-8-1-13" />
        <path d="M60 24c-4-5 3-8-1-13" />
      </g>
    </svg>
  );
}

export function SpeechBubble({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 104 82" className={className} aria-hidden>
      <path d="M12 12h80a8 8 0 0 1 8 8v34a8 8 0 0 1-8 8H50L32 76l3-14H12a8 8 0 0 1-8-8V20a8 8 0 0 1 8-8Z" fill="#fefdf9" stroke="#111" strokeWidth="2.4" strokeLinejoin="round" />
      <text x="52" y="44" textAnchor="middle" fontFamily="var(--ff-hand), cursive" fontSize="20" fontWeight="700" fill="#111" transform="rotate(-2 52 44)">
        hello!
      </text>
    </svg>
  );
}

export function ArrowCurve({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 76" className={className} fill="none" aria-hidden>
      <path d="M8 8c29 6 48 23 48 44 0 7-3 13-8 17" stroke="#111" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M33 61l15 8 4-17" stroke="#111" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LoopArrow({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 88 54" className={className} fill="none" aria-hidden>
      <path d="M8 36c2-18 17-28 35-27 12 .7 21 6 26 14" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M62 12l9 12-14 5" stroke="#111" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Squiggle({ className = '', color = '#111' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 80 20" className={className} fill="none" aria-hidden>
      <path d="M4 12c7-9 14 7 21-1s14 7 21-1 14 7 22 0" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Pin({ color = '#4b63ff' }: { color?: string }) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2" aria-hidden>
      <span className="block h-4 w-4 rounded-full border-2 border-white shadow-[0_4px_8px_rgba(30,25,20,0.3)]" style={{ background: color }} />
      <span className="mx-auto -mt-1 block h-2 w-2 rounded-full bg-black/20 blur-[1px]" />
    </span>
  );
}

export function MicWave({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect x="8.4" y="2.4" width="7.2" height="12" rx="3.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 10.8v1.6a7 7 0 0 0 14 0v-1.6M12 19.4v2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
