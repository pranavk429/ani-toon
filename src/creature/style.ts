// The shared art direction. Every colour and every shadow in the renderer comes
// from here, so a horse, an octopus and a blob feel like they were drawn by the
// same hand. See docs/ART-STYLE.md for the rules these tokens encode.

import { mix } from '../toon/shapes';
import type { Palette } from './types';

export const ART = {
  cream: '#FBE9C8',
  creamDeep: '#F3DDB4',
  paper: '#FFF8EA',
  ink: '#33253F',
  blush: '#F28C7E',
  eyeWhite: '#FFFFFF',
  sky: '#CFEBF4',
  skyDeep: '#B7DDEA',
  moss: '#7FB06A',
  mossDeep: '#5C9152',
  night: '#242849',
  nightDeep: '#171A35',
  moon: '#F7E7BF',
  // Cel shadow is a dark violet-brown, never black.
  shadow: '#2B1838',
} as const;

export function darken(color: string, k = 0.18): string {
  return mix(color, ART.shadow, k);
}

export function lighten(color: string, k = 0.3): string {
  return mix(color, ART.paper, k);
}

/** The clipped hard shadow for a body mass. */
export function shadowOf(color: string, k = 0.16): string {
  return mix(color, ART.shadow, k);
}

export function clothOf(p: Palette): string {
  return p.cloth ?? p.accent;
}

export function trimOf(p: Palette): string {
  return p.trim ?? p.belly;
}

export function hairOf(p: Palette): string {
  return p.hair ?? p.detail;
}

export function muzzleOf(p: Palette): string {
  return mix(p.skin, '#FFF1DA', 0.28);
}

export function noseOf(p: Palette): string {
  return mix(p.skin, ART.ink, 0.22);
}
