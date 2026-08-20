export const INVITATION_LIBRARY_LAYOUT_IDS = [
  "spotlight",
  "ticket",
  "poster",
] as const;

export type InvitationLibraryLayoutId =
  (typeof INVITATION_LIBRARY_LAYOUT_IDS)[number];

export const INVITATION_LIBRARY_FAMILIES = [
  "birthday",
  "sports",
  "princess",
  "gamer",
  "superhero",
  "animal",
  "colorful",
] as const;

export type InvitationLibraryFamily =
  (typeof INVITATION_LIBRARY_FAMILIES)[number];

export const INVITATION_LIBRARY_THEME_IDS = [
  "classic-birthday",
  "dinosaur",
  "princess-royal",
  "unicorn-rainbow",
  "space",
  "sports",
  "construction",
  "racing-cars",
  "ocean-mermaid",
  "safari-animals",
  "pirate",
  "gamer-neon",
] as const;

export type InvitationLibraryThemeId =
  (typeof INVITATION_LIBRARY_THEME_IDS)[number];

export type InvitationAssetLicenseId = "fluent-emoji" | "kenney";

export type InvitationLibraryAsset = Readonly<{
  id: string;
  src: string;
  alt: string;
  licenseId: InvitationAssetLicenseId;
}>;

export type InvitationLibraryPalette = Readonly<{
  id: string;
  background: string;
  backgroundAlt: string;
  accent: string;
  accent2: string;
  text: string;
  muted: string;
  border: string;
}>;

export type InvitationLibraryTheme = Readonly<{
  id: InvitationLibraryThemeId;
  label: string;
  family: InvitationLibraryFamily;
  aliases: readonly string[];
  heroes: readonly InvitationLibraryAsset[];
  decorations: readonly InvitationLibraryAsset[];
  palettes: readonly InvitationLibraryPalette[];
  layouts: readonly InvitationLibraryLayoutId[];
  licenseIds: readonly InvitationAssetLicenseId[];
}>;

export type InvitationComposition = Readonly<{
  themeId: InvitationLibraryThemeId;
  themeLabel: string;
  layout: InvitationLibraryLayoutId;
  hero: InvitationLibraryAsset;
  decorations: readonly InvitationLibraryAsset[];
  palette: InvitationLibraryPalette;
}>;
