import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CANONICAL_PRODUCTION_SITE_URL } from "@/lib/site-url";
import { INVITATION_LIBRARY_THEMES } from "./library/themes";
import index from "./library/fluent-index.json";
import type { ThemeCandidate, ThemeSearchRequest } from "./theme-search";

export const LIBRARY_CATALOG_REVISION = index.commit;
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const local = [...new Map(INVITATION_LIBRARY_THEMES.flatMap(theme => [...theme.heroes, ...theme.decorations]).filter(asset => asset.licenseId === "fluent-emoji").map(asset => [asset.src, asset])).values()];
const rawUrl = (assetPath: string) => `https://raw.githubusercontent.com/microsoft/fluentui-emoji/${index.commit}/${assetPath.split("/").map(encodeURIComponent).join("/")}`;
const aliases: Record<string, string[]> = {
  "soccer ball": ["soccer"], "american football": ["football"], "rugby football": ["rugby"],
  "cricket game": ["cricket"], "ping pong": ["table tennis"], "direct hit": ["darts"],
  "ice hockey": ["hockey"], "field hockey": ["hockey"], "curling stone": ["curling"],
  "person golfing": ["golf", "golfing"], "person swimming": ["swimming"],
  "person rowing boat": ["rowing"], "person biking": ["cycling", "biking"],
  "person surfing": ["surfing"], "skier": ["skiing"], "ice skate": ["ice skating", "skating"],
  "snowboarder": ["snowboarding", "snowboard"], "person climbing": ["climbing", "rock climbing"],
  "person lifting weights": ["weightlifting"], "person cartwheeling": ["gymnastics"],
  "bow and arrow": ["archery"], "boxing glove": ["boxing"], "martial arts uniform": ["karate", "martial arts"],
  "t rex": ["dinosaur", "dinosaurs", "trex"], "sauropod": ["dinosaur", "dinosaurs"],
};

/** Searches the repository index, not a four-sport special case. Never fuzzy-maps a team or character. */
export function localThemeCandidates(input: ThemeSearchRequest): ThemeCandidate[] {
  const key = normalize([input.query, ...input.refinements].join(" ")).replace(/(?: birthday)?(?: party)?(?: theme)?$/, "").trim();
  const rejected = new Set(input.rejected.map(normalize));
  return index.assets.flatMap(([label, assetPath]) => {
    const name = normalize(label);
    const activity = name.startsWith("person ") ? name.slice(7).replace(/^playing /, "") : "";
    const keys = [name, ...(activity ? [activity] : []), ...(aliases[name] ?? [])];
    if (!keys.includes(key) || keys.some(alias => rejected.has(alias))) return [];
    const existing = local.find(asset => normalize(asset.alt) === name || normalize(path.basename(asset.src, ".png")) === name || (name === "american football" && asset.src.endsWith("/football.png")) || (name === "soccer ball" && asset.src.endsWith("/soccer.png")));
    const imageUrl = existing ? `${CANONICAL_PRODUCTION_SITE_URL}${existing.src}` : rawUrl(assetPath);
    const title = name === "soccer ball" ? "Soccer" : label;
    return [{ id: "fluent-" + createHash("sha256").update(assetPath).digest("hex").slice(0, 24), label: title, description: `${title} artwork from Microsoft Fluent Emoji. Confirm this is the picture you want.`, imageUrl, sourceUrl: `https://github.com/microsoft/fluentui-emoji/blob/${index.commit}/${assetPath.split("/").map(encodeURIComponent).join("/")}`, franchise: title, aliases: keys }];
  }).slice(0, 4);
}

export function localThemeCandidate(input: ThemeSearchRequest): ThemeCandidate | null { return localThemeCandidates(input)[0] ?? null; }
export function isIndexedLibraryUrl(url: string): boolean { return index.assets.some(([, assetPath]) => rawUrl(assetPath) === url); }
export async function readLocalThemeArtwork(url: string): Promise<Buffer | null> {
  const asset = local.find(asset => url === `${CANONICAL_PRODUCTION_SITE_URL}${asset.src}`);
  return asset ? readFile(path.join(process.cwd(), "public", asset.src.slice(1))) : null;
}

export function invitationCatalogStatus() { return { repository: "microsoft/fluentui-emoji", revision: LIBRARY_CATALOG_REVISION, indexedAssets: index.assets.length, teamDirectory: "Wikipedia live team lookup", rule: "Check the repository and saved artwork catalog before paid search; confirm the exact team/character and picture; a search result is not a completed invitation." }; }
