import { getInvitationLibraryTheme } from "./library/themes";

/** Local library hero for a matched theme. No remote runtime dependency. */
export function approvedArtworkSrc(themeId: string): string | null {
  return getInvitationLibraryTheme(themeId).heroes[0]?.src ?? null;
}
