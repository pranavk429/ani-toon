import type { Palette } from './types';

// Colour helpers: hex in, hex out. No dependencies, safe on the client.

function clamp255(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || !/^[0-9a-f]{6}$/i.test(h)) return [0, 0, 0];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((n) => clamp255(n).toString(16).padStart(2, '0')).join('');
}

export function mix(a: string, b: string, k: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k);
}

export function lighten(hex: string, k: number): string {
  return mix(hex, '#ffffff', k);
}

export function darken(hex: string, k: number): string {
  return mix(hex, '#1b1424', k);
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isLight(hex: string): boolean {
  return luminance(hex) > 0.62;
}

export function readableInk(bg: string): string {
  return isLight(bg) ? '#241a2b' : '#fffdf8';
}

/** Keep a brand colour usable as fur: not too dark, not neon-bright. */
export function asFur(hex: string): string {
  const l = luminance(hex);
  if (l < 0.16) return lighten(hex, 0.28);
  if (l > 0.86) return darken(hex, 0.1);
  return hex;
}

export type BrandColorInput = {
  primary?: string;
  secondary?: string;
  accent?: string;
  /** when the brief only has words: the director passes a palette family */
  family?: 'warm' | 'cool' | 'fresh' | 'bold' | 'soft' | 'mono';
};

const FAMILIES: Record<NonNullable<BrandColorInput['family']>, { primary: string; secondary: string; accent: string }> = {
  warm: { primary: '#C98A5B', secondary: '#3E6B57', accent: '#F2A65A' },
  cool: { primary: '#7C9CCF', secondary: '#2E3A59', accent: '#7BE0D6' },
  fresh: { primary: '#77B96A', secondary: '#2F5D4A', accent: '#F4D35E' },
  bold: { primary: '#F25C54', secondary: '#2B2D42', accent: '#FFD166' },
  soft: { primary: '#E7A9B8', secondary: '#6B5B95', accent: '#F6D6A8' },
  mono: { primary: '#8B8B8B', secondary: '#2B2B2B', accent: '#E8E0D0' },
};

export function makePalette(input: BrandColorInput = {}): Palette {
  const fam = FAMILIES[input.family ?? 'warm'];
  const primary = asFur(input.primary ?? fam.primary);
  const secondary = input.secondary ?? fam.secondary;
  const accent = input.accent ?? fam.accent;

  const fur = primary;
  const furDark = darken(fur, 0.16);
  const furLight = mix(fur, '#fff8ee', 0.58);
  const ink = '#2a2033';
  const outfit = secondary;
  const outfitDark = darken(outfit, 0.18);
  const outfitLight = mix(outfit, '#fff8ee', 0.28);
  const blush = mix(accent, '#ff8fa3', 0.62);

  return {
    fur,
    furDark,
    furLight,
    outfit,
    outfitDark,
    outfitLight,
    accent,
    accentSoft: mix(accent, '#fff8ee', 0.62),
    ink,
    white: '#fffdf8',
    blush,
    bg1: mix(outfit, '#f7f1e6', 0.88),
    bg2: mix(accent, '#f7f1e6', 0.7),
  };
}

export const PALETTE_PRESETS: Record<string, { label: string; input: BrandColorInput }> = {
  ember: { label: 'Ember roast', input: { primary: '#C98A5B', secondary: '#3E6B57', accent: '#F2A65A', family: 'warm' } },
  midnight: { label: 'Midnight mint', input: { primary: '#6F8FD1', secondary: '#242C4A', accent: '#6FE3C4', family: 'cool' } },
  meadow: { label: 'Meadow', input: { primary: '#77B96A', secondary: '#2F5D4A', accent: '#F4D35E', family: 'fresh' } },
  tomato: { label: 'Tomato pop', input: { primary: '#F25C54', secondary: '#2B2D42', accent: '#FFD166', family: 'bold' } },
  rosewater: { label: 'Rosewater', input: { primary: '#E7A9B8', secondary: '#6B5B95', accent: '#F6D6A8', family: 'soft' } },
  oat: { label: 'Oat milk', input: { primary: '#C9B79C', secondary: '#4A4238', accent: '#E9B44C', family: 'mono' } },
};
