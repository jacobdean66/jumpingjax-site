import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CANONICAL_PRODUCTION_SITE_URL } from "@/lib/site-url";
import type { ThemeCandidate, ThemeSearchRequest } from "./theme-search";

const sports = new Map([
  ["soccer", ["Soccer", "soccer.png"]],
  ["basketball", ["Basketball", "basketball.png"]],
  ["baseball", ["Baseball", "baseball.png"]],
  ["football", ["American football", "football.png"]],
]);

/** Exact general subjects only; team/character/refined requests still use search. */
export function localThemeCandidate(input: ThemeSearchRequest): ThemeCandidate | null {
  if (input.refinements.length) return null;
  const key = input.query.toLowerCase().trim().replace(/\s+(?:birthday|party|theme)(?:\s+theme)?$/, "");
  const match = sports.get(key);
  if (!match || input.rejected.some(label => label.toLowerCase().includes(key) || label.toLowerCase() === match[0].toLowerCase())) return null;
  const [label, file] = match;
  const imageUrl = `${CANONICAL_PRODUCTION_SITE_URL}/invitation-library/themes/sports/${file}`;
  return { id: createHash("sha256").update(imageUrl).digest("hex"), label, description: `A ${label.toLowerCase()} ball from the Jumping Jax invitation artwork library.`, imageUrl, sourceUrl: imageUrl, franchise: label, aliases: [key] };
}

export async function readLocalThemeArtwork(url: string): Promise<Buffer | null> {
  const file = [...sports.values()].find(([, name]) => url === `${CANONICAL_PRODUCTION_SITE_URL}/invitation-library/themes/sports/${name}`)?.[1];
  return file ? readFile(path.join(process.cwd(), "public", "invitation-library", "themes", "sports", file)) : null;
}
