/**
 * Fixture loading helpers for integration and export tests.
 *
 * Fixtures are deterministic, hand-authored documents. No generated artwork,
 * no third-party art, no model output.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixtureRoot = dirname(fileURLToPath(import.meta.url));

export function fixturePath(name: string): string {
  return join(fixtureRoot, "svg", name);
}

export function readSvgFixture(name: string): string {
  return readFileSync(fixturePath(name), "utf8");
}

export const VALID_SVG_FIXTURES = [
  "rocket.svg",
  "plant.svg",
  "coffee.svg",
  "character.svg",
  "logo.svg",
  "nested-transforms.svg",
  "unnamed.svg",
] as const;

export type ValidSvgFixture = (typeof VALID_SVG_FIXTURES)[number];
