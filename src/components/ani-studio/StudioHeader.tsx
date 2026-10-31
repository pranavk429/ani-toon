"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Download,
  Film,
  FileCode2,
  FolderDown,
  Image as ImageIcon,
  Loader2,
  Redo2,
  Save,
  Sparkles,
  Undo2,
} from "lucide-react";
import type { SourceKind, StudioStatus, StudioTab } from "./types";
import { formatClock, formatSeconds } from "./utils";

export type StudioHeaderProps = {
  projectName: string;
  onRename: (name: string) => void;
  sourceKind: SourceKind;
  status: StudioStatus;
  trackCount: number;
  duration: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  isSaving: boolean;
  lastSaved: Date | null;
  canExportSvg: boolean;
  onExportJson: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onExportWebM: () => void;
  isExportingWebM: boolean;
  webMProgress: number;
  activeTab: StudioTab;
  onTabChange: (tab: StudioTab) => void;
};

export function StudioHeader({
  projectName,
  onRename,
  sourceKind,
  status,
  trackCount,
  duration,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  isSaving,
  lastSaved,
  canExportSvg,
  onExportJson,
  onExportSvg,
  onExportPng,
  onExportWebM,
  isExportingWebM,
  webMProgress,
  activeTab,
  onTabChange,
}: StudioHeaderProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setExportOpen(false);
      }
    };
    if (exportOpen) {
      document.addEventListener("mousedown", handleOutside);
      return () => document.removeEventListener("mousedown", handleOutside);
    }
  }, [exportOpen]);

  const isBusy =
    status.phase === "generating_character" ||
    status.phase === "planning_motion" ||
    status.phase === "validating";

  return (
    <header className="sticky top-0 z-40 border-b border-[#D7D4CB] bg-[#F1EEE6]/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center justify-between gap-3 px-3 sm:px-4">
        {/* Left: ANI Brand Mark & Project Name */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-[#111111] bg-[#111111] text-[#FEFDF9] shadow-sm">
            <span className="font-display text-sm font-black tracking-tight">ANI</span>
          </div>

          <div className="min-w-0">
            <input
              type="text"
              value={projectName}
              onChange={(e) => onRename(e.target.value)}
              placeholder="Untitled Animation"
              aria-label="Project name"
              maxLength={64}
              className="w-40 truncate rounded-[6px] border border-transparent bg-transparent px-1.5 py-0.5 text-xs font-bold text-[#111111] outline-none transition-colors hover:border-[#D7D4CB] focus:border-[#4B63FF] focus:bg-[#FEFDF9] sm:w-60 sm:text-sm"
            />
          </div>

          <span
            className={clsx(
              "hidden rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider md:inline-flex",
              sourceKind === "character"
                ? "border-[#4B63FF]/30 bg-[#4B63FF]/10 text-[#4B63FF]"
                : "border-[#6F6759]/30 bg-[#D7D4CB]/40 text-[#111111]",
            )}
          >
            {sourceKind === "character" ? "Character Mode" : "SVG Mode"}
          </span>
        </div>

        {/* Center: Tabs for < 1100px */}
        <div className="flex items-center gap-1 xl:hidden">
          <div className="flex rounded-[10px] border border-[#D7D4CB] bg-[#FEFDF9] p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => onTabChange("source")}
              className={clsx(
                "rounded-[7px] px-2.5 py-1 text-[11px] font-medium transition-colors",
                activeTab === "source"
                  ? "bg-[#111111] text-[#FEFDF9]"
                  : "text-[#6F6759] hover:text-[#111111]",
              )}
            >
              Source
            </button>
            <button
              type="button"
              onClick={() => onTabChange("stage")}
              className={clsx(
                "rounded-[7px] px-2.5 py-1 text-[11px] font-medium transition-colors",
                activeTab === "stage"
                  ? "bg-[#111111] text-[#FEFDF9]"
                  : "text-[#6F6759] hover:text-[#111111]",
              )}
            >
              Stage
            </button>
            <button
              type="button"
              onClick={() => onTabChange("director")}
              className={clsx(
                "rounded-[7px] px-2.5 py-1 text-[11px] font-medium transition-colors",
                activeTab === "director"
                  ? "bg-[#111111] text-[#FEFDF9]"
                  : "text-[#6F6759] hover:text-[#111111]",
              )}
            >
              Director
            </button>
          </div>
        </div>

        {/* Right: Actions (Undo/Redo, Save, Export, Status) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Status & Provider Indicator */}
          <div className="hidden items-center gap-1.5 rounded-full border border-[#D7D4CB] bg-[#FEFDF9] px-2.5 py-1 sm:flex">
            <span
              className={clsx(
                "h-2 w-2 rounded-full",
                status.phase === "error" && "bg-[#FF5A45]",
                isBusy && "animate-pulse bg-[#FFC53D]",
                status.phase === "ready" && "bg-[#22C55E]",
                status.phase === "idle" && "bg-[#6F6759]",
              )}
            />
            <span className="font-mono text-[10px] font-medium text-[#111111]">
              {status.message}
            </span>

            {status.isFallback ? (
              <span className="rounded-full bg-[#FFC53D]/25 px-1.5 py-0.2 font-mono text-[8px] font-bold text-[#8A6A13]">
                Local Fallback
              </span>
            ) : status.providerLabel ? (
              <span className="rounded-full bg-[#4B63FF]/15 px-1.5 py-0.2 font-mono text-[8px] font-bold text-[#4B63FF]">
                {status.providerLabel}
              </span>
            ) : null}
          </div>

          {/* Undo / Redo */}
          <div className="flex items-center rounded-[8px] border border-[#D7D4CB] bg-[#FEFDF9] shadow-xs">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Cmd+Z)"
              aria-label="Undo last change"
              className="flex h-8 w-8 items-center justify-center text-[#111111] transition-colors hover:bg-[#F1EEE6] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Undo2 size={13} />
            </button>
            <div className="h-4 w-px bg-[#D7D4CB]" />
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Cmd+Shift+Z)"
              aria-label="Redo change"
              className="flex h-8 w-8 items-center justify-center text-[#111111] transition-colors hover:bg-[#F1EEE6] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Redo2 size={13} />
            </button>
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            title={lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : "Save to browser storage"}
            className="flex h-8 items-center gap-1.5 rounded-[8px] border border-[#D7D4CB] bg-[#FEFDF9] px-2.5 text-xs font-semibold text-[#111111] shadow-xs transition hover:bg-[#F1EEE6] disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 size={13} className="animate-spin text-[#4B63FF]" />
            ) : lastSaved ? (
              <Check size={13} className="text-[#22C55E]" />
            ) : (
              <Save size={13} />
            )}
            <span className="hidden sm:inline">Save</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setExportOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              className="flex h-8 items-center gap-1.5 rounded-[8px] bg-[#111111] px-2.5 text-xs font-semibold text-[#FEFDF9] shadow-xs transition hover:bg-[#2B2420]"
            >
              <Download size={13} />
              <span>Export</span>
              <ChevronDown size={11} className={clsx("transition-transform", exportOpen && "rotate-180")} />
            </button>

            {exportOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1.5 w-64 rounded-[12px] border border-[#D7D4CB] bg-[#FEFDF9] p-1.5 shadow-lg"
              >
                <div className="border-b border-[#D7D4CB]/60 px-2 py-1.5">
                  <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-[#6F6759]">
                    Export Animation
                  </p>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setExportOpen(false);
                    onExportJson();
                  }}
                  className="flex w-full items-start gap-2.5 rounded-[8px] px-2.5 py-2 text-left transition hover:bg-[#F1EEE6]"
                >
                  <FolderDown size={15} className="mt-0.5 shrink-0 text-[#4B63FF]" />
                  <div>
                    <p className="text-xs font-bold text-[#111111]">ANI Project (.ani.json)</p>
                    <p className="text-[10px] text-[#6F6759]">Lossless native project JSON</p>
                  </div>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!canExportSvg}
                  onClick={() => {
                    setExportOpen(false);
                    onExportSvg();
                  }}
                  title={
                    canExportSvg
                      ? "Export standalone animated SVG file"
                      : "Character projects cannot be exported as editable animated SVG"
                  }
                  className={clsx(
                    "flex w-full items-start gap-2.5 rounded-[8px] px-2.5 py-2 text-left transition",
                    canExportSvg
                      ? "hover:bg-[#F1EEE6]"
                      : "cursor-not-allowed opacity-40",
                  )}
                >
                  <FileCode2 size={15} className="mt-0.5 shrink-0 text-[#111111]" />
                  <div>
                    <p className="text-xs font-bold text-[#111111]">Animated SVG (.svg)</p>
                    <p className="text-[10px] text-[#6F6759]">
                      {canExportSvg
                        ? "Standalone vector SMIL/CSS SVG"
                        : "SVG source only (character is procedural)"}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setExportOpen(false);
                    onExportPng();
                  }}
                  className="flex w-full items-start gap-2.5 rounded-[8px] px-2.5 py-2 text-left transition hover:bg-[#F1EEE6]"
                >
                  <ImageIcon size={15} className="mt-0.5 shrink-0 text-[#111111]" />
                  <div>
                    <p className="text-xs font-bold text-[#111111]">Current Frame PNG (.png)</p>
                    <p className="text-[10px] text-[#6F6759]">1080×1080 raster snapshot</p>
                  </div>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={isExportingWebM}
                  onClick={() => {
                    setExportOpen(false);
                    onExportWebM();
                  }}
                  className="flex w-full items-start gap-2.5 rounded-[8px] px-2.5 py-2 text-left transition hover:bg-[#F1EEE6] disabled:opacity-50"
                >
                  <Film size={15} className="mt-0.5 shrink-0 text-[#4B63FF]" />
                  <div>
                    <p className="text-xs font-bold text-[#111111]">
                      {isExportingWebM ? `Rendering WebM (${Math.round(webMProgress * 100)}%)...` : "WebM Video (.webm)"}
                    </p>
                    <p className="text-[10px] text-[#6F6759]">1080×1080, 30fps video recording</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
