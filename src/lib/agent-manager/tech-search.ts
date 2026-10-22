import { z } from "zod";
import type { SupervisorIssue } from "./supervisor";

const SEARCH_FAILURES = {
  citations_missing: "The search returned no verifiable web sources. Try a more specific technical question, or use Explain finding for a dashboard notice.",
  citations_invalid: "The search returned sources that could not be verified. Try a more specific question using the product name.",
  incomplete: "The search did not finish its answer. You can start another search.",
  connection: "The AI search service could not complete this request. Please try again shortly.",
  timeout: "The AI search took too long. Please try a shorter, more specific question.",
  not_configured: "Tech Search needs the existing protected AI connection.",
  save_failed: "The search finished, but its report could not be saved. Please check saved research before trying again.",
} as const;
export class TechSearchError extends Error {
  constructor(readonly code: keyof typeof SEARCH_FAILURES) { super(SEARCH_FAILURES[code]); this.name = "TechSearchError"; }
}

export function isFindingExplanationQuestion(question: string) {
  const normalized = question.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[?.!]+$/g, "").replace(/\s+/g, " ");
  return /^(?:what(?:'s| is) (?:this|that)|what does (?:this|that|this finding|this notice) mean|explain(?: (?:this|that|this finding|this notice))?(?: to me)?|tell me (?:about|what) (?:this|that)(?: means)?)$/.test(normalized);
}

export const findingExplanationSchema = z.object({
  issueCode: z.string(), checkedAt: z.iso.datetime(), summary: z.string(), meaning: z.string(),
  nextSteps: z.array(z.string()), href: z.string().regex(/^\/admin\/[a-z0-9/-]+(?:#[a-z0-9-]+)?$/i),
});
export type FindingExplanation = z.infer<typeof findingExplanationSchema>;

export function buildFindingExplanation(issue: SupervisorIssue, checkedAt: string): FindingExplanation {
  const href = { website: "/admin/site-settings", bookings: "/admin/rentals", rentals: "/admin/rentals", agents: "/admin/agents#agent-controls", answering_machine: "/admin/answering-machine", security: "/admin/security" }[issue.area];
  const specific = issue.code === "answering-machine:review" ? {
    meaning: "These are saved call or intake records that have not completed owner review. This count alone does not establish that they are real customer calls; test records can also appear here.",
    nextSteps: ["Open the Answering Machine inbox below.", "Check each record's source, date, transcript, and recording when available to distinguish customer calls from tests.", "Review the request before changing its review status or creating a booking."],
  } : issue.code === "answering-machine:setup" || issue.code === "answering-machine:acceptance" ? {
    meaning: "The answering service still needs setup or a controlled live test. Saved records and configured credentials do not prove incoming calls are working.",
    nextSteps: ["Open the Answering Machine setup and review its missing requirements.", "Complete a controlled call and recording playback test before treating the service as live."],
  } : {
    meaning: `This is a ${issue.severity === "info" ? "status notice" : "finding that needs attention"} from the current website check. It describes what the dashboard observed; it does not by itself establish a technical cause.`,
    nextSteps: ["Open the related workspace below and review the current details.", "If you need technical guidance, ask a specific question using the affected product or error message and search official sources."],
  };
  return { issueCode: issue.code, checkedAt, summary: safeResearchText(issue.summary), ...specific, href };
}

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
  if (!text.trim() || text.length > 20000) throw new TechSearchError("incomplete");
  const citations: ResearchAnswer["citations"] = [];
  for (const raw of annotations) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    if (item.type !== "url_citation") continue;
    const value = item.url_citation && typeof item.url_citation === "object" ? item.url_citation as Record<string, unknown> : item;
    const parsed = citationSchema.safeParse({ start: value.start_index, end: value.end_index, url: value.url, title: value.title });
    if (!parsed.success || parsed.data.end > text.length || parsed.data.start >= parsed.data.end) throw new TechSearchError("citations_invalid");
    citations.push(parsed.data);
  }
  citations.sort((a, b) => a.start - b.start);
  if (!citations.length) throw new TechSearchError("citations_missing");
  if (citations.length > 40 || citations.some((c, i) => i > 0 && c.start < citations[i - 1].end)) throw new TechSearchError("citations_invalid");
  return { answer: text, citations };
}
