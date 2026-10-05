import { createHash } from "node:crypto";
import { publicHttps } from "./public-resource";
import { safeProviderFailure, type ProviderFailure } from "./provider-failure";
import { uncertainInvitationIdentity } from "./artwork-policy";

export type SearchInput = { query: string; refinements: string[]; rejected: string[] };
export type Candidate = { id: string; label: string; description: string; imageUrl: string; sourceUrl: string; franchise?: string; aliases?: string[] };
type Citation = { url: string; title: string };
export type Evidence = { id: string; imageUrl: string; sourceUrl: string; sourceTitle: string; dataUrl: string };
export type SearchDependencies = {
  search: (input: SearchInput, signal: AbortSignal) => Promise<unknown>;
  readHtml: (url: string, signal: AbortSignal) => Promise<string>;
  prepareImage: (url: string, signal: AbortSignal) => Promise<string>;
  inspect: (input: SearchInput, images: Evidence[], signal: AbortSignal) => Promise<unknown>;
  report?: (counts: { citedPages: number; loadedPages: number; declaredImages: number; usableImages: number; candidates: number }) => void;
};

export type ThemeChatCapabilityCode = "protected_gateway_not_configured" | "protected_chat_search_rejected" | "protected_vision_rejected" | "chat_response_incomplete" | "chat_search_citations_missing" | "vision_response_invalid" | "source_images_unavailable" | "search_deadline_exceeded";
export class ThemeChatCapabilityError extends Error {
  code: ThemeChatCapabilityCode;
  status?: number;
  providerType?: ProviderFailure["providerType"];
  providerErrorType?: ProviderFailure["providerErrorType"];
  constructor(code: ThemeChatCapabilityCode, error?: unknown) {
    super(code); this.name = "ThemeChatCapabilityError"; this.code = code;
    if (error !== undefined) Object.assign(this, safeProviderFailure(error));
  }
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown, limit: number): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= limit ? value.trim() : null;
}
function message(response: unknown): Record<string, unknown> {
  const choices = object(response)?.choices;
  const choice = Array.isArray(choices) ? object(choices[0]) : null;
  const result = object(choice?.message);
  if (!result || choice?.finish_reason !== "stop" || result.refusal) throw new ThemeChatCapabilityError("chat_response_incomplete");
  return result;
}

/** Generated content never supplies source URLs: only provider citation annotations do. */
export function citedSources(response: unknown): Citation[] {
  const annotations = message(response).annotations;
  const result: Citation[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(annotations) ? annotations : []) {
    const annotation = object(item);
    const citation = object(annotation?.url_citation);
    const value = citation?.url;
    if (annotation?.type !== "url_citation" || typeof value !== "string" || !publicHttps(value)) continue;
    const url = new URL(value); url.hash = "";
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    result.push({ url: url.href, title: text(citation?.title, 300) ?? "Cited theme reference" });
    if (result.length === 4) break;
  }
  if (!result.length) throw new ThemeChatCapabilityError("chat_search_citations_missing");
  return result;
}

function decode(value: string): string {
  const entities: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (whole, entity: string) => {
    if (!entity.startsWith("#")) return entities[entity.toLowerCase()] ?? whole;
    const point = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : "";
  });
}

/** Small head-metadata reader; malformed/unsupported metadata is discarded. */
export function declaredImages(html: string, source: string): string[] {
  if (!publicHttps(source) || Buffer.byteLength(html) > 512 * 1024) return [];
  const head = html.split(/<\/head\s*>/i)[0]
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .replace(/<(script|style|template|noscript|textarea|title|xmp|iframe|noembed|plaintext)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, "");
  const images = new Set<string>();
  for (const match of head.matchAll(/<meta\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi)) {
    const attrs = new Map<string, string>();
    const attribute = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    for (const part of match[0].slice(5, -1).matchAll(attribute)) {
      const name = part[1].toLowerCase();
      if (!attrs.has(name)) attrs.set(name, decode(part[2] ?? part[3] ?? part[4] ?? ""));
    }
    const property = (attrs.get("property") ?? attrs.get("name") ?? "").toLowerCase();
    if (!["og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src"].includes(property)) continue;
    const value = attrs.get("content")?.trim();
    // Unknown entity spellings cannot be faithfully interpreted without a full parser.
    if (!value || /&(?:#\w+|[a-z]+);/i.test(value)) continue;
    try {
      const url = new URL(value, source); url.hash = "";
      if (publicHttps(url.href)) images.add(url.href);
    } catch { /* Invalid metadata is not a candidate. */ }
    if (images.size === 2) break;
  }
  return [...images];
}

/** Structured publisher images and descriptive inline images supplement social metadata.
 * Every URL still passes public-host validation, a bounded download and vision checks. */
export function sourceImages(html: string, source: string): string[] {
  if (Buffer.byteLength(html) > 512 * 1024 || !publicHttps(source)) return [];
  // Publisher OG tags frequently point to a 200px avatar or a site logo. They
  // must not occupy both download slots before actual character art is read.
  const urls = new Set<string>();
  function add(value: unknown) {
    if (typeof value !== 'string' || value.length > 4096 || urls.size >= 2) return;
    try { const url = new URL(decode(value), source); if (publicHttps(url.href)) urls.add(url.href); } catch { /* Invalid publisher URL. */ }
  }
  function visit(value: unknown, depth = 0) {
    if (depth > 8 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.slice(0, 12).forEach(item => visit(item, depth + 1)); return; }
    const row = value as Record<string, unknown>;
    if (row['@type'] === 'ImageObject') { add(row.contentUrl); add(row.url); }
    if (typeof row.image === 'string') add(row.image);
    else visit(row.image, depth + 1);
    visit(row['@graph'], depth + 1);
  }
  for (const script of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(script[1])); } catch { /* Malformed structured data is ignored. */ }
  }
  const structured = [...urls];
  urls.clear();
  const body = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const inline = [...body.matchAll(/<img\b[^>]{0,8000}>/gi)].flatMap(image => {
    const attrs = new Map<string, string>();
    for (const part of image[0].slice(4, -1).matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      const name = part[1].toLowerCase();
      if (!attrs.has(name)) attrs.set(name, decode(part[2] ?? part[3] ?? ""));
    }
    const src = attrs.get('src') ?? attrs.get('data-src');
    const alt = attrs.get('alt') ?? '';
    if (!src || /logo|icon|avatar|tracking|pixel|spacer|badge|pattern/i.test(`${alt} ${src}`) || /\.svg(?:[?#]|$)/i.test(src)) return [];
    const dimensions = attrs.get('data-image-dimensions')?.split('x').map(Number);
    const width = Number(attrs.get('width') ?? dimensions?.[0]);
    const height = Number(attrs.get('height') ?? dimensions?.[1]);
    if (alt.trim().length < 12 && !(width >= 240 && height >= 240)) return [];
    const character = /character|cast|key.?art|hero/i.test(`${alt} ${src}`);
    return [{ src, rank: character ? 0 : 1 }];
  }).sort((a,b) => a.rank-b.rank);
  for (const image of inline) {
    add(image.src);
    if (urls.size >= 2) break;
  }
  for (const image of structured) add(image);
  for (const image of declaredImages(html, source)) add(image);
  return [...urls];
}

const clarification = "I couldn’t verify a suitable picture yet. Which show, character, group, or distinctive detail should I look for?";

function inspectedCandidates(response: unknown, evidence: Evidence[], input: SearchInput): { question: string; candidates: Candidate[] } {
  const content = message(response).content;
  if (typeof content !== "string" || content.length > 16000) throw new ThemeChatCapabilityError("vision_response_invalid");
  let answer: Record<string, unknown> | null;
  try { answer = object(JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""))); }
  catch { throw new ThemeChatCapabilityError("vision_response_invalid"); }
  if (!answer || !Array.isArray(answer.matches) || answer.matches.length > 8) throw new ThemeChatCapabilityError("vision_response_invalid");
  const byId = new Map(evidence.map(image => [image.id, image]));
  const seen = new Set<string>();
  const rejected = new Set(input.rejected.map(value => value.toLowerCase().trim()));
  const candidates: Candidate[] = [];
  for (const raw of answer.matches) {
    const match = object(raw);
    const label = text(match?.label, 160);
    const description = text(match?.description, 500);
    const image = typeof match?.image_id === "string" ? byId.get(match.image_id) : undefined;
    if (!image || !label || !description || uncertainInvitationIdentity(label,description) || seen.has(image.imageUrl) || rejected.has(label.toLowerCase()) ||
      match?.identity_matches !== true || match.child_appropriate !== true || match.suitable_artwork !== true) continue;
    seen.add(image.imageUrl);
    candidates.push({ id: image.id, label, description, imageUrl: image.imageUrl, sourceUrl: image.sourceUrl,
      franchise: text(match.franchise, 160) ?? label,
      aliases: Array.isArray(match.aliases) ? match.aliases.map(value => text(value,160)).filter((value): value is string => Boolean(value)).slice(0,12) : [],
    });
    if (candidates.length === 4) break;
  }
  return { question: candidates.length ? text(answer.question, 400) ?? "Which picture matches the theme you want?" : clarification, candidates };
}

export async function searchThemesWithChat(input: SearchInput, dependencies: SearchDependencies, signal = AbortSignal.timeout(150000)) {
  const sources = citedSources(await dependencies.search(input, signal));
  signal.throwIfAborted();
  const pages = await Promise.allSettled(sources.map(async source => ({
    source, urls: sourceImages(await dependencies.readHtml(source.url, signal), source.url),
  })));
  signal.throwIfAborted();
  const references = pages.flatMap(page => page.status === "fulfilled" ? page.value.urls.map(imageUrl => ({ ...page.value.source, imageUrl })) : []);
  const unique = references.filter((image, index) => references.findIndex(other => other.imageUrl === image.imageUrl) === index);
  const prepared: PromiseSettledResult<Evidence>[] = [];
  // Decode at most two images at once; eight full-resolution decodes can exhaust
  // serverless memory even when each individual image is within its pixel limit.
  for (let start = 0; start < unique.length; start += 2) {
    signal.throwIfAborted();
    prepared.push(...await Promise.allSettled(unique.slice(start, start + 2).map(async image => ({
      id: createHash("sha256").update(`${image.url}\n${image.imageUrl}`).digest("hex"),
      sourceUrl: image.url, sourceTitle: image.title, imageUrl: image.imageUrl,
      dataUrl: await dependencies.prepareImage(image.imageUrl, signal),
    }))));
  }
  signal.throwIfAborted();
  const evidence = prepared.flatMap(image => image.status === "fulfilled" && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image.value.dataUrl) && image.value.dataUrl.length <= 400000 ? [image.value] : []);
  const report = (candidates: number) => dependencies.report?.({ citedPages: sources.length, loadedPages: pages.filter(page => page.status === "fulfilled").length, declaredImages: unique.length, usableImages: evidence.length, candidates });
  if (!evidence.length) { report(0); return { question: clarification, candidates: [] as Candidate[] }; }
  const inspected = await dependencies.inspect(input, evidence, signal);
  signal.throwIfAborted();
  const result = inspectedCandidates(inspected, evidence, input);
  report(result.candidates.length);
  return result;
}
