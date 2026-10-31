"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type UIEvent,
} from "react";
import clsx from "clsx";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Layers,
  Sliders,
  Timer,
} from "lucide-react";
import { createTimelineModel } from "@/lib/animation";
import type {
  MotionDocument,
  MotionTrack,
  TimelineModel,
  TimelineTrack,
  ValidationContext,
} from "@/lib/animation/types";
import { buildTimeTicks, formatClock, timePercent } from "./utils";
import type { PlaybackChannel } from "./types";
import { TrackInspector } from "./TrackInspector";

export type TimelinePanelProps = {
  document: MotionDocument | null;
  playback: PlaybackChannel;
  hiddenTracks: string[];
  onToggleTrack: (id: string) => void;
  validationContext: ValidationContext;
  onApplyTrackUpdate: (doc: MotionDocument) => void;
  onDeleteTrack: (trackId: string) => void;
};

function trackLabel(track: TimelineTrack): string {
  return track.label || track.id;
}

function TimelinePanelImpl({
  document,
  playback,
  hiddenTracks,
  onToggleTrack,
  validationContext,
  onApplyTrackUpdate,
  onDeleteTrack,
}: TimelinePanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const tie = useMemo(() => {
    if (!document) return { model: null as TimelineModel | null, error: null as string | null };
    try {
      return { model: createTimelineModel(document), error: null as string | null };
    } catch (error) {
      return {
        model: null,
        error: error instanceof Error ? error.message : "Timeline could not be built.",
      };
    }
  }, [document]);

  const model = tie.model;
  const duration = model?.duration ?? document?.duration ?? 0;
  const hiddenSet = useMemo(() => new Set(hiddenTracks), [hiddenTracks]);

  const playheadRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const rulerRef = useRef<HTMLDivElement | null>(null);
  const timeLabelRef = useRef<HTMLSpanElement | null>(null);
  const labelsScrollRef = useRef<HTMLDivElement | null>(null);
  const rowsScrollRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    return playback.subscribeTime((time, nextDuration) => {
      const curDur = nextDuration || duration;
      const percent = timePercent(time, curDur);
      if (playheadRef.current) {
        playheadRef.current.style.left = `${percent}%`;
      }
      if (timeLabelRef.current) {
        timeLabelRef.current.textContent = `${formatClock(time)} / ${formatClock(curDur)}`;
      }
      const ruler = rulerRef.current;
      if (ruler) {
        const clamped = Math.min(curDur, Math.max(0, time));
        ruler.setAttribute("aria-valuenow", clamped.toFixed(2));
        ruler.setAttribute("aria-valuetext", formatClock(clamped));
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

  const handleRulerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const current = playback.getTime();
    const step = event.shiftKey ? 1 : 0.1;
    let next: number | null = null;
    if (event.key === "ArrowLeft") next = current - step;
    else if (event.key === "ArrowRight") next = current + step;
    else if (event.key === "PageDown") next = current - 1;
    else if (event.key === "PageUp") next = current + 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = duration;
    if (next === null) return;
    event.preventDefault();
    playback.onSeek(Math.min(duration, Math.max(0, next)));
  };

  const syncScroll = (
    event: UIEvent<HTMLDivElement>,
    other: HTMLDivElement | null,
  ) => {
    if (!other) return;
    if (other.scrollTop !== event.currentTarget.scrollTop) {
      other.scrollTop = event.currentTarget.scrollTop;
    }
  };

  const ticks = useMemo(() => buildTimeTicks(duration), [duration]);
  const tracks = model?.tracks ?? [];

  const selectedTrack = useMemo(() => {
    if (!selectedTrackId || !document) return null;
    return document.tracks.find((t) => t.id === selectedTrackId) ?? null;
  }, [selectedTrackId, document]);

  return (
    <section
      aria-label="Animation timeline and track inspector"
      className="overflow-hidden rounded-[16px] border border-[#D7D4CB] bg-[#FEFDF9] shadow-sm"
    >
      {/* Timeline Bar Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D7D4CB] bg-[#F1EEE6]/80 px-3.5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand timeline" : "Collapse timeline"}
            className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-[#D7D4CB] bg-[#FEFDF9] text-[#111111] hover:bg-[#F1EEE6]"
          >
            {collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          <Layers size={13} className="shrink-0 text-[#4B63FF]" />
          <h3 className="font-display text-xs font-bold text-[#111111]">Timeline</h3>

          <span className="rounded-full border border-[#D7D4CB] bg-[#FEFDF9] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#111111]">
            {tracks.length} track{tracks.length === 1 ? "" : "s"}
          </span>

          {document && (
            <span className="hidden font-mono text-[9px] text-[#6F6759] sm:inline">
              {document.fps} fps · {document.duration.toFixed(1)}s
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px] text-[#6F6759]">
          <Timer size={12} />
          <span ref={timeLabelRef}>0:00.0 / {formatClock(duration)}</span>
        </div>
      </div>

      {/* Collapsed view */}
      {collapsed ? null : !document ? (
        <div className="px-4 py-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#6F6759]">
            No motion document loaded
          </p>
        </div>
      ) : tie.error ? (
        <div className="px-4 py-6 text-center text-xs text-[#B93B2B]">
          Timeline error: {tie.error}
        </div>
      ) : (
        <div className="flex flex-col md:flex-row">
          {/* Main Timeline View */}
          <div className="flex min-w-0 flex-1">
            {/* Left Track Labels */}
            <div className="w-[140px] shrink-0 border-r border-[#D7D4CB] sm:w-[200px]">
              <div className="flex h-7 items-center justify-between gap-1 border-b border-[#D7D4CB]/60 px-2 font-mono text-[8px] uppercase tracking-wider text-[#6F6759]">
                <span className="truncate">Track · Target</span>
                <span>Mute</span>
              </div>

              <div
                ref={labelsScrollRef}
                onScroll={(e) => syncScroll(e, rowsScrollRef.current)}
                className="scrollbar-thin max-h-[220px] overflow-y-auto"
              >
                {tracks.map((track) => {
                  const isHidden = hiddenSet.has(track.id);
                  const isSelected = selectedTrackId === track.id;

                  return (
                    <div
                      key={track.id}
                      onClick={() => setSelectedTrackId(track.id)}
                      className={clsx(
                        "flex h-10 cursor-pointer items-center justify-between gap-1 border-t border-[#D7D4CB]/50 px-2 transition-colors",
                        isSelected
                          ? "bg-[#4B63FF]/10 font-bold"
                          : "hover:bg-[#F1EEE6]/60",
                        isHidden && "opacity-40",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[10px] text-[#111111]">
                          {trackLabel(track)}
                        </p>
                        <p className="truncate font-mono text-[8px] uppercase text-[#6F6759]">
                          {track.targetId} · {track.property}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTrack(track.id);
                        }}
                        title={isHidden ? "Show track" : "Mute track"}
                        className={clsx(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                          isHidden
                            ? "border-[#D7D4CB] bg-[#F1EEE6] text-[#6F6759]"
                            : "border-[#4B63FF]/40 bg-[#FEFDF9] text-[#4B63FF] hover:bg-[#F1EEE6]",
                        )}
                      >
                        {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Ruler + Keyframe Track Rows */}
            <div ref={railRef} className="relative min-w-0 flex-1">
              {/* Ruler */}
              <div
                ref={rulerRef}
                role="slider"
                tabIndex={duration > 0 ? 0 : -1}
                aria-label="Timeline playhead ruler"
                aria-valuemin={0}
                aria-valuemax={Number(duration.toFixed(2))}
                aria-valuenow={0}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onKeyDown={handleRulerKeyDown}
                className="relative h-7 cursor-ew-resize touch-none select-none border-b border-[#D7D4CB]/60 bg-[#F1EEE6]/30 outline-none"
              >
                {ticks.map((tick, index) => {
                  const percent = timePercent(tick.time, duration);
                  const align =
                    index === 0
                      ? "translate-x-0"
                      : index === ticks.length - 1
                        ? "-translate-x-full"
                        : "-translate-x-1/2";
                  return (
                    <span
                      key={`${tick.time}-${tick.label}`}
                      className={clsx(
                        "pointer-events-none absolute top-0 flex h-full flex-col justify-between",
                        align,
                      )}
                      style={{ left: `${percent}%` }}
                    >
                      <span className="absolute left-0 top-0 h-2 w-px bg-[#D7D4CB]" />
                      <span className="mt-1 whitespace-nowrap px-0.5 font-mono text-[7px] uppercase tracking-wider text-[#6F6759]">
                        {tick.label}
                      </span>
                    </span>
                  );
                })}
              </div>

              {/* Track Rows */}
              <div
                ref={rowsScrollRef}
                onScroll={(e) => syncScroll(e, labelsScrollRef.current)}
                className="scrollbar-thin max-h-[220px] overflow-y-auto"
              >
                {tracks.map((track) => {
                  const isHidden = hiddenSet.has(track.id);
                  const isSelected = selectedTrackId === track.id;
                  const startPct = timePercent(track.window.start, duration);
                  const widthPct = Math.max(0.8, timePercent(track.window.duration, duration));

                  return (
                    <div
                      key={track.id}
                      onClick={() => setSelectedTrackId(track.id)}
                      className={clsx(
                        "relative h-10 cursor-pointer border-t border-[#D7D4CB]/50 transition-colors",
                        isSelected ? "bg-[#4B63FF]/5" : "hover:bg-[#F1EEE6]/30",
                        isHidden && "opacity-40",
                      )}
                    >
                      {/* Track Duration Window */}
                      <div
                        className="absolute top-1/2 h-4 -translate-y-1/2 rounded-[4px] border border-[#4B63FF]/30 bg-[#4B63FF]/15"
                        style={{
                          left: `${startPct}%`,
                          width: `${Math.min(100 - startPct, widthPct)}%`,
                        }}
                      />

                      {/* Keyframe diamonds */}
                      {track.keyframeTimes.map((kfTime, kfIdx) => (
                        <span
                          key={`${track.id}-${kfTime}-${kfIdx}`}
                          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] border border-[#3247D4] bg-[#4B63FF] shadow-2xs"
                          style={{ left: `${timePercent(kfTime, duration)}%` }}
                          title={`Keyframe at ${formatClock(kfTime)}`}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Playhead Marker */}
              <div
                ref={playheadRef}
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 top-0 z-10 w-[2px] bg-[#FF5A45]"
                style={{ left: "0%" }}
              >
                <span className="absolute -left-1 top-0 h-2.5 w-2.5 rounded-full border border-[#FEFDF9] bg-[#FF5A45] shadow-xs" />
              </div>
            </div>
          </div>

          {/* Right Inspector Drawer (when track is selected) */}
          {selectedTrack && (
            <TrackInspector
              track={selectedTrack}
              document={document}
              validationContext={validationContext}
              onApplyTrack={(updatedDoc) => {
                onApplyTrackUpdate(updatedDoc);
              }}
              onDeleteTrack={(trackId) => {
                setSelectedTrackId(null);
                onDeleteTrack(trackId);
              }}
              onClose={() => setSelectedTrackId(null)}
            />
          )}
        </div>
      )}
    </section>
  );
}

export const TimelinePanel = memo(TimelinePanelImpl);
