import { safeResearchText } from "./tech-search";
import type { SupervisorSnapshot } from "./supervisor";
import { isCodeRepairRequest } from "./code-repair";

export type ReplyHistory = { question: string; reply: string };

/** Navigation only: discussing coding never submits or approves a repair. */
export function codingConversationAction(message: string) {
  return /\b(code|coding|programming)\b/i.test(message) || isCodeRepairRequest(message)
    ? { kind: "code_repair" as const, label: "Open website code repairs", href: "/admin/agents#code-repairs" }
    : null;
}

export function supervisorReplyContext(message: string, snapshot: SupervisorSnapshot) {
  const coding = snapshot.wiring.find(agent => agent.key === "coding");
  const context: Record<string, unknown> = {
    capabilities: [
      "Discuss and plan invitation design, wording, layout, templates, printing and the editing experience. The existing invitation builder is under Front Desk > Make / Print Invitations.",
      "Check website health, bookings/calendars, rental catalog, agent connections and answering-machine readiness.",
      "Help change supported public website code through the Code repairs worker: it edits code, runs independent tests and browser checks, and returns a draft pull request for review.",
    ],
    coding: {
      workflow: "Answer capability questions conversationally and ask what is broken and on which page. Employees can describe the problem in everyday words; do not demand technical descriptions or acceptance checks. The optional Code repairs button opens the form used to submit a supported repair when ready. A chat reply alone does not queue a repair.",
      connection: coding?.state === "connected" ? "Worker checked in recently." : "No recent worker connection is confirmed. Check Code repairs before promising a run.",
      executionPaused: snapshot.agents.emergencyStop === true,
      scope: "Supported public-page fixes, such as wording, buttons and layout. Admin tools (including the invitation builder), APIs, authentication, bookings, payments and integrations require a separate reviewed engineering change outside this worker's scope.",
      review: "The worker prepares actual code edits in a draft pull request. An owner must review before merging or deploying; it never automatically changes the live site.",
    },
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
