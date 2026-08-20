/**
 * Register approved invitation artwork by theme ID.
 * Paths are public URLs under /public (e.g. /invitations/approved/{themeId}/card.png).
 *
 * Jumping Jax has owner/license permission to use real characters for
 * catalogued themes (including Sonic). Do not invent unlicensed characters
 * for themes we do not have rights to. Inspired/generic motifs are only the
 * fallback when no approved asset is registered here.
 */
export const APPROVED_INVITATION_ARTWORK: Record<string, string> = {
  sonic: "/invitations/approved/sonic/card.png",
};

export function approvedArtworkSrc(themeId: string): string | null {
  return APPROVED_INVITATION_ARTWORK[themeId] ?? null;
}
