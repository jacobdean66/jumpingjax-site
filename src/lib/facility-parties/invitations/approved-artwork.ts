/**
 * Register approved/licensed invitation artwork by theme ID.
 * Paths are public URLs under /public. Leave empty until an approved
 * asset source exists — the UI will use a safe inspired or generic motif.
 */
export const APPROVED_INVITATION_ARTWORK: Record<string, string> = {
  // Example when an approved file is added:
  // sonic: "/invitations/approved/sonic/card.png",
};

export function approvedArtworkSrc(themeId: string): string | null {
  return APPROVED_INVITATION_ARTWORK[themeId] ?? null;
}
