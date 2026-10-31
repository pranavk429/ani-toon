import { describe, expect, it } from "vitest";

import {
  MotionRuntime,
  type MotionDocument,
  type MotionTrack,
} from "@/lib/animation";
import { makeDocument, makeTrack } from "./helpers";

function moveTrack(): MotionTrack {
  return makeTrack({
    id: "move",
    property: "translateX",
    easing: "linear",
    keyframes: [
      { at: 0, value: 0 },
      { at: 1, value: 10 },
    ],
  });
}

function fadeTrack(): MotionTrack {
  return makeTrack({
    id: "fade",
    property: "opacity",
    keyframes: [
      { at: 0, value: 1 },
      { at: 1, value: 0.5 },
    ],
  });
}

function loopDoc(mode: "restart" | "pingpong" = "restart"): MotionDocument {
  return makeDocument({
    duration: 2,
    loop: { enabled: true, mode },
    tracks: [moveTrack()],
  });
}

describe("MotionRuntime", () => {
  it("starts autoplaying on one clock", () => {
    const runtime = new MotionRuntime(
      makeDocument({ tracks: [moveTrack()] }),
    );
    const initial = runtime.snapshot();
    expect(initial.playing).toBe(true);
    expect(initial.time).toBe(0);
    expect(initial.speed).toBe(1);
    expect(initial.iteration).toBe(0);
    expect(initial.state.targets.box.translateX).toBeCloseTo(0, 8);
  });

  it("advances by delta milliseconds times speed and stops at the end", () => {
    const runtime = new MotionRuntime(
      makeDocument({ tracks: [moveTrack()] }),
    );
    const half = runtime.tick(500);
    expect(half.time).toBeCloseTo(0.5, 8);
    expect(half.state.targets.box.translateX).toBeCloseTo(2.5, 8);

    const end = runtime.tick(10_000);
    expect(end.time).toBe(2);
    expect(end.playing).toBe(false);
    expect(end.state.targets.box.translateX).toBeCloseTo(10, 8);
  });

  it("does not advance while paused and can resume after the end", () => {
    const runtime = new MotionRuntime(
      makeDocument({ tracks: [moveTrack()] }),
      { autoplay: false },
    );
    expect(runtime.snapshot().playing).toBe(false);
    expect(runtime.tick(1000).time).toBe(0);

    runtime.play();
    runtime.tick(1000);
    runtime.pause();
    const paused = runtime.snapshot();
    expect(paused.time).toBeCloseTo(1, 8);
    runtime.tick(1000);
    expect(runtime.snapshot().time).toBeCloseTo(1, 8);

    runtime.seek(2);
    expect(runtime.snapshot().playing).toBe(false);
    runtime.play();
    expect(runtime.snapshot().time).toBe(0);
  });

  it("clamps seek and speed", () => {
    const runtime = new MotionRuntime(
      makeDocument({ tracks: [moveTrack()] }),
    );
    runtime.seek(-100);
    expect(runtime.snapshot().time).toBe(0);
    runtime.seek(100);
    expect(runtime.snapshot().time).toBe(2);

    runtime.setSpeed(10);
    expect(runtime.snapshot().speed).toBe(4);
    runtime.setSpeed(0);
    expect(runtime.snapshot().speed).toBe(0.1);
    runtime.seek(0);
    runtime.play();
    runtime.tick(1000);
    expect(runtime.snapshot().time).toBeCloseTo(0.1, 8);
  });

  it("wraps restart loops and increments iteration", () => {
    const runtime = new MotionRuntime(loopDoc("restart"));
    const first = runtime.tick(2500);
    expect(first.time).toBeCloseTo(0.5, 8);
    expect(first.iteration).toBe(1);
    expect(first.playing).toBe(true);
    expect(first.state.targets.box.translateX).toBeCloseTo(2.5, 8);

    const second = runtime.tick(2000);
    expect(second.time).toBeCloseTo(0.5, 8);
    expect(second.iteration).toBe(2);
  });

  it("folds pingpong loops at both boundaries", () => {
    const runtime = new MotionRuntime(loopDoc("pingpong"));
    const forward = runtime.tick(1000);
    expect(forward.time).toBeCloseTo(1, 8);
    const backward = runtime.tick(2000);
    expect(backward.time).toBeCloseTo(1, 8);
    const nearEnd = runtime.tick(500);
    expect(nearEnd.time).toBeCloseTo(0.5, 8);
    const nextCycle = runtime.tick(500);
    expect(nextCycle.time).toBeCloseTo(0, 8);
    expect(nextCycle.iteration).toBe(1);
  });

  it("restarts from zero and keeps playing", () => {
    const runtime = new MotionRuntime(loopDoc());
    runtime.tick(3000);
    runtime.restart();
    const snapshot = runtime.snapshot();
    expect(snapshot.time).toBe(0);
    expect(snapshot.playing).toBe(true);
    expect(snapshot.iteration).toBe(0);
  });

  it("overrides the authored loop flag at runtime", () => {
    const nonLoop = makeDocument({ tracks: [moveTrack()] });
    const runtime = new MotionRuntime(nonLoop, { loop: true });
    const wrapped = runtime.tick(2500);
    expect(wrapped.time).toBeCloseTo(0.5, 8);
    expect(wrapped.iteration).toBe(1);

    const looping = new MotionRuntime(loopDoc(), { loop: false });
    looping.tick(2500);
    looping.setLoop(false);
    const stopped = looping.snapshot();
    expect(stopped.time).toBe(2);
    expect(stopped.playing).toBe(false);
    expect(stopped.loop).toBe(false);
  });

  it("mutes hidden tracks in snapshots", () => {
    const runtime = new MotionRuntime(
      makeDocument({ tracks: [moveTrack(), fadeTrack()] }),
    );
    runtime.setHiddenTracks(["move"]);
    const snapshot = runtime.tick(1000);
    expect(snapshot.state.targets.box.translateX).toBe(0);
    expect(snapshot.state.targets.box.opacity).toBeCloseTo(0.75, 8);
  });

  it("honours reduced motion and ignores invalid ticks", () => {
    const runtime = new MotionRuntime(
      makeDocument({ tracks: [moveTrack()] }),
      { reducedMotion: true },
    );
    expect(runtime.snapshot().playing).toBe(false);
    runtime.tick(Number.NaN);
    runtime.tick(-100);
    expect(runtime.snapshot().time).toBe(0);

    runtime.play();
    runtime.tick(Number.POSITIVE_INFINITY);
    expect(runtime.snapshot().time).toBe(0);
  });
});
