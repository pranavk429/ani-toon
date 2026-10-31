"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import clsx from "clsx";
import {
  AlertTriangle,
  Check,
  Film,
  Grid,
  Info,
  Layers,
  Maximize2,
  Minimize2,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Scene } from "@/creature/types";
import { SceneFrame } from "@/creature/render";
import {
  characterContextForScene,
  validationContextForScene,
} from "@/creature/motion";
import { importSvg, sceneToContext } from "@/lib/svg";
import type { SceneGraph } from "@/lib/svg/types";
import {
  applySvgEvaluation,
  buildAnimatedSvg,
  evaluateDocument,
  validateMotionDocument,
} from "@/lib/animation";
import type {
  MotionDocument,
  ValidationContext,
} from "@/lib/animation/types";
import type {
  AnimationDirectionRequest,
  AnimationDirectionResponse,
  AnimationDirectionSuccess,
} from "@/lib/ai/contracts";
import type { AniProject, ProjectSummary } from "@/lib/studio/contracts";
import {
  deleteProject,
  listProjects,
  loadProject,
  saveProject,
} from "@/lib/project-store";
import {
  downloadPng,
  downloadProject,
  downloadSvgMarkup,
  downloadWebM,
  parseProjectJson,
  renderWebM,
  serializeStageSvg,
  svgMarkupToPng,
} from "@/lib/studio-export";

import type {
  ChatMessage,
  PlaybackChannel,
  SourceKind,
  StageBackground,
  StudioPhase,
  StudioStatus,
  StudioTab,
} from "./types";
import {
  buildSofiaStarterProject,
  buildStarterSvgProject,
  classifyInstructionIntent,
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type UndoHistory,
} from "./utils";
import { StudioHeader } from "./StudioHeader";
import { SourcePanel } from "./SourcePanel";
import { CharacterStage, type StageHandle } from "./CharacterStage";
import { SvgStage } from "./SvgStage";
import { TransportBar } from "./TransportBar";
import { ChatPanel } from "./ChatPanel";
import { TimelinePanel } from "./TimelinePanel";
import { usePrefersReducedMotion, useStudioClock } from "./useStudioClock";

export function AniStudio() {
  const reducedMotion = usePrefersReducedMotion();

  // Undo/Redo bounded history
  const [history, setHistory] = useState<UndoHistory<AniProject>>(() =>
    createHistory(buildSofiaStarterProject()),
  );

  const project = history.present;
  const sourceKind: SourceKind = project.source.kind;
  // The source panel can open the SVG uploader before an SVG project exists.
  // The stage still renders the current project until a file is imported.
  const [sourceTab, setSourceTab] = useState<SourceKind>(project.source.kind);

  // View settings
  const [background, setBackground] = useState<StageBackground>("paper");
  const [zoom, setZoom] = useState<number>(100);
  const [showSkeleton, setShowSkeleton] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<StudioTab>("stage");
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [hiddenTrackIds, setHiddenTrackIds] = useState<string[]>([]);

  // Director chat & status
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "initial-welcome",
      role: "assistant",
      content:
        "Welcome to ANI vector animation studio. A starter character is loaded with an authored baseline performance. Describe a motion change, or change the character's appearance (e.g. 'Change the shirt to blue').",
      timestamp: "2026-10-31T00:00:00.000Z",
      isFallback: false,
      providerLabel: "Authored Baseline",
    },
  ]);
  const [instruction, setInstruction] = useState("");
  const [status, setStatus] = useState<StudioStatus>({
    phase: "ready",
    message: "Ready",
  });
  const [lastResponse, setLastResponse] = useState<AnimationDirectionSuccess | null>(
    null,
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  // Persistence & export states
  const [savedProjects, setSavedProjects] = useState<ProjectSummary[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [isImportingSvg, setIsImportingSvg] = useState(false);
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);
  const [isExportingWebM, setIsExportingWebM] = useState(false);
  const [webMProgress, setWebMProgress] = useState(0);

  const characterStageRef = useRef<StageHandle | null>(null);
  const svgStageRef = useRef<StageHandle | null>(null);

  // Refresh saved projects on mount
  const refreshProjects = useCallback(async () => {
    try {
      const list = await listProjects();
      setSavedProjects(list);
    } catch {
      // IndexedDB might be unavailable; silence
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  // Authoritative clock
  const playback = useStudioClock({
    duration: project.motion.duration,
    speed: 1,
    loop: project.motion.loop.enabled,
    autoplay: false,
    reducedMotion,
  });

  // Active scene and graph
  const currentScene: Scene | null =
    project.source.kind === "character" ? project.source.scene : null;
  const currentGraph: SceneGraph | null =
    project.source.kind === "svg" ? project.source.graph : null;
  const currentMotion: MotionDocument = project.motion;

  // Validation context for timeline and inspector
  const validationContext: ValidationContext = useMemo(() => {
    if (sourceKind === "character" && currentScene) {
      return validationContextForScene(currentScene);
    }
    if (sourceKind === "svg" && currentGraph) {
      return {
        targetKind: "svg",
        elementIds: new Set(Object.keys(currentGraph.elements)),
      };
    }
    return { targetKind: sourceKind };
  }, [sourceKind, currentScene, currentGraph]);

  // Project state mutation helper with bounded history
  const commitProjectChange = useCallback(
    (updater: (prev: AniProject) => AniProject) => {
      setHistory((prevHistory) => {
        const nextProject = updater(prevHistory.present);
        return pushHistory(prevHistory, nextProject, 50);
      });
    },
    [],
  );

  // Undo / Redo
  const handleUndo = useCallback(() => {
    setHistory((prev) => undoHistory(prev));
  }, []);

  const handleRedo = useCallback(() => {
    setHistory((prev) => redoHistory(prev));
  }, []);

  // Keyboard shortcut for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Save Project
  const handleSaveProject = useCallback(async () => {
    setIsSaving(true);
    try {
      await saveProject(project);
      setLastSaved(new Date());
      await refreshProjects();
    } catch (err) {
      console.error("Save project failed:", err);
    } finally {
      setIsSaving(false);
    }
  }, [project, refreshProjects]);

  // Load Project
  const handleLoadProject = useCallback(
    async (id: string) => {
      try {
        const loaded = await loadProject(id);
        if (loaded) {
          commitProjectChange(() => loaded);
          setChatMessages((prev) => [
            ...prev,
            {
              id: `load-${Date.now()}`,
              role: "system",
              content: `Loaded project "${loaded.name}"`,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      } catch (err) {
        console.error("Load project failed:", err);
      }
    },
    [commitProjectChange],
  );

  // Delete Project
  const handleDeleteProject = useCallback(
    async (id: string) => {
      try {
        await deleteProject(id);
        await refreshProjects();
      } catch (err) {
        console.error("Delete project failed:", err);
      }
    },
    [refreshProjects],
  );

  // Import Project JSON
  const handleImportProjectJson = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed = parseProjectJson(text);
        commitProjectChange(() => parsed);
        setSourceTab(parsed.source.kind);
        setChatMessages((prev) => [
          ...prev,
          {
            id: `import-${Date.now()}`,
            role: "system",
            content: `Imported project "${parsed.name}" from JSON`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `import-err-${Date.now()}`,
            role: "error",
            content: `Failed to import project: ${err instanceof Error ? err.message : "Invalid JSON"}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    },
    [commitProjectChange],
  );

  // Import SVG
  const handleUploadSvgFile = useCallback(
    async (file: File) => {
      if (file.size > 2 * 1024 * 1024) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `svg-size-err-${Date.now()}`,
            role: "error",
            content: `SVG exceeds 2MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB)`,
            timestamp: new Date().toISOString(),
          },
        ]);
        return;
      }

      setIsImportingSvg(true);
      try {
        const text = await file.text();
        const res = importSvg(text, { filename: file.name });
        if (!res.ok) {
          setChatMessages((prev) => [
            ...prev,
            {
              id: `svg-err-${Date.now()}`,
              role: "error",
              content: `Failed to import SVG: ${res.error.message}`,
              timestamp: new Date().toISOString(),
            },
          ]);
          return;
        }

        setImportWarnings(res.graph.warnings ?? []);
        const nextProject = buildStarterSvgProject(res.graph, text, file.name);
        commitProjectChange(() => nextProject);
        setSourceTab("svg");
        setSelectedElementIds([]);
        setHiddenTrackIds([]);

        setChatMessages((prev) => [
          ...prev,
          {
            id: `svg-success-${Date.now()}`,
            role: "assistant",
            content: `Sanitized and imported "${file.name}" (${res.graph.stats.elementCount} elements, ${res.graph.stats.animatableCount} animatable). Select an element or ask the Director to animate it.`,
            timestamp: new Date().toISOString(),
            isFallback: false,
            providerLabel: "SVG Importer",
          },
        ]);
      } catch (err) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `svg-ex-${Date.now()}`,
            role: "error",
            content: `Error reading SVG file: ${err instanceof Error ? err.message : "Unknown error"}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsImportingSvg(false);
      }
    },
    [commitProjectChange],
  );

  // New character generation (2-phase: character -> motion)
  const handleNewCharacterPrompt = useCallback(
    async (promptText: string) => {
      setIsGeneratingCharacter(true);
      setStatus({
        phase: "generating_character",
        message: "Generating character...",
      });

      const userMsgId = `user-${Date.now()}`;
      setChatMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          role: "user",
          content: `Create character: ${promptText}`,
          timestamp: new Date().toISOString(),
        },
      ]);

      try {
        // Phase 1: POST /api/studio/character with mode: "studio"
        const charRes = await fetch("/api/studio/character", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptText,
            mode: "studio",
          }),
        });

        if (!charRes.ok) {
          throw new Error(`Character generation failed (${charRes.status})`);
        }

        const charData = (await charRes.json()) as {
          scene: Scene;
          meta: { source: "ai" | "local"; provider?: string; model?: string; ms?: number };
        };

        const newScene = charData.scene;
        const charIsFallback = charData.meta.source === "local";

        // Phase 2: POST /api/animation/direct
        setStatus({
          phase: "planning_motion",
          message: "Planning motion for character...",
        });

        const charContext = characterContextForScene(newScene);
        const animReq: AnimationDirectionRequest = {
          version: 1,
          action: "generate",
          instruction: promptText,
          targetKind: "character",
          character: charContext,
          history: [],
        };

        const motionRes = await fetch("/api/animation/direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(animReq),
        });

        if (!motionRes.ok) {
          throw new Error(`Motion generation failed (${motionRes.status})`);
        }

        const motionData = (await motionRes.json()) as AnimationDirectionResponse;

        if (!motionData.ok) {
          throw new Error(motionData.error.message || "Failed to direct motion");
        }

        const newMotion = motionData.document;
        const motionIsFallback = motionData.source === "fallback";

        // Update project with both new scene and motion
        commitProjectChange((prev) => ({
          ...prev,
          name: newScene.actors[0]?.genome.name ?? "New Character",
          source: { kind: "character", scene: newScene },
          motion: newMotion,
          prompt: promptText,
        }));

        setLastResponse(motionData);
        setStatus({
          phase: "ready",
          message: "Ready",
          providerLabel: motionData.provider?.model ?? charData.meta.model,
          isFallback: charIsFallback || motionIsFallback,
        });

        setChatMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: `${motionData.explanation}`,
            timestamp: new Date().toISOString(),
            isFallback: charIsFallback || motionIsFallback,
            providerLabel: motionData.provider?.model ?? charData.meta.model,
            changes: motionData.changes,
            warnings: motionData.warnings,
          },
        ]);
      } catch (err) {
        setStatus({
          phase: "error",
          message: err instanceof Error ? err.message : "Generation failed",
        });
        setChatMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "error",
            content: err instanceof Error ? err.message : "Character generation failed.",
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsGeneratingCharacter(false);
      }
    },
    [commitProjectChange],
  );

  // Send instruction (revise motion or appearance)
  const handleSendInstruction = useCallback(async () => {
    const text = instruction.trim();
    if (!text) return;

    setInstruction("");
    const userMsgId = `user-${Date.now()}`;
    setChatMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      },
    ]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const intent = sourceKind === "character" ? classifyInstructionIntent(text) : "motion";

    try {
      if (intent === "appearance" && sourceKind === "character" && currentScene) {
        // Appearance only
        setStatus({
          phase: "generating_character",
          message: "Updating character appearance...",
        });

        const charRes = await fetch("/api/studio/character", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: text,
            previous: currentScene,
            mode: "studio",
          }),
          signal: abortController.signal,
        });

        if (!charRes.ok) throw new Error("Character update failed");
        const charData = (await charRes.json()) as {
          scene: Scene;
          meta: { source: "ai" | "local"; model?: string };
        };

        commitProjectChange((prev) => ({
          ...prev,
          source: { kind: "character", scene: charData.scene },
        }));

        const isFallback = charData.meta.source === "local";
        setStatus({
          phase: "ready",
          message: "Ready",
          providerLabel: charData.meta.model,
          isFallback,
        });

        setChatMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: "assistant",
            content: `Updated character appearance according to "${text}".`,
            timestamp: new Date().toISOString(),
            isFallback,
            providerLabel: charData.meta.model,
          },
        ]);
      } else if (intent === "motion" || sourceKind === "svg") {
        // Motion revision
        setStatus({
          phase: "planning_motion",
          message: "Directing motion revision...",
        });

        const historyContext = chatMessages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .slice(-6)
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        const body: AnimationDirectionRequest = {
          version: 1,
          action: "revise",
          instruction: text,
          targetKind: sourceKind,
          currentDocument: currentMotion,
          character: currentScene ? characterContextForScene(currentScene) : undefined,
          scene: currentGraph
            ? sceneToContext(currentGraph, { selectedElementIds })
            : undefined,
          selectedElementIds: selectedElementIds.length ? selectedElementIds : undefined,
          history: historyContext,
        };

        const res = await fetch("/api/animation/direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abortController.signal,
        });

        if (!res.ok) throw new Error(`Direction request failed (${res.status})`);
        const data = (await res.json()) as AnimationDirectionResponse;

        if (!data.ok) {
          throw new Error(data.error.message || "Failed to direct motion");
        }

        // Validate returned document client-side against the context
        const validated = validateMotionDocument(data.document, validationContext);
        if (!validated.ok) {
          throw new Error(
            `Revised document failed validation: ${validated.errors[0]?.message ?? "Invalid document"}`,
          );
        }

        const validDoc = validated.document ?? data.document;
        commitProjectChange((prev) => ({
          ...prev,
          motion: validDoc,
        }));

        setLastResponse(data);
        const isFallback = data.source === "fallback";
        setStatus({
          phase: "ready",
          message: "Ready",
          providerLabel: data.provider?.model,
          isFallback,
        });

        setChatMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: "assistant",
            content: data.explanation,
            timestamp: new Date().toISOString(),
            isFallback,
            providerLabel: data.provider?.model,
            changes: data.changes,
            warnings: data.warnings,
          },
        ]);
      } else {
        // Both appearance and motion in parallel
        setStatus({
          phase: "validating",
          message: "Applying combined appearance and motion revision...",
        });

        const charPromise = fetch("/api/studio/character", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: text,
            previous: currentScene,
            mode: "studio",
          }),
          signal: abortController.signal,
        }).then((r) => r.json());

        const motionPromise = fetch("/api/animation/direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: 1,
            action: "revise",
            instruction: text,
            targetKind: sourceKind,
            currentDocument: currentMotion,
            character: currentScene ? characterContextForScene(currentScene) : undefined,
          }),
          signal: abortController.signal,
        }).then((r) => r.json());

        const [charResult, motionResult] = await Promise.allSettled([
          charPromise,
          motionPromise,
        ]);

        let nextScene = currentScene;
        let nextMotion = currentMotion;
        let anyFallback = false;
        const notes: string[] = [];

        if (charResult.status === "fulfilled" && charResult.value?.scene) {
          nextScene = charResult.value.scene;
          if (charResult.value.meta?.source === "local") anyFallback = true;
          notes.push("Updated character styling");
        }

        if (
          motionResult.status === "fulfilled" &&
          motionResult.value?.ok &&
          motionResult.value.document
        ) {
          const valRes = validateMotionDocument(
            motionResult.value.document,
            validationContext,
          );
          if (valRes.ok) {
            nextMotion = valRes.document ?? motionResult.value.document;
            if (motionResult.value.source === "fallback") anyFallback = true;
            notes.push("Revised animation motion");
          }
        }

        commitProjectChange((prev) => ({
          ...prev,
          source: nextScene ? { kind: "character", scene: nextScene } : prev.source,
          motion: nextMotion,
        }));

        setStatus({
          phase: "ready",
          message: "Ready",
          isFallback: anyFallback,
        });

        setChatMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: "assistant",
            content: notes.length
              ? `Completed: ${notes.join(" and ")}.`
              : "Completed revisions.",
            timestamp: new Date().toISOString(),
            isFallback: anyFallback,
          },
        ]);
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setStatus({ phase: "ready", message: "Cancelled" });
        return;
      }
      setStatus({
        phase: "error",
        message: err instanceof Error ? err.message : "Revision failed",
      });
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "error",
          content: err instanceof Error ? err.message : "Direction request failed.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      abortControllerRef.current = null;
    }
  }, [
    instruction,
    sourceKind,
    currentScene,
    currentGraph,
    currentMotion,
    chatMessages,
    selectedElementIds,
    validationContext,
    commitProjectChange,
  ]);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Element selection in SVG
  const handleSelectElement = useCallback((id: string | null, additive: boolean) => {
    if (!id) {
      if (!additive) setSelectedElementIds([]);
      return;
    }
    setSelectedElementIds((prev) => {
      if (!additive) return [id];
      const set = new Set(prev);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return Array.from(set);
    });
  }, []);

  // Track visibility toggles (affects playback evaluation)
  const handleToggleTrack = useCallback((trackId: string) => {
    setHiddenTrackIds((prev) => {
      const set = new Set(prev);
      if (set.has(trackId)) set.delete(trackId);
      else set.add(trackId);
      return Array.from(set);
    });
  }, []);

  // Track Inspector Apply & Delete
  const handleApplyTrackUpdate = useCallback(
    (updatedDoc: MotionDocument) => {
      commitProjectChange((prev) => ({
        ...prev,
        motion: updatedDoc,
      }));
    },
    [commitProjectChange],
  );

  const handleDeleteTrack = useCallback(
    (trackId: string) => {
      commitProjectChange((prev) => ({
        ...prev,
        motion: {
          ...prev.motion,
          tracks: prev.motion.tracks.filter((t) => t.id !== trackId),
        },
      }));
    },
    [commitProjectChange],
  );

  // Exports
  const handleExportJson = useCallback(() => {
    downloadProject(project);
  }, [project]);

  const handleExportSvg = useCallback(() => {
    if (sourceKind !== "svg" || !currentGraph || !currentMotion) return;
    try {
      const { svg, warnings } = buildAnimatedSvg(currentGraph, currentMotion);
      downloadSvgMarkup(svg, project.name);
      if (warnings.length > 0) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `warn-${Date.now()}`,
            role: "assistant",
            content: `Animated SVG export notices:\n${warnings.join("\n")}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `svg-exp-err-${Date.now()}`,
          role: "error",
          content: `Animated SVG export failed: ${err instanceof Error ? err.message : "Unknown error"}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [sourceKind, currentGraph, currentMotion, project.name]);

  const handleExportPng = useCallback(async () => {
    try {
      let svgEl: SVGSVGElement | null = null;
      if (sourceKind === "character" && characterStageRef.current) {
        svgEl = characterStageRef.current.getSvgElement();
      } else if (sourceKind === "svg" && svgStageRef.current) {
        svgEl = svgStageRef.current.getSvgElement();
      }

      if (!svgEl) {
        // Fallback to static render
        const markup =
          sourceKind === "character" && currentScene
            ? renderToStaticMarkup(
                <SceneFrame
                  scene={currentScene}
                  t={playback.getTime()}
                  motion={currentMotion}
                />,
              )
            : currentGraph?.sanitizedSvg ?? "";
        const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
        svgEl = doc.querySelector("svg");
      }

      if (!svgEl) throw new Error("Could not capture stage frame.");
      const markup = serializeStageSvg(svgEl);
      const bg = background === "checker" ? "#FEFDF9" : "#FEFDF9";
      const blob = await svgMarkupToPng(markup, 1080, 1080, bg);
      downloadPng(blob, project.name);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `png-err-${Date.now()}`,
          role: "error",
          content: `PNG snapshot failed: ${err instanceof Error ? err.message : "Unknown error"}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [
    sourceKind,
    currentScene,
    currentGraph,
    currentMotion,
    playback,
    background,
    project.name,
  ]);

  const handleExportWebM = useCallback(async () => {
    setIsExportingWebM(true);
    setWebMProgress(0);

    const renderFrame = (time: number): SVGSVGElement | null => {
      if (sourceKind === "character" && currentScene) {
        const markup = renderToStaticMarkup(
          <SceneFrame
            scene={currentScene}
            t={time}
            motion={currentMotion}
          />,
        );
        const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
        return doc.querySelector("svg");
      }
      if (sourceKind === "svg" && currentGraph) {
        const doc = new DOMParser().parseFromString(
          currentGraph.sanitizedSvg,
          "image/svg+xml",
        );
        const svg = doc.querySelector("svg");
        if (svg && currentMotion) {
          const state = evaluateDocument(currentMotion, time, {
            hiddenTrackIds,
          });
          applySvgEvaluation(svg, currentGraph, state);
        }
        return svg;
      }
      return null;
    };

    try {
      const blob = await renderWebM(renderFrame, {
        duration: Math.min(20, currentMotion.duration),
        fps: 30,
        width: 1080,
        height: 1080,
        background: "#FEFDF9",
        onProgress: (fraction) => setWebMProgress(fraction),
      });

      downloadWebM(blob, project.name);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `webm-success-${Date.now()}`,
          role: "assistant",
          content: `WebM video exported successfully (1080×1080, 30fps).`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `webm-err-${Date.now()}`,
          role: "error",
          content: `WebM video export failed: ${err instanceof Error ? err.message : "Browser does not support MediaRecorder"}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsExportingWebM(false);
      setWebMProgress(0);
    }
  }, [sourceKind, currentScene, currentGraph, currentMotion, hiddenTrackIds, project.name]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#F1EEE6] text-[#111111]">
      {/* Slim Top Bar */}
      <StudioHeader
        projectName={project.name}
        onRename={(name) => commitProjectChange((p) => ({ ...p, name }))}
        sourceKind={sourceKind}
        status={status}
        trackCount={currentMotion.tracks.length}
        duration={currentMotion.duration}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSave={handleSaveProject}
        isSaving={isSaving}
        lastSaved={lastSaved}
        canExportSvg={sourceKind === "svg"}
        onExportJson={handleExportJson}
        onExportSvg={handleExportSvg}
        onExportPng={handleExportPng}
        onExportWebM={handleExportWebM}
        isExportingWebM={isExportingWebM}
        webMProgress={webMProgress}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Studio Body (3-Column Layout on XL, Tabbed on smaller screens) */}
      <main className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Column: Source Panel */}
        <div
          className={clsx(
            "h-full shrink-0 xl:block",
            activeTab === "source" ? "block w-full" : "hidden xl:block",
          )}
        >
          <SourcePanel
            sourceKind={sourceTab}
            onSwitchSourceKind={(kind) => {
              setSourceTab(kind);
              if (kind === "character" && !currentScene) {
                commitProjectChange(() => buildSofiaStarterProject());
              }
            }}
            scene={currentScene}
            graph={currentGraph}
            onNewCharacterPrompt={handleNewCharacterPrompt}
            isGeneratingCharacter={isGeneratingCharacter}
            onUploadSvgFile={handleUploadSvgFile}
            isImportingSvg={isImportingSvg}
            importWarnings={importWarnings}
            selectedElementIds={selectedElementIds}
            onSelectElement={handleSelectElement}
            projects={savedProjects}
            currentProjectId={project.id}
            onLoadProject={handleLoadProject}
            onDeleteProject={handleDeleteProject}
            onImportProjectJson={handleImportProjectJson}
          />
        </div>

        {/* Center: Stage + Transport + Bottom Timeline */}
        <div
          className={clsx(
            "flex min-w-0 flex-1 flex-col overflow-y-auto xl:flex",
            activeTab === "stage" ? "flex w-full" : "hidden xl:flex",
          )}
        >
          {/* Stage Controls Sub-bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D7D4CB] bg-[#FEFDF9] px-4 py-2">
            {/* Background Selector */}
            <div className="flex items-center gap-1">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#6F6759]">
                Background
              </span>
              <div className="flex rounded-[8px] border border-[#D7D4CB] bg-[#FEFDF9] p-0.5 shadow-2xs">
                {(["paper", "grid", "checker", "none"] as StageBackground[]).map((bg) => (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => setBackground(bg)}
                    className={clsx(
                      "rounded-[6px] px-2 py-0.5 font-mono text-[9px] uppercase transition-colors",
                      background === bg
                        ? "bg-[#111111] text-[#FEFDF9]"
                        : "text-[#6F6759] hover:text-[#111111]",
                    )}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </div>

            {/* Skeleton & Zoom Controls */}
            <div className="flex items-center gap-2">
              {sourceKind === "character" && (
                <button
                  type="button"
                  onClick={() => setShowSkeleton((prev) => !prev)}
                  className={clsx(
                    "flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-semibold shadow-xs transition-colors",
                    showSkeleton
                      ? "border-[#4B63FF] bg-[#4B63FF]/10 text-[#4B63FF]"
                      : "border-[#D7D4CB] bg-[#FEFDF9] text-[#6F6759] hover:bg-[#F1EEE6]",
                  )}
                >
                  <Layers size={12} />
                  <span>Skeleton</span>
                </button>
              )}

              {/* Zoom Buttons */}
              <div className="flex items-center rounded-[8px] border border-[#D7D4CB] bg-[#FEFDF9] p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(50, z - 25))}
                  title="Zoom out"
                  className="p-1 text-[#6F6759] hover:text-[#111111]"
                >
                  <ZoomOut size={13} />
                </button>
                <span className="min-w-10 text-center font-mono text-[10px] font-bold text-[#111111]">
                  {zoom}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(150, z + 25))}
                  title="Zoom in"
                  className="p-1 text-[#6F6759] hover:text-[#111111]"
                >
                  <ZoomIn size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Stage Area */}
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-5">
            {sourceKind === "character" && currentScene ? (
              <CharacterStage
                ref={characterStageRef}
                scene={currentScene}
                motion={currentMotion}
                playback={playback}
                zoom={zoom}
                background={background}
                showSkeleton={showSkeleton}
              />
            ) : sourceKind === "svg" && currentGraph ? (
              <SvgStage
                ref={svgStageRef}
                graph={currentGraph}
                document={currentMotion}
                selectedElementIds={selectedElementIds}
                hiddenTrackIds={hiddenTrackIds}
                zoom={zoom}
                background={background}
                playback={playback}
                onSelectElement={handleSelectElement}
              />
            ) : null}
          </div>

          {/* Transport Bar & Bottom Timeline */}
          <div className="border-t border-[#D7D4CB] bg-[#FEFDF9] p-3 space-y-2.5">
            <TransportBar playback={playback} reducedMotion={reducedMotion} />

            <TimelinePanel
              document={currentMotion}
              playback={playback}
              hiddenTracks={hiddenTrackIds}
              onToggleTrack={handleToggleTrack}
              validationContext={validationContext}
              onApplyTrackUpdate={handleApplyTrackUpdate}
              onDeleteTrack={handleDeleteTrack}
            />
          </div>
        </div>

        {/* Right Column: AI Director Chat */}
        <div
          className={clsx(
            "h-full shrink-0 xl:block",
            activeTab === "director" ? "block w-full" : "hidden xl:block",
          )}
        >
          <ChatPanel
            messages={chatMessages}
            instruction={instruction}
            onInstructionChange={setInstruction}
            onSend={handleSendInstruction}
            onCancel={handleCancel}
            isSending={
              status.phase === "generating_character" ||
              status.phase === "planning_motion" ||
              status.phase === "validating"
            }
            status={status}
            lastResponse={lastResponse}
            sourceKind={sourceKind}
            onSelectChip={(chip) => setInstruction(chip)}
          />
        </div>
      </main>
    </div>
  );
}
