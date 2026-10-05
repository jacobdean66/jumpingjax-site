import {
  advanceInvitationSnapshot,
  invitationSnapshotFromChoice,
  type InvitationSnapshot,
} from "./snapshot";
import {
  INVITATION_AGENT_LIBRARIES,
  invitationLibrariesForTheme,
  type InvitationAgentLibraryId,
} from "./library/registry";
import type { ConfirmedInvitationTheme } from "./theme-search";

import type { ApprovedPrint } from "./approved-print";
import { INVITATION_ARTWORK_RULE, invitationNeedsArtworkConfirmation } from "./artwork-policy";

export const INVITATION_AGENT_ACTIONS = [
  "create",
  "alternate",
  "choose-delivery",
  "choose-template",
  "open",
  "view-single",
  "view-sheet",
  "email",
  "print",
] as const;

/**
 * Approved Jumping Jax standard for every facility-party invitation.
 * The customer party-theme field remains the creative source of truth.
 */
export const INVITATION_AGENT_STANDARD = {
  version: "light-ink-full-page-borderless-v3",
  themeSource: "customer-party-theme",
  artworkRule: INVITATION_ARTWORK_RULE,
  defaultPrintPaper: "letter",
  exactFourBySixPaper: "legal",
  cardsPerSheet: 4,
  inkSaver: true,
  printSafeMarginInches: 0,
  showCutLines: false,
} as const;

export type InvitationAgentAction =
  (typeof INVITATION_AGENT_ACTIONS)[number];

export type InvitationAgentInput = {
  action: InvitationAgentAction;
  sourceText: string;
  colorHint?: string;
  optionIndex?: number;
  alternatesUsed?: number;
  selection?: string;
  bookingId?: string;
  confirmedTheme?: ConfirmedInvitationTheme;
  confirmationToken?: string;
  approvedPrint?: ApprovedPrint;
};

export type InvitationAgentResult = {
  agent: "party-invitation";
  status: "layout_composed" | "needs_theme_confirmation";
  action: InvitationAgentAction;
  snapshot: InvitationSnapshot;
  attachedLibraries: typeof INVITATION_AGENT_LIBRARIES;
  usedLibraries: InvitationAgentLibraryId[];
};

export function isInvitationAgentAction(
  value: unknown,
): value is InvitationAgentAction {
  return INVITATION_AGENT_ACTIONS.includes(value as InvitationAgentAction);
}

/**
 * Compose a stable snapshot for every renderer, preserving confirmed artwork.
 * Layout matching never proves artwork relevance. Unverified legacy themes
 * remain pending instead of borrowing a generic library picture.
 */
export function runInvitationAgent(
  input: InvitationAgentInput,
): InvitationAgentResult {
  const sourceText = String(input.sourceText ?? "").trim().slice(0, 160);
  const colorHint = String(input.colorHint ?? "").trim().slice(0, 120);
  const current = invitationSnapshotFromChoice(
    sourceText,
    input.optionIndex,
    input.alternatesUsed,
    colorHint,
    input.confirmedTheme,
  );
  const snapshot =
    input.action === "alternate"
      ? advanceInvitationSnapshot(current)
      : current;

  if (input.approvedPrint?.bookingId === input.bookingId) snapshot.approvedPrint = input.approvedPrint;
  const needsConfirmation = invitationNeedsArtworkConfirmation(snapshot);

  return {
    agent: "party-invitation",
    status: needsConfirmation ? "needs_theme_confirmation" : "layout_composed",
    action: input.action,
    snapshot,
    attachedLibraries: INVITATION_AGENT_LIBRARIES,
    usedLibraries: needsConfirmation || snapshot.confirmedTheme ? [] : invitationLibrariesForTheme(snapshot.themeId),
  };
}
