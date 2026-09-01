import { getInvitationLibraryTheme } from "./library/themes";

/** Artwork that Jumping Jax has explicitly approved for invitation use. */
export const APPROVED_INVITATION_ARTWORK: Readonly<Record<string, string>> = {
  sonic: "/invitations/approved/sonic/card.png",
  minecraft: "/invitations/approved/block-world/card.png",
  "mine craft": "/invitations/approved/block-world/card.png",
};

/** Light artwork created by the invitation agent specifically for printed sheets. */
export const AGENT_PRINT_INVITATION_ARTWORK: Readonly<Record<string, string>> = {
  minecraft: "/invitations/approved/block-world/print-light-v1.png",
  "mine craft": "/invitations/approved/block-world/print-light-v1.png",
};

function sourceArtwork(
  artwork: Readonly<Record<string, string>>,
  sourceText: string,
): string | null {
  const normalizedSource = sourceText.toLowerCase();
  const sourceKey = Object.keys(artwork).find((key) =>
    normalizedSource.includes(key),
  );
  return sourceKey ? artwork[sourceKey] : null;
}

export function approvedArtworkSrc(
  themeId: string,
  sourceText = "",
): string | null {
  return (
    sourceArtwork(APPROVED_INVITATION_ARTWORK, sourceText) ??
    APPROVED_INVITATION_ARTWORK[themeId] ??
    getInvitationLibraryTheme(themeId).heroes[0]?.src ??
    null
  );
}

export function agentPrintArtworkSrc(
  themeId: string,
  sourceText = "",
): string | null {
  return (
    sourceArtwork(AGENT_PRINT_INVITATION_ARTWORK, sourceText) ??
    AGENT_PRINT_INVITATION_ARTWORK[themeId] ??
    null
  );
}
