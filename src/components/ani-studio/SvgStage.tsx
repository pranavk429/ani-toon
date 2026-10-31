"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from "react";
import type { SceneGraph } from "@/lib/svg/types";
import type { MotionDocument } from "@/lib/animation/types";
import { SvgCanvas } from "./SvgCanvas";
import type { PlaybackChannel, StageBackground } from "./types";
import type { StageHandle } from "./CharacterStage";

export type SvgStageProps = {
  graph: SceneGraph;
  document: MotionDocument | null;
  selectedElementIds: string[];
  hiddenTrackIds: string[];
  zoom: number;
  background: StageBackground;
  playback: PlaybackChannel;
  onSelectElement: (id: string | null, additive: boolean) => void;
};

function getBackgroundStyle(bg: StageBackground): CSSProperties {
  switch (bg) {
    case "checker":
      return {
        backgroundImage:
          "repeating-conic-gradient(#EFECE4 0% 25%, #FEFDF9 0% 50%)",
        backgroundSize: "20px 20px",
      };
    case "grid":
      return {
        backgroundColor: "#FEFDF9",
        backgroundImage:
          "linear-gradient(#EFECE4 1px, transparent 1px), linear-gradient(90deg, #EFECE4 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      };
    case "paper":
      return { backgroundColor: "#FEFDF9" };
    default:
      return { backgroundColor: "#F1EEE6" };
  }
}

export const SvgStage = forwardRef<StageHandle, SvgStageProps>(
  function SvgStage(
    {
      graph,
      document,
      selectedElementIds,
      hiddenTrackIds,
      zoom,
      background,
      playback,
      onSelectElement,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useImperativeHandle(ref, () => ({
      getSvgElement: () => {
        return containerRef.current?.querySelector("svg") ?? null;
      },
    }));

    return (
      <div
        ref={containerRef}
        style={{
          ...getBackgroundStyle(background),
        }}
        className="relative mx-auto flex h-full min-h-0 w-full max-w-[800px] items-center justify-center overflow-hidden rounded-[16px] border border-[#D7D4CB] p-4 shadow-md"
      >
        <SvgCanvas
          graph={graph}
          document={document}
          selectedElementIds={selectedElementIds}
          hiddenTrackIds={hiddenTrackIds}
          zoom={zoom}
          onSelectElement={onSelectElement}
          subscribeTime={playback.subscribeTime}
          getTime={playback.getTime}
        />
      </div>
    );
  },
);
