import Link from 'next/link';

export function AnitoonMark({ size = 32, tone = 'ink' }: { size?: number; tone?: 'ink' | 'paper' }) {
  const bg = tone === 'ink' ? '#141414' : '#ffffff';
  const fg = tone === 'ink' ? '#ffffff' : '#141414';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="mark" style={{ background: bg }}>
      <path d="M12.2 9.4c0-.9 1-1.4 1.7-.9l9.2 6.6c.6.4.6 1.4 0 1.8l-9.2 6.6c-.7.5-1.7 0-1.7-.9V9.4Z" fill={fg} />
      <circle cx="9.1" cy="10.5" r="1.15" fill={fg} opacity="0.42" />
      <circle cx="9.1" cy="21.5" r="1.15" fill={fg} opacity="0.42" />
    </svg>
  );
}

export function BrandLink({ href = '/', tone = 'ink' }: { href?: string; tone?: 'ink' | 'paper' }) {
  return (
    <Link href={href} className="brand" aria-label="Anitoon home">
      <AnitoonMark size={32} tone={tone} />
      <span className="brand-name">Anitoon</span>
    </Link>
  );
}
