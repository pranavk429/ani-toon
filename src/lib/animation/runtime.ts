/**
 * One-clock deterministic playback runtime.
 *
 * The class never schedules animation frames. A host calls `tick(deltaMs)` on
 * its own clock (requestAnimationFrame, a test loop, an editor scrub, ...).
 */

import type {
  MotionDocument,
  RuntimeOptions,
  RuntimeSnapshot,
} from "./types";
import { evaluateDocument } from "./evaluate";

export const MIN_PLAYBACK_SPEED = 0.1;
export const MAX_PLAYBACK_SPEED = 4;

export function clampPlaybackSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return 1;
  return Math.min(MAX_PLAYBACK_SPEED, Math.max(MIN_PLAYBACK_SPEED, speed));
}

function hiddenSet(
  value: RuntimeOptions["hiddenTrackIds"],
): Set<string> {
  if (!value) return new Set();
  return new Set(value);
}

export class MotionRuntime {
  private readonly doc: MotionDocument;
  private readonly durationSeconds: number;
  private absoluteTime = 0;
  private playing: boolean;
  private speed: number;
  private loop: boolean;
  private hidden: Set<string>;

  constructor(doc: MotionDocument, options: RuntimeOptions = {}) {
    this.doc = doc;
    this.durationSeconds = Math.max(0, doc.duration);
    this.loop = options.loop ?? doc.loop?.enabled ?? false;
    this.speed = clampPlaybackSpeed(options.speed ?? 1);
    this.hidden = hiddenSet(options.hiddenTrackIds);
    this.playing = options.reducedMotion
      ? false
      : (options.autoplay ?? true);
  }

  play(): void {
    if (!this.loop && this.absoluteTime >= this.durationSeconds) {
      this.absoluteTime = 0;
    }
    this.playing = true;
  }

  pause(): void {
    this.playing = false;
  }

  /** Rewind to zero and start playing. */
  restart(): void {
    this.absoluteTime = 0;
    this.playing = true;
  }

  seek(seconds: number): void {
    if (!Number.isFinite(seconds)) return;
    this.absoluteTime = Math.min(
      this.durationSeconds,
      Math.max(0, seconds),
    );
    if (!this.loop && this.absoluteTime >= this.durationSeconds) {
      this.playing = false;
    }
  }

  setSpeed(speed: number): void {
    if (!Number.isFinite(speed)) return;
    this.speed = clampPlaybackSpeed(speed);
  }

  setLoop(loop: boolean): void {
    this.loop = loop;
    if (!loop && this.absoluteTime >= this.durationSeconds) {
      this.absoluteTime = this.durationSeconds;
      this.playing = false;
    }
  }

  setHiddenTracks(ids: Iterable<string>): void {
    this.hidden = new Set(ids);
  }

  /**
   * Advance by wall-clock milliseconds multiplied by the playback speed.
   * Non-loop playback stops exactly on the final frame.
   */
  tick(deltaMs: number): RuntimeSnapshot {
    if (
      this.playing &&
      Number.isFinite(deltaMs) &&
      deltaMs > 0
    ) {
      this.absoluteTime += (deltaMs / 1000) * this.speed;
      if (!this.loop && this.absoluteTime >= this.durationSeconds) {
        this.absoluteTime = this.durationSeconds;
        this.playing = false;
      }
    }
    return this.snapshot();
  }

  snapshot(): RuntimeSnapshot {
    const document = this.evaluationDocument();
    const state = evaluateDocument(document, this.absoluteTime, {
      hiddenTrackIds: this.hidden,
    });
    return {
      time: state.time,
      duration: this.durationSeconds,
      playing: this.playing,
      speed: this.speed,
      loop: this.loop,
      iteration: state.loopIteration,
      state,
    };
  }

  /**
   * `setLoop` can differ from the document's authored loop flag. Evaluation
   * receives a shallow copy with the runtime preference applied.
   */
  private evaluationDocument(): MotionDocument {
    const authoredLoop = this.doc.loop?.enabled === true;
    if (authoredLoop === this.loop) return this.doc;
    return {
      ...this.doc,
      loop: {
        enabled: this.loop,
        mode: this.doc.loop?.mode ?? "restart",
        ...(this.doc.loop?.iterations !== undefined
          ? { iterations: this.doc.loop.iterations }
          : {}),
      },
    };
  }
}
