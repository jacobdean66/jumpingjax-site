import { APPROVED_INVITATION_ARTWORK } from "../approved-artwork";
import { INVITATION_LIBRARY_THEMES } from "./themes";

export const INVITATION_AGENT_LIBRARIES = [
  {
    id: "approved-artwork",
    label: "Jumping Jax approved artwork",
    kind: "approved",
  },
  {
    id: "fluent-emoji",
    label: "Microsoft Fluent Emoji",
    kind: "licensed",
  },
  {
    id: "kenney-cc0",
    label: "Kenney CC0 scenery",
    kind: "public-domain",
  },
] as const;

export type InvitationAgentLibraryId =
  (typeof INVITATION_AGENT_LIBRARIES)[number]["id"];

/**
 * Reports the three repositories the invitation specialist can compose from.
 * This is intentionally repo-local: rendering never depends on a third-party
 * asset URL or a paid image-generation request.
 */
export function invitationLibrariesForTheme(
  themeId: string,
): InvitationAgentLibraryId[] {
  const theme =
    INVITATION_LIBRARY_THEMES.find((candidate) => candidate.id === themeId) ??
    INVITATION_LIBRARY_THEMES[0];
  const libraries = new Set<InvitationAgentLibraryId>();

  if (APPROVED_INVITATION_ARTWORK[themeId]) libraries.add("approved-artwork");
  for (const license of theme?.licenseIds ?? []) {
    if (license === "fluent-emoji") libraries.add("fluent-emoji");
    if (license === "kenney") libraries.add("kenney-cc0");
  }

  return [...libraries];
}
