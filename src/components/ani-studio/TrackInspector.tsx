"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  Check,
  Sliders,
  Trash2,
  X,
} from "lucide-react";
import type {
  KeyframeValue,
  MotionDocument,
  MotionProperty,
  MotionTrack,
  NamedEasing,
  ValidationContext,
} from "@/lib/animation/types";
import { validateMotionDocument } from "@/lib/animation/validate";
import {
  deleteTrackFromDocument,
  updateKeyframeValues,
  updateTrackInDocument,
} from "./utils";

export type TrackInspectorProps = {
  track: MotionTrack | null;
  document: MotionDocument;
  validationContext: ValidationContext;
  onApplyTrack: (updatedDoc: MotionDocument) => void;
  onDeleteTrack: (trackId: string) => void;
  onClose: () => void;
};

const COMMON_EASINGS: NamedEasing[] = [
  "linear",
  "easeIn",
  "easeOut",
  "easeInOut",
  "quadIn",
  "quadOut",
  "quadInOut",
  "cubicIn",
  "cubicOut",
  "cubicInOut",
  "spring",
  "springSoft",
  "springBouncy",
];

export function TrackInspector({
  track,
  document,
  validationContext,
  onApplyTrack,
  onDeleteTrack,
  onClose,
}: TrackInspectorProps) {
  const [label, setLabel] = useState("");
  const [property, setProperty] = useState<MotionProperty>("rotate");
  const [delay, setDelay] = useState<number>(0);
  const [duration, setDuration] = useState<number>(1);
  const [easing, setEasing] = useState<string>("easeInOut");
  const [firstValue, setFirstValue] = useState<string>("0");
  const [lastValue, setLastValue] = useState<string>("0");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!track) return;
    queueMicrotask(() => {
      setLabel(track.label || track.id);
      setProperty(track.property);
      setDelay(track.delay ?? 0);
      setDuration(track.duration ?? document.duration);
      setEasing(typeof track.easing === "string" ? track.easing : "easeInOut");

      const first = track.keyframes[0]?.value;
      const last = track.keyframes[track.keyframes.length - 1]?.value;
      setFirstValue(first !== undefined ? String(first) : "0");
      setLastValue(last !== undefined ? String(last) : "0");
      setErrors([]);
    });
  }, [track, document]);

  if (!track) return null;

  const targetLabel =
    track.target.kind === "character"
      ? `${track.target.actorId}:${track.target.boneId}`
      : track.target.kind === "object"
        ? `object:${track.target.objectId}`
        : `#${track.target.elementId}`;

  const parseNumOrStr = (raw: string): KeyframeValue => {
    const num = Number(raw);
    return Number.isFinite(num) && raw.trim() !== "" ? num : raw;
  };

  const handleApply = () => {
    try {
      const parsedFirst = parseNumOrStr(firstValue);
      const parsedLast = parseNumOrStr(lastValue);

      const updatedKeyframes = updateKeyframeValues(
        track.keyframes,
        parsedFirst,
        parsedLast,
      );

      const updatedTrack: MotionTrack = {
        ...track,
        label: label.trim() || track.id,
        property,
        delay: Math.max(0, Number(delay) || 0),
        duration: Math.max(0.1, Number(duration) || 0.1),
        easing: easing as NamedEasing,
        keyframes: updatedKeyframes,
      };

      const candidateDoc = updateTrackInDocument(document, track.id, updatedTrack);
      const valResult = validateMotionDocument(candidateDoc, validationContext);

      if (!valResult.ok) {
        setErrors(
          valResult.errors.map((e) => `${e.path ? `${e.path}: ` : ""}${e.message}`),
        );
        return;
      }

      setErrors([]);
      onApplyTrack(valResult.document ?? candidateDoc);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Validation failed."]);
    }
  };

  const handleDelete = () => {
    const candidateDoc = deleteTrackFromDocument(document, track.id);
    const valResult = validateMotionDocument(candidateDoc, validationContext);
    if (!valResult.ok) {
      setErrors(valResult.errors.map((e) => e.message));
      return;
    }
    onDeleteTrack(track.id);
  };

  return (
    <div className="flex h-full w-full flex-col border-l border-[#D7D4CB] bg-[#FEFDF9] p-3 text-xs md:w-80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#D7D4CB]/70 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-[#111111]">
          <Sliders size={13} className="text-[#4B63FF]" />
          <span>Track Inspector</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="text-[#6F6759] hover:text-[#111111]"
        >
          <X size={14} />
        </button>
      </div>

      {/* Inline Errors */}
      {errors.length > 0 && (
        <div className="mt-2 rounded-[8px] border border-[#FF5A45]/40 bg-[#FF5A45]/10 p-2 text-[10px] text-[#B93B2B]">
          <div className="flex items-start gap-1 font-bold">
            <AlertTriangle size={11} className="mt-0.5 shrink-0" />
            <span>Invalid configuration:</span>
          </div>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Form Fields */}
      <div className="scrollbar-thin flex-1 overflow-y-auto py-2 space-y-2.5">
        {/* Target (Read-Only) */}
        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider text-[#6F6759]">
            Target (read-only)
          </label>
          <input
            type="text"
            readOnly
            value={targetLabel}
            className="mt-1 w-full rounded-[6px] border border-[#D7D4CB] bg-[#F1EEE6]/60 px-2 py-1 font-mono text-[10px] text-[#111111] outline-none"
          />
        </div>

        {/* Label */}
        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider text-[#6F6759]">
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="mt-1 w-full rounded-[6px] border border-[#D7D4CB] bg-[#FEFDF9] px-2 py-1 text-xs text-[#111111] outline-none focus:border-[#4B63FF]"
          />
        </div>

        {/* Property */}
        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider text-[#6F6759]">
            Property
          </label>
          <input
            type="text"
            value={property}
            onChange={(e) => setProperty(e.target.value as MotionProperty)}
            className="mt-1 w-full rounded-[6px] border border-[#D7D4CB] bg-[#FEFDF9] px-2 py-1 font-mono text-xs text-[#111111] outline-none focus:border-[#4B63FF]"
          />
        </div>

        {/* Delay & Duration */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="font-mono text-[9px] uppercase tracking-wider text-[#6F6759]">
              Delay (s)
            </label>
            <input
              type="number"
              step="0.05"
              min="0"
              max={document.duration}
              value={delay}
              onChange={(e) => setDelay(parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded-[6px] border border-[#D7D4CB] bg-[#FEFDF9] px-2 py-1 font-mono text-xs text-[#111111] outline-none focus:border-[#4B63FF]"
            />
          </div>
          <div>
            <label className="font-mono text-[9px] uppercase tracking-wider text-[#6F6759]">
              Duration (s)
            </label>
            <input
              type="number"
              step="0.05"
              min="0.1"
              max={document.duration}
              value={duration}
              onChange={(e) => setDuration(parseFloat(e.target.value) || 0.1)}
              className="mt-1 w-full rounded-[6px] border border-[#D7D4CB] bg-[#FEFDF9] px-2 py-1 font-mono text-xs text-[#111111] outline-none focus:border-[#4B63FF]"
            />
          </div>
        </div>

        {/* Easing */}
        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider text-[#6F6759]">
            Easing
          </label>
          <select
            value={easing}
            onChange={(e) => setEasing(e.target.value)}
            className="mt-1 w-full rounded-[6px] border border-[#D7D4CB] bg-[#FEFDF9] px-2 py-1 font-mono text-xs text-[#111111] outline-none focus:border-[#4B63FF]"
          >
            {COMMON_EASINGS.map((ease) => (
              <option key={ease} value={ease}>
                {ease}
              </option>
            ))}
          </select>
        </div>

        {/* First & Last Keyframe Values */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="font-mono text-[9px] uppercase tracking-wider text-[#6F6759]">
              Keyframe 0 (start)
            </label>
            <input
              type="text"
              value={firstValue}
              onChange={(e) => setFirstValue(e.target.value)}
              className="mt-1 w-full rounded-[6px] border border-[#D7D4CB] bg-[#FEFDF9] px-2 py-1 font-mono text-xs text-[#111111] outline-none focus:border-[#4B63FF]"
            />
          </div>
          <div>
            <label className="font-mono text-[9px] uppercase tracking-wider text-[#6F6759]">
              Keyframe 1 (end)
            </label>
            <input
              type="text"
              value={lastValue}
              onChange={(e) => setLastValue(e.target.value)}
              className="mt-1 w-full rounded-[6px] border border-[#D7D4CB] bg-[#FEFDF9] px-2 py-1 font-mono text-xs text-[#111111] outline-none focus:border-[#4B63FF]"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-[#D7D4CB]/70 pt-2.5">
        <button
          type="button"
          onClick={handleDelete}
          title="Delete this track"
          className="flex items-center gap-1 rounded-[6px] border border-[#FF5A45]/40 px-2 py-1 font-mono text-[10px] font-bold text-[#B93B2B] hover:bg-[#FF5A45]/10"
        >
          <Trash2 size={11} />
          <span>Delete</span>
        </button>

        <button
          type="button"
          onClick={handleApply}
          className="flex items-center gap-1.5 rounded-[6px] bg-[#4B63FF] px-3 py-1 font-mono text-[10px] font-bold text-[#FEFDF9] shadow-xs hover:bg-[#3247D4]"
        >
          <Check size={11} />
          <span>Apply Changes</span>
        </button>
      </div>
    </div>
  );
}
