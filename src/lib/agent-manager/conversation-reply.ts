import { safeResearchText } from "./tech-search";
import type { SupervisorSnapshot } from "./supervisor";
import { isCodeRepairRequest } from "./code-repair";

export type ReplyHistory = { question: string; reply: string; pictureCount?: number };

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
      "Delegate wording, layout and artwork corrections to the Invitation Agent. The employee chooses the party under Front Desk > Make / Print Invitations, asks for a correction in everyday words, reviews the before/after preview, confirms any replacement picture and approves saving. A correction does not send or print anything. Invitation tool source fixes can be prepared as reviewed dashboard coding drafts.",
      "Check website health, bookings/calendars, rental catalog, agent connections and answering-machine readiness.",
      "Prepare a new rental catalogue item in the Inventory review form. The owner fills missing facts, adds a photo, reviews visibility and saves. Prepare public website, home page, new public pages, dashboard, API and print code changes through the coding worker. Public pages get independent browser checks; protected pages require owner preview before merge. All coding changes return draft pull requests for review.",
    ],
    coding: {
      workflow: "Answer capability questions conversationally and ask what is broken and on which page. Employees can describe the problem in everyday words; do not demand technical descriptions or acceptance checks. For a concrete request, investigate the source and use prepare_code_repair to prefill the review form. The owner starts the paid run there. For a new rental item use prepare_catalog_item; never invent missing product facts. A chat reply alone does not queue a repair.",
      connection: coding?.state === "connected" ? "Worker checked in recently." : "No recent worker connection is confirmed. Check Code repairs before promising a run.",
      executionPaused: snapshot.agents.emergencyStop === true,
      scope: "Public pages, the home page and new pages; reviewed dashboard, API, invitation-builder and print fixes. Protected page drafts require owner preview of the signed-in page, print output and business behavior. The worker cannot edit its own controls, authentication, security or legal terms. Business records are never changed by a coding draft.",
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
