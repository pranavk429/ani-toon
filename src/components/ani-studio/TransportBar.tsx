"use client";

import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import clsx from "clsx";
import {
  Info,
  Pause,
  Play,
  Repeat,
  RotateCcw,
} from "lucide-react";
import type { PlaybackChannel } from "./types";
import { formatClock, timePercent } from "./utils";

export type TransportBarProps = {
  playback: PlaybackChannel;
  reducedMotion: boolean;
};

const SPEEDS = [0.5, 1, 1.5, 2] as const;

export function TransportBar({ playback, reducedMotion }: TransportBarProps) {
  const duration = playback.duration;
  const timeLabelRef = useRef<HTMLSpanElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    return playback.subscribeTime((time, curDuration) => {
      const dur = curDuration || duration;
      const percent = timePercent(time, dur);
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${percent}%`;
      }
      if (timeLabelRef.current) {
        timeLabelRef.current.textContent = `${formatClock(time)} / ${formatClock(dur)}`;
      }
    });
  }, [playback, duration]);

  const seekFromClientX = (clientX: number) => {
    const rail = railRef.current;
    if (!rail || duration <= 0) return;
    const box = rail.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    playback.onSeek(fraction * duration);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekFromClientX(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    seekFromClientX(event.clientX);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const current = playback.getTime();
    const step = event.shiftKey ? 1 : 0.1;
    let next: number | null = null;
    if (event.key === "ArrowLeft") next = current - step;
    else if (event.key === "ArrowRight") next = current + step;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = duration;
    else if (event.key === " ") {
      event.preventDefault();
      playback.onToggle();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    playback.onSeek(Math.min(duration, Math.max(0, next)));
  };

  return (
    <div className="w-full space-y-2 rounded-[14px] border border-[#D7D4CB] bg-[#FEFDF9] p-2.5 shadow-sm">
      {/* Scrub bar */}
      <div
        ref={railRef}
        role="slider"
        tabIndex={0}
        aria-label="Animation scrubber"
        aria-valuemin={0}
        aria-valuemax={Number(duration.toFixed(2))}
        aria-valuenow={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        className="group relative h-4 cursor-pointer touch-none select-none rounded-[6px] bg-[#F1EEE6] outline-none"
      >
        <div
          ref={progressBarRef}
          className="relative h-full rounded-[6px] bg-[#4B63FF] transition-[width] duration-75"
          style={{ width: `${timePercent(playback.getTime(), duration)}%` }}
        >
          <span className="absolute -right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-[#FEFDF9] bg-[#4B63FF] opacity-0 shadow-xs transition-opacity group-hover:opacity-100" />
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Play/Pause, Restart, Time */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={playback.onToggle}
            title={playback.playing ? "Pause (Space)" : "Play (Space)"}
            aria-label={playback.playing ? "Pause animation" : "Play animation"}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#111111] text-[#FEFDF9] shadow-xs transition hover:bg-[#2B2420]"
          >
            {playback.playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={playback.onRestart}
            title="Restart from beginning"
            aria-label="Restart animation"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#D7D4CB] bg-[#FEFDF9] text-[#111111] shadow-xs transition hover:bg-[#F1EEE6]"
          >
            <RotateCcw size={13} />
          </button>

          <div className="ml-1 rounded-[7px] border border-[#D7D4CB] bg-[#F1EEE6]/60 px-2 py-1 font-mono text-[11px] font-bold text-[#111111]">
            <span ref={timeLabelRef}>0:00.0 / {formatClock(duration)}</span>
          </div>
        </div>

        {/* Speed, Loop */}
        <div className="flex items-center gap-1.5">
          {/* Speed Buttons */}
          <div className="flex rounded-[8px] border border-[#D7D4CB] bg-[#FEFDF9] p-0.5 shadow-2xs">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => playback.onSpeed(s)}
                className={clsx(
                  "rounded-[6px] px-2 py-0.5 font-mono text-[10px] font-bold transition-colors",
                  playback.speed === s
                    ? "bg-[#111111] text-[#FEFDF9]"
                    : "text-[#6F6759] hover:text-[#111111]",
                )}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Loop Button */}
          <button
            type="button"
            onClick={playback.onToggleLoop}
            aria-pressed={playback.loop}
            title={playback.loop ? "Looping enabled" : "Looping disabled"}
            className={clsx(
              "flex h-8 w-8 items-center justify-center rounded-[8px] border shadow-xs transition-colors",
              playback.loop
                ? "border-[#4B63FF] bg-[#4B63FF]/10 text-[#4B63FF]"
                : "border-[#D7D4CB] bg-[#FEFDF9] text-[#6F6759] hover:bg-[#F1EEE6]",
            )}
          >
            <Repeat size={13} />
          </button>
        </div>
      </div>

      {/* Reduced Motion Note */}
      {reducedMotion && (
        <div className="flex items-center gap-1.5 rounded-[8px] border border-[#D7D4CB] bg-[#F1EEE6]/60 px-2 py-1 text-[10px] text-[#6F6759]">
          <Info size={12} className="shrink-0 text-[#4B63FF]" />
          <span>Reduced motion preference detected · Autoplay is disabled</span>
        </div>
      )}
    </div>
  );
}
