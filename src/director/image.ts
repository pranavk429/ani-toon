'use client';

import type { SpeciesKey } from '../mascot/genome';
import { speciesFromText } from '../mascot/genome';
import { rgbToHex } from '../mascot/palette';
import type { ImageSignal } from './index';

// Client-side image reading: no upload, no key, no network. We look at the
// actual pixels for palette, temperature and chroma, then let the director make
// an original vector creature from that signal. It is an interpretation, never
// a trace of the source image.

type Bucket = { r: number; g: number; b: number; n: number };

export async function analyzeImage(file: File): Promise<ImageSignal> {
  const bitmap = await loadBitmap(file);
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.drawImage(bitmap, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const buckets = new Map<number, Bucket>();
  let br = 0;
  let bg = 0;
  let bb = 0;
  let count = 0;
  let satSum = 0;
  let warmSum = 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 180) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    // Ignore the paper/background: near-white, low-chroma pixels.
    const isPaper = lum > 0.9 && sat < 0.16;
    const isVoid = lum < 0.06;
    if (isPaper || isVoid) continue;

    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n += 1;
    buckets.set(key, bucket);

    br += r;
    bg += g;
    bb += b;
    count += 1;
    satSum += sat;
    warmSum += (r - b) / 255;
  }

  if (!count) {
    // A blank/transparent image still yields a usable, neutral creature.
    return {
      colors: ['#B9B3A7', '#4B63FF', '#F3E7D3'],
      brightness: 0.6,
      saturation: 0.1,
      warmth: 0,
      aspect: bitmap.width / bitmap.height,
      filename: file.name,
      species: 'robot',
    };
  }

  const ranked = [...buckets.values()]
    .map((b) => {
      const max = Math.max(b.r, b.g, b.b) / b.n;
      const min = Math.min(b.r, b.g, b.b) / b.n;
      const sat = max === 0 ? 0 : (max - min) / max;
      const lum = (0.2126 * (b.r / b.n) + 0.7152 * (b.g / b.n) + 0.0722 * (b.b / b.n)) / 255;
      return { ...b, sat, lum, score: b.n * (0.45 + sat) * (lum > 0.94 ? 0.2 : 1) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const colors = dedupe(
    ranked.map((b) => rgbToHex(b.r / b.n, b.g / b.n, b.b / b.n)),
  ).slice(0, 4);
  while (colors.length < 3) colors.push(['#E8B7C0', '#4B63FF', '#F3E7D3'][colors.length]);

  const saturation = satSum / count;
  const warmth = warmSum / count;
  const brightness = (0.2126 * (br / count) + 0.7152 * (bg / count) + 0.0722 * (bb / count)) / 255;
  const species = suggestSpecies(colors[0], saturation, file.name);

  return {
    colors,
    brightness,
    saturation,
    warmth,
    aspect: bitmap.width / bitmap.height,
    filename: file.name,
    species,
  };
}

function loadBitmap(file: File): Promise<ImageBitmap> {
  if ('createImageBitmap' in window) return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      createImageBitmap(canvas).then(resolve, reject);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    img.src = url;
  });
}

function dedupe(colors: string[]): string[] {
  const out: string[] = [];
  for (const c of colors) {
    if (!out.some((x) => distance(x, c) < 28)) out.push(c);
  }
  return out;
}

function distance(a: string, b: string): number {
  const pa = hex(a);
  const pb = hex(b);
  return Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
}

function hex(c: string): [number, number, number] {
  const s = c.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

function hueOf(hexColor: string): number {
  const [r, g, b] = hex(hexColor).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function suggestSpecies(primary: string, saturation: number, filename: string): SpeciesKey {
  const named = speciesFromText(filename);
  if (named.explicit) return named.key;
  if (saturation < 0.1) return 'robot';
  const h = hueOf(primary);
  if (h < 16 || h >= 345) return 'fox';
  if (h < 42) return 'fox';
  if (h < 62) return 'cup';
  if (h < 95) return 'bunny';
  if (h < 165) return 'frog';
  if (h < 195) return 'blob';
  if (h < 235) return 'robot';
  if (h < 265) return 'otter';
  if (h < 310) return 'owl';
  if (h < 345) return 'axolotl';
  return 'bear';
}
