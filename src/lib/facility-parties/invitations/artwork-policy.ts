import { approvedSourceArtworkSrc } from "./approved-artwork";
import { confirmedThemeSchema } from "./theme-search";
import type { InvitationSnapshot } from "./snapshot";

/** Persistent agent rule; all renderers and delivery paths enforce it. */
export const INVITATION_ARTWORK_RULE = "Depict the customer's requested character, franchise, and version. Designs may vary. Reject uncertain identities and approximate look-alikes instead of labeling them as the requested character. Never substitute generic library artwork for an unverified theme; require a matching picture instead.";
export const INVITATION_ARTWORK_REQUIRED = "The picture for this theme needs confirmation. Search for the requested character or theme and select a matching picture before printing or sending the invitation.";

/** A positive model flag cannot override its own uncertain identification. */
export function uncertainInvitationIdentity(label: string, description: string): boolean {
  return /\b(?:resembles|look[- ]alike|might be|could be|possibly|probably)\b/i.test(`${label} ${description}`);
}

export function invitationNeedsArtworkConfirmation(snapshot: InvitationSnapshot): boolean {
  if (snapshot.confirmedTheme) {
    const parsed = confirmedThemeSchema.safeParse(snapshot.confirmedTheme);
    return !parsed.success || parsed.data.label !== snapshot.sourceText.trim();
  }
  if (snapshot.approvedPrint?.themeText === snapshot.sourceText.trim()) return false;
  // An empty builder has no requested theme. It may show a neutral preview.
  if (!snapshot.sourceText.trim()) return snapshot.themeId !== "classic-birthday";
  if (snapshot.themeId === "classic-birthday" && /^(birthday|bday|generic|none|classic birthday)$/i.test(snapshot.sourceText.trim())) return false;
  // These are explicit approved pictures, not fuzzy/family/library matches.
  return !approvedSourceArtworkSrc(snapshot.sourceText);
}

export class InvitationArtworkRequiredError extends Error {
  readonly code = "theme_confirmation_required";
  constructor() {
    super(INVITATION_ARTWORK_REQUIRED);
    this.name = "InvitationArtworkRequiredError";
  }
}

export function assertInvitationArtwork(snapshot: InvitationSnapshot): void {
  if (invitationNeedsArtworkConfirmation(snapshot)) throw new InvitationArtworkRequiredError();
}
