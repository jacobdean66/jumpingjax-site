import { approvedArtworkSrc } from "@/lib/facility-parties/invitations/approved-artwork";
import { runInvitationAgent } from "@/lib/facility-parties/invitations/agent";
import { composeLibraryInvitation } from "@/lib/facility-parties/invitations/library/compose";
import { resolveInvitationSourceTreatment } from "@/lib/facility-parties/invitations/source-treatment";

export type SocialThemeLibraryContext = Readonly<{
  sourceText: string;
  themeId: string;
  themeLabel: string;
  styleFamily: string;
  matchedAlias: string | null;
  matchKind: string;
  attachedLibraries: readonly string[];
  heroPath: string;
  decorationPaths: readonly string[];
  approvedArtworkPath: string | null;
  palette: Readonly<{
    background: string;
    backgroundAlt: string;
    accent: string;
    accent2: string;
    text: string;
  }>;
  promptContext: string;
}>;

function publicUrl(path: string): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (!base || !path.startsWith("/")) return null;
  return `${base}${path}`;
}

/**
 * Shared bridge from the facility Party / Invitation Agent into Social Posts.
 * It reuses the exact same matcher, licensed libraries, approved artwork,
 * composition choices, and source-specific palette treatment.
 */
export function resolveSocialThemeLibraryContext(
  sourceText: string | null | undefined,
): SocialThemeLibraryContext | null {
  const theme = sourceText?.trim().slice(0, 160) ?? "";
  if (!theme) return null;

  const invitation = runInvitationAgent({ action: "view-single", sourceText: theme });
  const snapshot = invitation.snapshot;
  const composition = composeLibraryInvitation({
    themeId: snapshot.themeId,
    optionIndex: snapshot.optionIndex,
    colorHint: snapshot.colorHint,
  });
  const treatment = resolveInvitationSourceTreatment(theme);
  const palette = treatment
    ? {
        background: treatment.background,
        backgroundAlt: treatment.backgroundAlt,
        accent: treatment.accent,
        accent2: treatment.accent2,
        text: treatment.text,
      }
    : {
        background: composition.palette.background,
        backgroundAlt: composition.palette.backgroundAlt,
        accent: composition.palette.accent,
        accent2: composition.palette.accent2,
        text: composition.palette.text,
      };
  const approvedArtworkPath = approvedArtworkSrc(snapshot.themeId, theme);
  const attachedLibraries = invitation.usedLibraries.map(String);
  const promptContext = [
    `facility invitation theme source=${theme}`,
    `matched theme=${snapshot.themeLabel} (${snapshot.themeId})`,
    `style family=${snapshot.styleFamily}`,
    `licensed libraries=${attachedLibraries.join(", ") || "none"}`,
    `hero=${composition.hero.alt}`,
    `decorations=${composition.decorations.map((item) => item.alt).join(", ")}`,
    `palette=${palette.background},${palette.backgroundAlt},${palette.accent},${palette.accent2}`,
    approvedArtworkPath
      ? `owner-approved theme artwork=${approvedArtworkPath}`
      : "no owner-approved franchise artwork; use only generic licensed library motifs",
    "Use the theme as visual inspiration for a facility-party post; do not imply endorsement, partnership, or official character licensing.",
  ].join("; ");

  return {
    sourceText: theme,
    themeId: snapshot.themeId,
    themeLabel: snapshot.themeLabel,
    styleFamily: snapshot.styleFamily,
    matchedAlias: snapshot.matchedAlias,
    matchKind: snapshot.matchKind,
    attachedLibraries,
    heroPath: composition.hero.src,
    decorationPaths: composition.decorations.map((item) => item.src),
    approvedArtworkPath,
    palette,
    promptContext,
  };
}

export function socialThemePreferredSourceUrl(
  context: SocialThemeLibraryContext | null,
): string | null {
  if (!context) return null;
  return publicUrl(context.approvedArtworkPath ?? context.heroPath);
}
