import { z } from "zod";

export const TECH_SEARCH_JOB_TYPE = "supervisor.tech-search";
export const TECH_SEARCH_DOMAINS = ["nextjs.org", "react.dev", "supabase.com", "vercel.com", "developers.openai.com", "platform.openai.com", "nodejs.org", "developer.mozilla.org", "postgresql.org", "trigger.dev", "resend.com", "developers.facebook.com", "developers.google.com", "learn.microsoft.com", "support.google.com", "github.com"];

export const techSearchRequestSchema = z.object({
  question: z.string().trim().min(5, "Enter a technical question.").max(600),
  issueCode: z.string().trim().min(1).max(200).optional(),
  requestId: z.uuid(),
}).strict();

export function safeResearchText(value: string): string {
  return value
    .replace(/\b(?:sk|aithura)[-_][a-zA-Z0-9_-]{12,}\b/g, "[redacted key]")
    .replace(/\b(?:password|secret|api[-_ ]?key|access[-_ ]?token|authorization)\b\s*[:=]\s*\S+|\bbearer\s+[a-z0-9._~-]{8,}/gi, "[redacted credential]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
    .replace(/\b(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/g, "[redacted phone]")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

export function validateResearchQuestion(question: string) {
  if (safeResearchText(question) !== question) throw new Error("Remove credentials, email addresses, and phone numbers before searching.");
  return question;
}

export function officialResearchUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const docParams = new Set(["view", "tabs", "tab", "hl", "lang", "locale", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref", "trk"]);
    if ([...url.searchParams.keys()].some(key => !docParams.has(key))) return false;
    if (!TECH_SEARCH_DOMAINS.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) return false;
    if (url.hostname === "github.com" && !/^\/(?:vercel|facebook|supabase|openai|nodejs|postgres|triggerdotdev|resend|jacobdean66)\//.test(url.pathname)) return false;
    return true;
  } catch { return false; }
}

const citationSchema = z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive(), url: z.string().refine(officialResearchUrl), title: z.string().min(1).max(300) });
export const techSearchReportSchema = z.object({
  id: z.uuid(), question: z.string(), issueCode: z.string().optional(),
  searchedAt: z.iso.datetime(), snapshotAt: z.iso.datetime(), deploymentSha: z.string().nullable(),
  answer: z.string().min(1).max(20000), citations: z.array(citationSchema).min(1).max(40),
});
export type TechSearchReport = z.infer<typeof techSearchReportSchema>;
export type ResearchAnswer = Pick<TechSearchReport, "answer" | "citations">;

/** Only provider citation annotations become links; generated Markdown is plain text. */
export function parseResearchAnswer(text: string, annotations: unknown[]): ResearchAnswer {
  if (!text.trim() || text.length > 20000) throw new Error("Research returned an incomplete answer.");
  const citations: ResearchAnswer["citations"] = [];
  for (const raw of annotations) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    if (item.type !== "url_citation") continue;
    const value = item.url_citation && typeof item.url_citation === "object" ? item.url_citation as Record<string, unknown> : item;
    const parsed = citationSchema.safeParse({ start: value.start_index, end: value.end_index, url: value.url, title: value.title });
    if (!parsed.success || parsed.data.end > text.length || parsed.data.start >= parsed.data.end) throw new Error("Research did not return verifiable official-source citations.");
    citations.push(parsed.data);
  }
  citations.sort((a, b) => a.start - b.start);
  if (!citations.length || citations.length > 40 || citations.some((c, i) => i > 0 && c.start < citations[i - 1].end)) throw new Error("Research did not return verifiable official-source citations.");
  return { answer: text, citations };
}
