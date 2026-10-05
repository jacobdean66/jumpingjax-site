import { createHash } from "node:crypto";
import { z } from "zod";
import type { ThemeCandidate, ThemeSearchRequest } from "./theme-search";

const pageSchema = z.object({ title: z.string().max(160), description: z.string().max(500).optional(), thumbnail: z.object({ source: z.string().url() }).optional(), pageprops: z.object({ disambiguation: z.unknown().optional() }).optional() });
const sports = /\b(teams?|clubs?|athletic|athletics|sports|nfl|nba|mlb|nhl|ncaa|football|basketball|baseball|hockey|soccer|rugby|cricket|volleyball|lacrosse)\b/i;

/** A directory name match is a choice for the user, not permission to use unrelated art. */
export function teamCandidatesFromPages(value: unknown, input: ThemeSearchRequest): ThemeCandidate[] {
  const response = z.object({ query: z.object({ pages: z.array(z.unknown()) }) }).safeParse(value);
  if (!response.success) return [];
  const rejected = new Set(input.rejected.map(label => label.toLowerCase()));
  return response.data.query.pages.flatMap(raw => {
    const parsed = pageSchema.safeParse(raw);
    if (!parsed.success) return [];
    const page = parsed.data;
    if (!page.thumbnail || page.pageprops?.disambiguation !== undefined || !sports.test(page.description ?? "") || !/\b(teams?|clubs?|franchise|athletic(?:s)? program)\b/i.test(page.description ?? "") || /\b(player|footballer|coach|director|manager|quarterback|pitcher)\b/i.test(page.description ?? "") || /^(?:\d{4}|list of)\b|cheerleader|season|history/i.test(page.title) || rejected.has(page.title.toLowerCase())) return [];
    const image = new URL(page.thumbnail.source);
    if (image.protocol !== "https:" || image.username || image.password || image.port || !["upload.wikimedia.org", "thumb.wikimedia.org"].includes(image.hostname)) return [];
    return [{ id: "team-" + createHash("sha256").update(page.title).digest("hex").slice(0,24), label: page.title, description: `${page.description ?? "Sports team"}. Picture from its Wikipedia directory page; confirm the name and picture.`, imageUrl: image.href, sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`, franchise: page.title }];
  }).slice(0, 4);
}

export async function findTeamCandidates(input: ThemeSearchRequest, signal?: AbortSignal): Promise<ThemeCandidate[]> {
  const query = [input.query, ...input.refinements].join(" ").replace(/[^\p{L}\p{N}\s'-]/gu, " ").slice(0,400);
  const url = new URL("https://en.wikipedia.org/w/api.php");
  const parameters = new URLSearchParams({ action: "query", generator: "search", gsrsearch: query.toLowerCase() === "usc" ? '"USC Trojans" OR "South Carolina Gamecocks"' : query, gsrlimit: "6", prop: "pageimages|pageprops|description", piprop: "thumbnail", pilicense: "any", pithumbsize: "600", ppprop: "disambiguation", format: "json", formatversion: "2" });
  if (query.toLowerCase() === "usc") { parameters.delete("generator"); parameters.delete("gsrsearch"); parameters.delete("gsrlimit"); parameters.set("titles", "USC Trojans|South Carolina Gamecocks"); }
  url.search = parameters.toString();
  try {
    const response = await fetch(url, { headers: { "User-Agent": "JumpingJax-Invitation-Designer/1.0 (https://jumpingjaxllc.com)" }, signal: AbortSignal.any([AbortSignal.timeout(5000), ...(signal ? [signal] : [])]) });
    if (!response.ok || Number(response.headers.get("content-length") || 0) > 200000) return [];
    const body = await response.text();
    return body.length <= 200000 ? teamCandidatesFromPages(JSON.parse(body), input) : [];
  } catch { return []; }
}

