import type { SceneSpec } from './types';

// A performance is small enough to live in a URL. No account, no database, no
// server: the link *is* the scene. This is the same trick that makes the demo
// work offline on venue Wi-Fi.

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeSpec(spec: SceneSpec): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(spec)));
}

export function decodeSpec(value: string): SceneSpec | null {
  try {
    const bytes = fromBase64Url(value);
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as SceneSpec;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function shareUrlFor(spec: SceneSpec, origin?: string): string {
  const base =
    origin ??
    (typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://anitoon.studio/');
  return `${base}#s=${encodeSpec(spec)}`;
}

export function specFromLocation(): SceneSpec | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const encoded = params.get('s');
  return encoded ? decodeSpec(encoded) : null;
}
