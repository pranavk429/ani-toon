export function SectionTag({ n, label, center = false }: { n: string; label: string; center?: boolean }) {
  const circles = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i === 0 ? 0 : 20;
    return {
      cx: 32 + Math.cos(a) * r,
      cy: 32 + Math.sin(a) * r,
      r: i === 0 ? 22 : 10.5,
    };
  });

  return (
    <div className="sec-tag" style={center ? { marginInline: 'auto' } : undefined}>
      <span className="sec-seal" aria-hidden>
        <svg viewBox="0 0 64 64">
          {circles.map((c, i) => (
            <circle key={i} cx={c.cx} cy={c.cy} r={c.r} />
          ))}
        </svg>
        <span>{n}</span>
      </span>
      <span className="sec-label">
        {label}
        <HandInk />
      </span>
    </div>
  );
}

export function HandInk({ className = '' }: { className?: string }) {
  return (
    <svg className={`hand-ink ${className}`} viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden>
      <path pathLength={100} d="M2 7 Q28 2.5 54 5 Q78 7 98 3.5" stroke="#4b63ff" strokeWidth="3.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Cone({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 72 92" fill="none" aria-hidden>
      <ellipse cx="36" cy="84" rx="25" ry="5" fill="#2d2820" opacity="0.16" />
      <path d="M36 8 59 78H13Z" fill="#df7d42" stroke="#b95f2d" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M22 57h28M26 43h20M30 30h12" stroke="#f6e7d2" strokeWidth="6" strokeLinecap="round" />
      <path d="M18 77h36" stroke="#c96a34" strokeWidth="5" strokeLinecap="round" />
      <path d="M30 22c2-4 8-4 10 0" stroke="#f8ead6" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
