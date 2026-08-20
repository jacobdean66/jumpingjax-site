/**
 * Birthday invitation themes are customer-entered text.
 * They match a curated local asset library (never live image generation).
 * Branded requests map only to generic, unbranded artwork.
 */

import { INVITATION_LIBRARY_THEMES } from "./library/themes";

export const INVITATION_STYLE_FAMILIES = [
  "birthday",
  "sports",
  "princess",
  "gamer",
  "superhero",
  "animal",
  "colorful",
] as const;

export type InvitationStyleFamily = (typeof INVITATION_STYLE_FAMILIES)[number];

export type InvitationArtworkKind = "approved" | "inspired" | "generic";

export type InvitationThemeDefinition = {
  id: string;
  label: string;
  family: InvitationStyleFamily;
  aliases: string[];
  artworkSlot: string;
  palette: {
    background: string;
    backgroundAlt: string;
    accent: string;
    accent2: string;
    text: string;
    muted: string;
  };
};

export const FALLBACK_THEME_IDS = {
  birthday: "classic-birthday",
  sports: "sports",
  princess: "princess-royal",
  gamer: "gamer-neon",
  superhero: "gamer-neon",
  animal: "safari-animals",
  colorful: "unicorn-rainbow",
} as const satisfies Record<InvitationStyleFamily, string>;

export const INVITATION_THEMES: InvitationThemeDefinition[] =
  INVITATION_LIBRARY_THEMES.map((theme) => ({
    id: theme.id,
    label: theme.label,
    family: theme.family as InvitationStyleFamily,
    aliases: [...theme.aliases],
    artworkSlot: theme.id,
    palette: {
      background: theme.palettes[0]!.background,
      backgroundAlt: theme.palettes[0]!.backgroundAlt,
      accent: theme.palettes[0]!.accent,
      accent2: theme.palettes[0]!.accent2,
      text: theme.palettes[0]!.text,
      muted: theme.palettes[0]!.muted,
    },
  }));

export const THEME_BY_ID = new Map(
  INVITATION_THEMES.map((theme) => [theme.id, theme]),
);

const LEGACY_THEME_IDS: Record<string, string> = {
  sonic: "gamer-neon",
  mario: "gamer-neon",
  minecraft: "gamer-neon",
  pokemon: "safari-animals",
  barbie: "princess-royal",
  "paw-patrol": "safari-animals",
  bluey: "safari-animals",
  "spider-man": "gamer-neon",
  batman: "gamer-neon",
  princess: "princess-royal",
  mermaid: "ocean-mermaid",
  unicorn: "unicorn-rainbow",
  dinosaurs: "dinosaur",
  clemson: "sports",
  gamecocks: "sports",
  "generic-sports": "sports",
  "generic-gamer": "gamer-neon",
  "generic-superhero": "gamer-neon",
  "generic-animal": "safari-animals",
  "generic-colorful": "unicorn-rainbow",
  "generic-birthday": "classic-birthday",
};

export function getInvitationTheme(id: string): InvitationThemeDefinition {
  const mapped = LEGACY_THEME_IDS[id] ?? id;
  return THEME_BY_ID.get(mapped) ?? THEME_BY_ID.get("classic-birthday")!;
}
