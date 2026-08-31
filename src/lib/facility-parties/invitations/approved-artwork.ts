import { getInvitationLibraryTheme } from "./library/themes";

/** Artwork that Jumping Jax has explicitly approved for invitation use. */
export const APPROVED_INVITATION_ARTWORK: Readonly<Record<string, string>> = {
  sonic: "/invitations/approved/sonic/card.png",
};

export function approvedArtworkSrc(
  themeId: string,
  sourceText = "",
): string | null {
  const normalizedSource = sourceText.toLowerCase();
  const approvedSourceKey = Object.keys(APPROVED_INVITATION_ARTWORK).find((key) =>
    normalizedSource.includes(key),
  );
  return (
    (approvedSourceKey ? APPROVED_INVITATION_ARTWORK[approvedSourceKey] : null) ??
    APPROVED_INVITATION_ARTWORK[themeId] ??
    getInvitationLibraryTheme(themeId).heroes[0]?.src ??
    null
  );
}
