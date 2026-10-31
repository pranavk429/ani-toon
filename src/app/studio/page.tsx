import type { Metadata } from "next";
import { AniStudio } from "@/components/ani-studio/AniStudio";

export const metadata: Metadata = {
  title: "ANI Vector Animation Studio",
  description:
    "AI-directed, deterministic vector animation studio. Animate procedural characters and SVGs with natural language.",
};

export default function StudioPage() {
  return <AniStudio />;
}
