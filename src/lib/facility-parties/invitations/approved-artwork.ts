import { getInvitationLibraryTheme } from "./library/themes";

/** Artwork that Jumping Jax has explicitly approved for invitation use. */
export const APPROVED_INVITATION_ARTWORK: Readonly<Record<string, string>> = {
  sonic: "/invitations/approved/sonic/card.png",
};

export function approvedArtworkSrc(themeId: string): string | null {
  return (
    APPROVED_INVITATION_ARTWORK[themeId] ??
    getInvitationLibraryTheme(themeId).heroes[0]?.src ??
    null
  );
}
