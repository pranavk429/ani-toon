"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import clsx from "clsx";
import type { Scene } from "@/creature/types";
import { SceneFrame } from "@/creature/render";
import type { MotionDocument } from "@/lib/animation/types";
import type { PlaybackChannel, StageBackground } from "./types";

export type CharacterStageProps = {
  scene: Scene;
  motion: MotionDocument | null;
  playback: PlaybackChannel;
  zoom: number;
  background: StageBackground;
  showSkeleton: boolean;
};

export type StageHandle = {
  getSvgElement: () => SVGSVGElement | null;
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

export const CharacterStage = forwardRef<StageHandle, CharacterStageProps>(
  function CharacterStage(
    {
      scene,
      motion,
      playback,
      zoom,
      background,
      showSkeleton,
    },
    ref,
  ) {
    // Only CharacterStage re-renders as time advances, not the whole page!
    const [currentTime, setCurrentTime] = useState(() => playback.getTime());
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      return playback.subscribeTime((time) => {
        setCurrentTime(time);
      });
    }, [playback]);

    useImperativeHandle(ref, () => ({
      getSvgElement: () => {
        return containerRef.current?.querySelector("svg") ?? null;
      },
    }));

    const scale = Math.max(0.5, Math.min(1.5, zoom / 100));

    return (
      <div
        ref={containerRef}
        style={{
          ...getBackgroundStyle(background),
          height: "100%",
          maxHeight: "100%",
          maxWidth: "100%",
          aspectRatio: "1 / 1",
          transform: `scale(${scale})`,
          transformOrigin: "center",
        }}
        className="relative mx-auto flex items-center justify-center overflow-hidden rounded-[16px] border border-[#D7D4CB] shadow-md transition-transform duration-150"
      >
        <div className="h-full w-full">
          <SceneFrame
            scene={scene}
            t={currentTime}
            motion={motion}
            showSkeleton={showSkeleton}
          />
        </div>
      </div>
    );
  },
);
