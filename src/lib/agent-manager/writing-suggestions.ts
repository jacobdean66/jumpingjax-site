import { z } from "zod";
import { safeResearchText } from "./tech-search";

export const writingSuggestionInput = z.object({ draft: z.string().trim().min(4).max(500) }).strict();
export const writingSuggestionOutput = z.object({ suggestions: z.array(z.string().trim().min(8).max(180)).min(1).max(3) }).strict();

export function safeWritingDraft(draft: string) {
  return safeResearchText(draft) === draft && !/\bgh[pousr]_[a-z0-9_]{12,}|\beyJ[a-z0-9_-]{15,}\./i.test(draft);
}

export function quickWritingSuggestions(draft: string): string[] {
  if (!safeWritingDraft(draft)) return [];
  if (/\binvit/i.test(draft)) return [
    "Fix an invitation’s wording, layout or picture.",
    "Ask Invitation Agent to revise an invitation for review.",
    "Help me correct the picture on an invitation.",
  ];
  if (/\b(book|booking|calendar|confirmation|reservation)/i.test(draft)) return [
    "Check bookings and calendars for anything that needs attention.",
    "Check for booking confirmations that did not complete.",
    "Ask Booking Agent to review booking workflows.",
  ];
  if (/\b(code|bug|broken|button|page|website|layout|fix)/i.test(draft)) return [
    "Check the website for errors and explain what needs attention.",
    "Help me describe a broken page for Code repairs.",
    "Check code and security health.",
  ];
  if (/\b(call|phone|answer|message|inbox)/i.test(draft)) return [
    "Check the answering machine and explain what needs review.",
    "Is the answering machine connected and ready?",
    "Show me which incoming calls need attention.",
  ];
  if (/\b(agent|connect|setup|service)/i.test(draft)) return [
    "Check agent connections and explain what still needs setup.",
    "Show me which services need attention.",
    "Check the whole website and summarize the next steps.",
  ];
  return ["Check the whole website", "Check bookings and calendars", "Check agent connections"];
}
