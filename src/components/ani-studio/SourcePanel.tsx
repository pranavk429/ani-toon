"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Database,
  FileCode2,
  FolderOpen,
  Info,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  User,
  Layers,
} from "lucide-react";
import type { Scene } from "@/creature/types";
import type { ProjectSummary } from "@/lib/studio/contracts";
import type { SceneGraph } from "@/lib/svg/types";
import type { SourceKind } from "./types";
import {
  flattenVisibleElements,
  formatBytesShort,
  type FlatTreeRow,
} from "./utils";

export type SourcePanelProps = {
  sourceKind: SourceKind;
  onSwitchSourceKind: (kind: SourceKind) => void;
  scene: Scene | null;
  graph: SceneGraph | null;
  onNewCharacterPrompt: (prompt: string) => void;
  isGeneratingCharacter: boolean;
  onUploadSvgFile: (file: File) => void;
  isImportingSvg: boolean;
  importWarnings: string[];
  selectedElementIds: string[];
  onSelectElement: (id: string | null, additive: boolean) => void;
  projects: ProjectSummary[];
  currentProjectId?: string;
  onLoadProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onImportProjectJson: (file: File) => void;
};

const TAG_COLORS: Record<string, string> = {
  g: "bg-[#4B63FF]/15 text-[#3247D4]",
  path: "bg-[#FFC53D]/30 text-[#8A6A13]",
  rect: "bg-[#FF5A45]/15 text-[#B93B2B]",
  circle: "bg-[#22C55E]/15 text-[#15803D]",
  ellipse: "bg-[#22C55E]/15 text-[#15803D]",
  text: "bg-[#6F6759]/15 text-[#111111]",
};

export function SourcePanel({
  sourceKind,
  onSwitchSourceKind,
  scene,
  graph,
  onNewCharacterPrompt,
  isGeneratingCharacter,
  onUploadSvgFile,
  isImportingSvg,
  importWarnings,
  selectedElementIds,
  onSelectElement,
  projects,
  currentProjectId,
  onLoadProject,
  onDeleteProject,
  onImportProjectJson,
}: SourcePanelProps) {
  const [characterPrompt, setCharacterPrompt] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [expandedElements, setExpandedElements] = useState<Set<string>>(new Set());
  const svgFileInputRef = useRef<HTMLInputElement | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedSet = useMemo(() => new Set(selectedElementIds), [selectedElementIds]);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.toLowerCase().endsWith(".svg")) {
      onUploadSvgFile(file);
    }
  };

  const handleSvgFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadSvgFile(file);
      e.target.value = "";
    }
  };

  const handleJsonFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportProjectJson(file);
      e.target.value = "";
    }
  };

  const toggleExpand = useCallback((id: string) => {
    setExpandedElements((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Initialize expanded set when graph changes.
  useEffect(() => {
    if (!graph) return;
    queueMicrotask(() => setExpandedElements(new Set(graph.rootIds)));
  }, [graph]);

  const flatRows: FlatTreeRow[] = useMemo(() => {
    if (!graph) return [];
    return flattenVisibleElements(
      {
        rootIds: graph.rootIds,
        elements: graph.elements,
      },
      expandedElements,
    );
  }, [graph, expandedElements]);

  const primaryActor = scene?.actors?.[0];
  const paletteEntries = primaryActor?.genome?.palette
    ? Object.entries(primaryActor.genome.palette)
    : [];

  return (
    <aside
      aria-label="Source panel"
      className="flex h-full w-full flex-col border-r border-[#D7D4CB] bg-[#FEFDF9] xl:w-[280px]"
    >
      {/* Source Mode Switcher */}
      <div className="flex border-b border-[#D7D4CB] bg-[#F1EEE6]/60 p-2">
        <div className="grid w-full grid-cols-2 gap-1 rounded-[9px] border border-[#D7D4CB] bg-[#FEFDF9] p-0.5 shadow-xs">
          <button
            type="button"
            onClick={() => onSwitchSourceKind("character")}
            className={clsx(
              "flex items-center justify-center gap-1.5 rounded-[7px] py-1 text-xs font-semibold transition-colors",
              sourceKind === "character"
                ? "bg-[#111111] text-[#FEFDF9]"
                : "text-[#6F6759] hover:text-[#111111]",
            )}
          >
            <User size={12} />
            <span>Character</span>
          </button>
          <button
            type="button"
            onClick={() => onSwitchSourceKind("svg")}
            className={clsx(
              "flex items-center justify-center gap-1.5 rounded-[7px] py-1 text-xs font-semibold transition-colors",
              sourceKind === "svg"
                ? "bg-[#111111] text-[#FEFDF9]"
                : "text-[#6F6759] hover:text-[#111111]",
            )}
          >
            <FileCode2 size={12} />
            <span>SVG Artwork</span>
          </button>
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto p-3 space-y-4">
        {sourceKind === "character" ? (
          <>
            {/* Character Card */}
            {primaryActor && (
              <div className="rounded-[14px] border border-[#D7D4CB] bg-[#F1EEE6]/40 p-3 shadow-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#111111]">
                      {primaryActor.genome.name}
                    </h3>
                    <p className="text-[11px] text-[#6F6759]">
                      {primaryActor.genome.species} · {primaryActor.genome.bodyPlan}
                    </p>
                  </div>
                  <span className="rounded-full border border-[#D7D4CB] bg-[#FEFDF9] px-2 py-0.5 font-mono text-[9px] font-semibold text-[#111111]">
                    {primaryActor.skeleton?.bones?.length ?? 0} bones
                  </span>
                </div>

                {/* Palette Swatches */}
                {paletteEntries.length > 0 && (
                  <div className="mt-3">
                    <p className="font-mono text-[8px] uppercase tracking-wider text-[#6F6759]">
                      Palette Swatches
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {paletteEntries.map(([key, hex]) => (
                        <div
                          key={key}
                          title={`${key}: ${hex}`}
                          className="h-4 w-4 rounded-full border border-black/15 shadow-2xs transition-transform hover:scale-125"
                          style={{ backgroundColor: String(hex) }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Accessories */}
                {primaryActor.genome?.accessories?.length > 0 && (
                  <div className="mt-3">
                    <p className="font-mono text-[8px] uppercase tracking-wider text-[#6F6759]">
                      Accessories
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {primaryActor.genome.accessories.map((acc, idx) => (
                        <span
                          key={`${acc.kind}-${idx}`}
                          className="rounded-[6px] border border-[#D7D4CB] bg-[#FEFDF9] px-1.5 py-0.5 font-mono text-[9px] text-[#111111]"
                        >
                          {acc.kind} ({acc.attach})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Scene Objects */}
            {scene?.objects && scene.objects.length > 0 && (
              <div className="rounded-[14px] border border-[#D7D4CB] bg-[#FEFDF9] p-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-mono text-[9px] font-semibold uppercase tracking-wider text-[#6F6759]">
                    Scene Props ({scene.objects.length})
                  </h4>
                </div>
                <div className="mt-2 space-y-1.5">
                  {scene.objects.map((obj) => (
                    <div
                      key={obj.id}
                      className="flex items-center justify-between rounded-[8px] border border-[#D7D4CB]/60 bg-[#F1EEE6]/30 px-2 py-1"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full border border-black/15"
                          style={{ backgroundColor: obj.color }}
                        />
                        <span className="text-[11px] font-medium text-[#111111]">
                          {obj.label || obj.id}
                        </span>
                      </div>
                      <span className="font-mono text-[8px] uppercase text-[#6F6759]">
                        {obj.kind}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Character Prompt */}
            <div className="rounded-[14px] border border-[#D7D4CB] bg-[#FEFDF9] p-3 shadow-xs">
              <label
                htmlFor="new-character-input"
                className="block font-mono text-[9px] font-semibold uppercase tracking-wider text-[#6F6759]"
              >
                New Character Prompt
              </label>
              <textarea
                id="new-character-input"
                value={characterPrompt}
                onChange={(e) => setCharacterPrompt(e.target.value)}
                placeholder="e.g. A warm chef in an apron flipping a pancake..."
                rows={3}
                disabled={isGeneratingCharacter}
                className="mt-1.5 w-full resize-none rounded-[8px] border border-[#D7D4CB] bg-[#F1EEE6]/40 p-2 text-xs text-[#111111] placeholder:text-[#6F6759]/60 outline-none transition focus:border-[#4B63FF] focus:bg-[#FEFDF9]"
              />
              <button
                type="button"
                onClick={() => {
                  if (characterPrompt.trim()) {
                    onNewCharacterPrompt(characterPrompt.trim());
                    setCharacterPrompt("");
                  }
                }}
                disabled={!characterPrompt.trim() || isGeneratingCharacter}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#4B63FF] py-1.5 text-xs font-semibold text-[#FEFDF9] shadow-xs transition hover:bg-[#3247D4] disabled:opacity-40"
              >
                {isGeneratingCharacter ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sparkles size={13} />
                )}
                <span>{isGeneratingCharacter ? "Generating..." : "Generate Character"}</span>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* SVG Mode Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => svgFileInputRef.current?.click()}
              className={clsx(
                "flex cursor-pointer flex-col items-center justify-center rounded-[14px] border-2 border-dashed p-4 text-center transition-colors",
                isDragging
                  ? "border-[#4B63FF] bg-[#4B63FF]/10"
                  : "border-[#D7D4CB] bg-[#F1EEE6]/30 hover:border-[#4B63FF]/60 hover:bg-[#F1EEE6]/60",
              )}
            >
              <input
                ref={svgFileInputRef}
                type="file"
                accept=".svg,image/svg+xml"
                onChange={handleSvgFileChange}
                className="hidden"
              />
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D7D4CB] bg-[#FEFDF9] text-[#4B63FF] shadow-xs">
                {isImportingSvg ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
              </span>
              <p className="mt-2 text-xs font-bold text-[#111111]">
                {isImportingSvg ? "Sanitizing SVG..." : "Choose SVG or drag here"}
              </p>
              <p className="mt-0.5 font-mono text-[9px] text-[#6F6759]">
                Max 2MB · Sanitized scene graph
              </p>
            </div>

            {/* SVG Warnings */}
            {importWarnings.length > 0 && (
              <div className="rounded-[10px] border border-[#FFC53D]/60 bg-[#FFC53D]/10 p-2.5">
                <div className="flex items-start gap-1.5 text-[#8A6A13]">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <div className="space-y-1 text-[10px]">
                    <p className="font-bold">Sanitization notes:</p>
                    {importWarnings.map((w, idx) => (
                      <p key={idx}>{w}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SVG Stats */}
            {graph && (
              <div className="grid grid-cols-3 gap-1.5 rounded-[12px] border border-[#D7D4CB] bg-[#FEFDF9] p-2 text-center shadow-xs">
                <div className="p-1">
                  <p className="font-mono text-[8px] uppercase tracking-wider text-[#6F6759]">Bytes</p>
                  <p className="font-mono text-[11px] font-bold text-[#111111]">
                    {formatBytesShort(graph.stats.bytes)}
                  </p>
                </div>
                <div className="border-x border-[#D7D4CB]/60 p-1">
                  <p className="font-mono text-[8px] uppercase tracking-wider text-[#6F6759]">Elements</p>
                  <p className="font-mono text-[11px] font-bold text-[#111111]">
                    {graph.stats.elementCount}
                  </p>
                </div>
                <div className="p-1">
                  <p className="font-mono text-[8px] uppercase tracking-wider text-[#6F6759]">Animatable</p>
                  <p className="font-mono text-[11px] font-bold text-[#4B63FF]">
                    {graph.stats.animatableCount}
                  </p>
                </div>
              </div>
            )}

            {/* Sanitized Scene Tree */}
            {graph && (
              <div className="rounded-[14px] border border-[#D7D4CB] bg-[#FEFDF9] shadow-xs">
                <div className="flex items-center justify-between border-b border-[#D7D4CB] bg-[#F1EEE6]/60 px-3 py-1.5">
                  <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-[#6F6759]">
                    Scene Graph ({flatRows.length})
                  </span>
                  {selectedElementIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onSelectElement(null, false)}
                      className="font-mono text-[9px] font-bold text-[#4B63FF] hover:underline"
                    >
                      Clear ({selectedElementIds.length})
                    </button>
                  )}
                </div>

                <div className="scrollbar-thin max-h-64 overflow-y-auto p-1.5 space-y-0.5">
                  {flatRows.map((row) => {
                    const elem = graph.elements[row.id];
                    if (!elem) return null;
                    const hasChildren = elem.childIds.length > 0;
                    const isExpanded = expandedElements.has(row.id);
                    const isSelected = selectedSet.has(row.id);

                    return (
                      <div
                        key={row.id}
                        style={{ paddingLeft: `${row.depth * 10 + 4}px` }}
                        onClick={(e) => {
                          const additive = e.shiftKey || e.metaKey || e.ctrlKey;
                          onSelectElement(row.id, additive);
                        }}
                        className={clsx(
                          "flex cursor-pointer items-center justify-between rounded-[6px] py-1 pr-1.5 transition-colors",
                          isSelected
                            ? "border border-[#4B63FF]/30 bg-[#4B63FF]/15 text-[#111111]"
                            : "hover:bg-[#F1EEE6]/70 text-[#111111]",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(row.id);
                              }}
                              className="text-[#6F6759] hover:text-[#111111]"
                            >
                              {isExpanded ? (
                                <ChevronDown size={11} />
                              ) : (
                                <ChevronRight size={11} />
                              )}
                            </button>
                          ) : (
                            <span className="w-3" />
                          )}

                          <span
                            className={clsx(
                              "rounded px-1 py-0.2 font-mono text-[8px] font-bold uppercase",
                              TAG_COLORS[elem.tag] ?? "bg-[#D7D4CB]/60 text-[#111111]",
                            )}
                          >
                            {elem.tag}
                          </span>

                          <span className="truncate font-mono text-[10px]">
                            {elem.semantic?.label || elem.id}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Local Saved Projects */}
        <div className="rounded-[14px] border border-[#D7D4CB] bg-[#FEFDF9] p-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Database size={13} className="text-[#4B63FF]" />
              <h4 className="font-mono text-[9px] font-semibold uppercase tracking-wider text-[#6F6759]">
                Saved Projects ({projects.length})
              </h4>
            </div>
            <button
              type="button"
              onClick={() => jsonFileInputRef.current?.click()}
              title="Import .ani.json file"
              className="flex items-center gap-1 font-mono text-[9px] font-bold text-[#4B63FF] hover:underline"
            >
              <Upload size={10} />
              <span>Import</span>
            </button>
            <input
              ref={jsonFileInputRef}
              type="file"
              accept=".json,.ani.json"
              onChange={handleJsonFileChange}
              className="hidden"
            />
          </div>

          <p className="mt-1 text-[10px] text-[#6F6759]">
            Stored locally in your browser&apos;s IndexedDB.
          </p>

          <div className="mt-2 space-y-1.5">
            {projects.length === 0 ? (
              <p className="py-2 text-center font-mono text-[10px] text-[#6F6759]">
                No saved projects yet
              </p>
            ) : (
              projects.map((proj) => {
                const isCurrent = proj.id === currentProjectId;
                return (
                  <div
                    key={proj.id}
                    className={clsx(
                      "flex items-center justify-between rounded-[8px] border p-2 transition-colors",
                      isCurrent
                        ? "border-[#4B63FF] bg-[#4B63FF]/5"
                        : "border-[#D7D4CB]/70 bg-[#F1EEE6]/20 hover:bg-[#F1EEE6]/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onLoadProject(proj.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-xs font-bold text-[#111111]">
                        {proj.name}
                      </p>
                      <p className="font-mono text-[8px] uppercase text-[#6F6759]">
                        {proj.sourceKind} · {new Date(proj.updatedAt).toLocaleDateString()}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteProject(proj.id)}
                      title="Delete project"
                      aria-label={`Delete ${proj.name}`}
                      className="ml-2 text-[#6F6759] hover:text-[#FF5A45]"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
