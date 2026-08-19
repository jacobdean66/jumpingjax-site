import { approvedArtworkSrc } from "./approved-artwork";
import {
  clampInvitationOptionIndex,
  listInvitationOptions,
  matchInvitationTheme,
  MAX_INVITATION_ALTERNATE_LOADS,
  type InvitationMatch,
} from "./match-theme";
import { getInvitationTheme, type InvitationThemeDefinition } from "./theme-catalog";

export const INVITATION_SNAPSHOT_VERSION = 1 as const;

export type InvitationSnapshot = InvitationMatch & {
  version: typeof INVITATION_SNAPSHOT_VERSION;
  sourceText: string;
  optionIndex: number;
  alternatesUsed: number;
  alternatesLocked: boolean;
};

export const FACILITY_INVITATION_VENUE = {
  name: "Jumping Jax",
  address: "559 Beaudrot Rd, Greenwood, SC",
} as const;

export {
  clampInvitationOptionIndex,
  listInvitationOptions,
  MAX_INVITATION_ALTERNATE_LOADS,
} from "./match-theme";

export function invitationSnapshotFromChoice(
  sourceText: string,
  optionIndex: unknown = 0,
  alternatesUsed: unknown = 0,
): InvitationSnapshot {
  const trimmed = sourceText.trim();
  const index = clampInvitationOptionIndex(optionIndex);
  const used = clampInvitationOptionIndex(alternatesUsed);
  const options = listInvitationOptions(trimmed);
  const chosen = options[index] ?? options[0] ?? matchInvitationTheme(trimmed);
  return {
    version: INVITATION_SNAPSHOT_VERSION,
    sourceText: trimmed,
    ...chosen,
    optionIndex: index,
    alternatesUsed: used,
    alternatesLocked: used >= MAX_INVITATION_ALTERNATE_LOADS,
  };
}

export function buildInvitationSnapshot(sourceText: string): InvitationSnapshot {
  return invitationSnapshotFromChoice(sourceText, 0, 0);
}

export function advanceInvitationSnapshot(
  snapshot: InvitationSnapshot,
): InvitationSnapshot {
  if (
    snapshot.alternatesLocked ||
    snapshot.alternatesUsed >= MAX_INVITATION_ALTERNATE_LOADS
  ) {
    return {
      ...snapshot,
      alternatesUsed: MAX_INVITATION_ALTERNATE_LOADS,
      alternatesLocked: true,
    };
  }
  return invitationSnapshotFromChoice(
    snapshot.sourceText,
    snapshot.optionIndex + 1,
    snapshot.alternatesUsed + 1,
  );
}

export function remainingInvitationAlternates(
  snapshot: InvitationSnapshot,
): number {
  return Math.max(0, MAX_INVITATION_ALTERNATE_LOADS - snapshot.alternatesUsed);
}

export function isInvitationSnapshot(value: unknown): value is InvitationSnapshot {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    row.version === INVITATION_SNAPSHOT_VERSION &&
    typeof row.themeId === "string" &&
    typeof row.themeLabel === "string" &&
    typeof row.styleFamily === "string" &&
    typeof row.artworkSlot === "string" &&
    typeof row.sourceText === "string"
  );
}

export function resolveInvitationSnapshot(input: {
  partyTheme: string | null | undefined;
  stored?: unknown;
}): InvitationSnapshot {
  const source = (input.partyTheme ?? "").trim();
  if (isInvitationSnapshot(input.stored) && input.stored.sourceText === source) {
    const theme = getInvitationTheme(input.stored.themeId);
    const optionIndex = clampInvitationOptionIndex(
      input.stored.optionIndex ?? 0,
    );
    const alternatesUsed = clampInvitationOptionIndex(
      input.stored.alternatesUsed ?? 0,
    );
    return {
      ...input.stored,
      themeLabel: theme.label,
      styleFamily: theme.family,
      artworkSlot: theme.artworkSlot,
      artworkKind: approvedArtworkSrc(theme.id)
        ? "approved"
        : theme.id.startsWith("generic-")
          ? "generic"
          : "inspired",
      artworkVariant: clampInvitationOptionIndex(
        input.stored.artworkVariant ?? 0,
      ),
      optionIndex,
      alternatesUsed,
      alternatesLocked:
        input.stored.alternatesLocked === true ||
        alternatesUsed >= MAX_INVITATION_ALTERNATE_LOADS,
    };
  }
  return buildInvitationSnapshot(source);
}

export function invitationThemeForSnapshot(
  snapshot: InvitationSnapshot,
): InvitationThemeDefinition {
  return getInvitationTheme(snapshot.themeId);
}

export function facilityInvitationPath(bookingId: string): string {
  return `/facility-parties/invitations/${encodeURIComponent(bookingId)}`;
}

export function facilityInvitationSheetPath(bookingId: string): string {
  return `/facility-parties/invitations/${encodeURIComponent(bookingId)}/sheet`;
}

export function adminFacilityInvitationPath(bookingId: string): string {
  return `/admin/facility/invitations/${encodeURIComponent(bookingId)}`;
}

export function facilityInvitationShareUrl(
  siteUrl: string,
  bookingId: string,
): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${base}${facilityInvitationPath(bookingId)}`;
}
