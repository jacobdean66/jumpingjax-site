import { safeResearchText } from "./tech-search";
import type { SupervisorSnapshot } from "./supervisor";

export type ReplyHistory = { question: string; reply: string };

export function supervisorReplyContext(message: string, snapshot: SupervisorSnapshot) {
  const context: Record<string, unknown> = {
    capabilities: [
      "Discuss and plan invitation design, wording, layout, templates, printing and the editing experience. The existing invitation builder is under Front Desk > Make / Print Invitations.",
      "Check website health, bookings/calendars, rental catalog, agent connections and answering-machine readiness.",
      "Public-page Code repairs can prepare a tested draft PR. This conversation cannot edit source, redesign a builder, deploy changes, or send customer messages.",
    ],
  };
  if (/\b(check|status|health|warnings?|errors?|fail\w*|connect\w*|bookings?|calendars?|rentals?|calls?)\b/i.test(message)) {
    context.checkedAt = snapshot.generatedAt;
    context.website = snapshot.website;
    context.bookings = snapshot.bookings;
    context.agents = snapshot.agents;
    context.issues = snapshot.issues.slice(0, 5).map(issue => ({ area: issue.area, summary: safeResearchText(issue.summary) }));
  }
  return context;
}

/** Split older single-paragraph status dumps without discarding their saved details. */
export function readableReplyParagraphs(text: string): string[] {
  const paragraphs = text.trim().split(/\n\s*\n/).filter(Boolean);
  if (paragraphs.length !== 1 || text.length < 400 || text.includes("\n")) return paragraphs;
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  const groups: string[] = [];
  for (const sentence of sentences) {
    const last = groups.at(-1);
    if (last && last.length + sentence.length < 300) groups[groups.length - 1] = `${last} ${sentence.trim()}`;
    else groups.push(sentence.trim());
  }
  return groups;
}
