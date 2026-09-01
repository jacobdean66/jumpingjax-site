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
  version: "light-ink-standard-v1",
  themeSource: "customer-party-theme",
  defaultPrintPaper: "letter",
  exactFourBySixPaper: "legal",
  cardsPerSheet: 4,
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
};

export type InvitationAgentResult = {
  agent: "party-invitation";
  status: "completed";
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
 * Single entry point for every invitation interaction. The specialist matches
 * the customer's free-text theme, composes from all attached local libraries,
 * and returns the stable snapshot used by every renderer.
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
  );
  const snapshot =
    input.action === "alternate"
      ? advanceInvitationSnapshot(current)
      : current;

  return {
    agent: "party-invitation",
    status: "completed",
    action: input.action,
    snapshot,
    attachedLibraries: INVITATION_AGENT_LIBRARIES,
    usedLibraries: invitationLibrariesForTheme(snapshot.themeId),
  };
}
