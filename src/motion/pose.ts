import type { CompiledScore, Pose } from '../mascot/types';
import { clamp, flow, seeded, track, wave } from './engine';

// Layering is what makes a character feel alive rather than keyframed:
//   acting tracks  ->  follow-through (delay)  ->  idle breath/sway  ->  face.
// Every layer is a pure function of one clock, so scrubbing is exact.

export type PoseOptions = {
  /** turn off ambient idle for an export pose or reduced motion */
  idle?: boolean;
  reducedMotion?: boolean;
};

export function computePose(compiled: CompiledScore, time: number, opts: PoseOptions = {}): Pose {
  const { tracks, face, idle, personality, score } = compiled;
  const duration = score.duration;
  const t = clamp(time, 0, duration);
  const useIdle = opts.idle !== false && !opts.reducedMotion;
  const calm = personality.calm;

  // Acting layer. Secondary parts lag by a few frames: ears, forearms and tail
  // arrive after the body, which reads as weight rather than stiffness.
  const at = (ch: keyof CompiledScore['tracks'], delay = 0) => flow(t - delay, tracks[ch]);

  let lift = at('lift');
  let sx = at('sx');
  let sy = at('sy');
  let lean = at('lean');
  let shift = at('shift');
  let yaw = at('yaw');
  let head = at('head');
  const armLA = at('armLA');
  let armLE = at('armLE', 70);
  const armRA = at('armRA');
  let armRE = at('armRE', 70);
  let legL = at('legL');
  let legR = at('legR');
  let tail = at('tail', 140);
  let earL = at('earL', 115);
  let earR = at('earR', 90);
  let gazeX = at('gazeX');
  let gazeY = at('gazeY');
  const propTilt = at('propTilt', 50);
  const propLift = at('propLift', 50);

  const lid = track(t, face.lid);
  const lidR = track(t, face.lidR);
  const cheek = track(t, face.cheek);
  const mouth = track(t, face.mouth);
  const brow = track(t, face.brow);

  if (useIdle) {
    const idleAmp = (1 - calm * 0.55) * clamp(idle.sway, 0, 2);
    const breath = wave(t, 4200, 0.1) * clamp(idle.breath, 0, 2);

    // Breathing is a volume-preserving squash from the feet: the chest rises,
    // shoulders widen a touch, and the head floats up last.
    sy *= 1 + breath * 0.0095;
    sx *= 1 - breath * 0.0065;
    lift += breath * 1.1;

    // Weight drifts slowly from one foot to the other, always a step behind the
    // lean. This is the difference between "standing" and "posed".
    const sway = wave(t, 7600, 0.35) * idleAmp;
    const sway2 = wave(t, 5200, 0.6) * idleAmp;
    lean += sway * 0.85 + sway2 * 0.25;
    shift += sway * 1.7;
    head += wave(t, 6100, 0.2) * idleAmp * 0.9;
    yaw += wave(t, 8300, 0.7) * idleAmp * 0.02;
    tail += wave(t, 2100, 0.3) * idleAmp * 3.2;
    earL += wave(t, 3400, 0.15) * idleAmp * 0.8;
    earR += wave(t, 3100, 0.55) * idleAmp * 0.8;

    // A rare ear flick, seeded so it is identical on every replay.
    const flickSlot = Math.floor(t / 2800);
    const flickAt = flickSlot * 2800 + seeded(flickSlot, 3) * 1900;
    const fs = t - flickAt;
    if (fs > 0 && fs < 420) {
      const flick = Math.sin((fs / 420) * Math.PI) * (fs < 210 ? 5 : 3);
      if (seeded(flickSlot, 8) > 0.45) earL += flick;
      else earR -= flick;
    }

    // Gaze drift: eyes are never perfectly still, but they stay near the target.
    const wander = idle.gazeWander * idleAmp;
    gazeX += wave(t, 5200, 0.1) * 0.55 * wander;
    gazeY += wave(t, 6900, 0.45) * 0.32 * wander;

    // Tiny forearm life so hanging arms never look like sticks.
    armLE += wave(t, 4000, 0.4) * 1.1 * idleAmp;
    armRE += wave(t, 3800, 0.8) * 1.1 * idleAmp;
    legL += wave(t, 5200, 0.2) * 0.4 * idleAmp;
    legR += wave(t, 5000, 0.7) * 0.4 * idleAmp;
  }

  // Weight shift: the loaded leg straightens, the free leg softens. Without
  // this the feet skate when the hips move.
  const loaded = clamp(shift / 3, -1, 1);
  legL += loaded * 2.4;
  legR -= loaded * 2.4;
  legL = Math.max(0, legL);
  legR = Math.max(0, legR);

  // Head leads with a little counter-rotation against the hip shift.
  head += -shift * 0.35;

  // Gaze: when the script has no target the eyes settle on the viewer with a
  // soft lead toward the head turn.
  gazeX += yaw * 12;

  return {
    lift,
    sx: clamp(sx, 0.7, 1.3),
    sy: clamp(sy, 0.7, 1.3),
    lean: clamp(lean, -24, 24),
    shift: clamp(shift, -16, 16),
    yaw: clamp(yaw, -0.75, 0.75),
    head: clamp(head, -24, 24),
    armL: { a: armLA, e: armLE },
    armR: { a: armRA, e: armRE },
    legL,
    legR,
    tail,
    earL,
    earR,
    gazeX: clamp(gazeX, -6, 6),
    gazeY: clamp(gazeY, -6, 6),
    lid: clamp(lid, 0, 1),
    lidR: clamp(lidR, 0, 1),
    cheek: clamp(cheek, -0.4, 1),
    mouth: clamp(mouth, 0, 30),
    brow: clamp(brow, -1, 1),
    propTilt: clamp(propTilt, -45, 45),
    propLift,
  };
}
