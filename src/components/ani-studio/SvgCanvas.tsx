"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { applySvgEvaluation, evaluateDocument } from "@/lib/animation";
import type { MotionDocument, RuntimeSnapshot } from "@/lib/animation/types";
import type { SceneGraph } from "@/lib/svg/types";

export type SvgCanvasProps = {
  graph: SceneGraph;
  document: MotionDocument | null;
  selectedElementIds: string[];
  hiddenTrackIds: string[];
  zoom: number;
  onSelectElement: (id: string | null, additive: boolean) => void;
  subscribeTime?: (listener: (time: number, duration: number) => void) => () => void;
  getTime: () => number;
};

function elementSelector(id: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return `#${CSS.escape(id)}`;
  }
  return `[id="${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
}

/**
 * Renders the importer's sanitized serialization only. No raw upload ever
 * reaches dangerouslySetInnerHTML; the scene graph is the trust boundary.
 */
export function SvgCanvas({
  graph,
  document,
  selectedElementIds,
  hiddenTrackIds,
  zoom,
  onSelectElement,
  subscribeTime,
  getTime,
}: SvgCanvasProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const overlayRects = useRef<Record<string, HTMLDivElement | null>>({});
  const animatableIds = useMemo(() => new Set(graph.order), [graph]);

  const updateOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const origin = overlay.getBoundingClientRect();
    const svg = canvas.querySelector("svg");

    for (const id of selectedElementIds) {
      const rect = overlayRects.current[id];
      if (!rect) continue;
      const element = svg?.querySelector(elementSelector(id)) ?? null;
      if (!element) {
        rect.style.display = "none";
        continue;
      }
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) {
        rect.style.display = "none";
        continue;
      }
      rect.style.display = "block";
      rect.style.left = `${box.left - origin.left}px`;
      rect.style.top = `${box.top - origin.top}px`;
      rect.style.width = `${box.width}px`;
      rect.style.height = `${box.height}px`;
    }
  }, [selectedElementIds]);

  const paintAtTime = useCallback(
    (time: number) => {
      const svg = canvasRef.current?.querySelector("svg");
      if (!svg || !document) return;
      const state = evaluateDocument(document, time, {
        hiddenTrackIds,
      });
      applySvgEvaluation(svg as SVGSVGElement, graph, state);
      updateOverlay();
    },
    [document, graph, hiddenTrackIds, updateOverlay],
  );

  // Deterministic paint at current timestamp when document or graph changes
  useEffect(() => {
    const time = getTime();
    paintAtTime(time);
  }, [graph, document, hiddenTrackIds, getTime, paintAtTime]);

  // Live evaluation via subscribeTime
  useEffect(() => {
    if (!document || !subscribeTime) {
      updateOverlay();
      return;
    }
    const unsubscribe = subscribeTime((time) => paintAtTime(time));
    updateOverlay();
    return unsubscribe;
  }, [document, subscribeTime, paintAtTime, updateOverlay]);

  // Align selection outline on window/container resize
  useEffect(() => {
    const update = () => updateOverlay();
    window.addEventListener("resize", update);
    const observer =
      typeof ResizeObserver !== "undefined" && frameRef.current
        ? new ResizeObserver(update)
        : null;
    if (observer && frameRef.current) observer.observe(frameRef.current);
    return () => {
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [updateOverlay]);

  // Zoom changes
  useEffect(() => {
    updateOverlay();
  }, [zoom, updateOverlay]);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const root = canvasRef.current;
    if (!root) return;
    const target = event.target as Element | null;
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;

    if (!target || !root.contains(target)) {
      onSelectElement(null, additive);
      return;
    }
    if (target.closest("defs")) return;

    let node: Element | null = target;
    while (node && node !== root) {
      const id = node.getAttribute("id");
      if (id && graph.elements[id] && animatableIds.has(id)) {
        onSelectElement(id, additive);
        return;
      }
      node = node.parentElement;
    }
    if (!additive) onSelectElement(null, false);
  };

  const surfaceStyle: CSSProperties = {
    width: `${Math.max(50, Math.min(200, zoom))}%`,
    maxWidth: "100%",
  };

  return (
    <div ref={frameRef} className="relative mx-auto min-w-0" style={surfaceStyle}>
      <div
        ref={canvasRef}
        onClick={handleClick}
        className="relative cursor-crosshair select-none [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: graph.sanitizedSvg }}
        aria-label={`${graph.title || graph.filename || "Imported"} artwork. Click an element to select it.`}
        role="group"
      />
      <div ref={overlayRef} className="pointer-events-none absolute inset-0">
        {selectedElementIds.map((id) => (
          <div
            key={id}
            ref={(element) => {
              overlayRects.current[id] = element;
            }}
            aria-hidden="true"
            className="absolute rounded-[2px] border-2 border-[#4B63FF] shadow-[0_0_0_1px_rgba(254,253,249,0.9),0_0_0_4px_rgba(75,99,255,0.16)]"
            style={{ display: "none" }}
          />
        ))}
      </div>
    </div>
  );
}
