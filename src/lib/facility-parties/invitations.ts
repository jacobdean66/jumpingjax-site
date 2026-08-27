import { buildFacilityPartyCheckInUrl } from "./check-in";
import { getInvitationLibraryTheme } from "./invitations/library/themes";
import { matchInvitationTheme } from "./invitations/match-theme";

export const FACILITY_INVITATION_DELIVERY_PREFERENCES = [
  "print",
  "email",
  "office_pickup",
] as const;

/** Optional customer choice: themed digital invites vs office generic. */
export const FACILITY_INVITATION_CREATION_PREFERENCES = [
  "create",
  "office_generic",
] as const;

export const FACILITY_INVITATION_TEMPLATE_IDS = [
  "spotlight",
  "ticket",
  "poster",
] as const;

export type FacilityInvitationDeliveryPreference =
  (typeof FACILITY_INVITATION_DELIVERY_PREFERENCES)[number];

export type FacilityInvitationCreationPreference =
  (typeof FACILITY_INVITATION_CREATION_PREFERENCES)[number];

export type FacilityInvitationDeliveryPreferences =
  readonly FacilityInvitationDeliveryPreference[];

export type FacilityInvitationTemplateId =
  (typeof FACILITY_INVITATION_TEMPLATE_IDS)[number];

export type FacilityInvitationTheme = Readonly<{
  label: string;
  accent: string;
  secondary: string;
  background: string;
  border: string;
  graphicLabel: string;
  graphicVariant: FacilityInvitationGraphicVariant;
  approvedArtworkSlot: string | null;
}>;

export type FacilityInvitationGraphicVariant =
  | "party"
  | "princess"
  | "sports"
  | "glow"
  | "superhero"
  | "game"
  | "dinosaur";

export type FacilityInvitationTemplateOption = Readonly<{
  id: FacilityInvitationTemplateId;
  label: string;
  description: string;
}>;

export const FACILITY_INVITATION_TEMPLATE_OPTIONS: readonly FacilityInvitationTemplateOption[] =
  [
    {
      id: "spotlight",
      label: "Character Spotlight",
      description: "Big birthday name with the theme character up top.",
    },
    {
      id: "ticket",
      label: "Party Ticket",
      description: "A fun ticket-style invitation guests can bring in.",
    },
    {
      id: "poster",
      label: "Bold Poster",
      description: "Large, simple, and easy to read when shared by text or email.",
    },
  ];

export function normalizeInvitationDeliveryPreference(
  value: unknown,
): FacilityInvitationDeliveryPreference {
  return FACILITY_INVITATION_DELIVERY_PREFERENCES.includes(
    value as FacilityInvitationDeliveryPreference,
  )
    ? (value as FacilityInvitationDeliveryPreference)
    : "print";
}

export function normalizeInvitationCreationPreference(
  value: unknown,
): FacilityInvitationCreationPreference | null {
  return FACILITY_INVITATION_CREATION_PREFERENCES.includes(
    value as FacilityInvitationCreationPreference,
  )
    ? (value as FacilityInvitationCreationPreference)
    : null;
}

export function normalizeInvitationDeliveryPreferences(
  value: unknown,
): FacilityInvitationDeliveryPreference[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const normalized = values
    .map((item) =>
      typeof item === "string" ? item.trim() : item,
    )
    .filter((item) => item !== "")
    .map((item) => normalizeInvitationDeliveryPreference(item))
    .filter(
      (preference, index, list) => list.indexOf(preference) === index,
    );
  return normalized.length > 0 ? normalized : ["print"];
}

export function normalizeInvitationTemplateId(
  value: unknown,
): FacilityInvitationTemplateId {
  return FACILITY_INVITATION_TEMPLATE_IDS.includes(
    value as FacilityInvitationTemplateId,
  )
    ? (value as FacilityInvitationTemplateId)
    : "spotlight";
}

export function invitationTemplateLabel(
  id: FacilityInvitationTemplateId,
): string {
  return (
    FACILITY_INVITATION_TEMPLATE_OPTIONS.find((template) => template.id === id)
      ?.label ?? FACILITY_INVITATION_TEMPLATE_OPTIONS[0].label
  );
}

export function invitationDeliveryPreferenceLabel(
  preference: FacilityInvitationDeliveryPreference,
): string {
  if (preference === "email") return "Email invitation (single)";
  if (preference === "office_pickup") return "Receive in person";
  return "Printable sheet (4 per page)";
}

export function invitationCreationPreferenceLabel(
  preference: FacilityInvitationCreationPreference,
): string {
  if (preference === "office_generic") {
    return "I'd rather have generic invitations from the office";
  }
  return "Create invitations";
}

export const FACILITY_INVITATION_DELIVERY_OPTIONS: readonly {
  id: FacilityInvitationDeliveryPreference;
  label: string;
  description: string;
}[] = [
  {
    id: "print",
    label: "Printable sheet (4 per page)",
    description: "Four square invitations on one printable page.",
  },
  {
    id: "email",
    label: "Email invitation (single)",
    description: "One invitation to share or forward by email.",
  },
  {
    id: "office_pickup",
    label: "Receive in person",
    description: "Pick up invitations from the office — no digital design needed.",
  },
];

export function formatInvitationDeliveryPreferences(
  preferences: readonly FacilityInvitationDeliveryPreference[],
): string {
  return preferences
    .map((preference) => invitationDeliveryPreferenceLabel(preference))
    .join(", ");
}

export function resolveInvitationTheme(
  partyTheme: string | null | undefined,
): FacilityInvitationTheme {
  const match = matchInvitationTheme(partyTheme ?? "");
  const library = getInvitationLibraryTheme(match.themeId);
  const palette = library.palettes[0]!;
  const familyVariant: Record<string, FacilityInvitationGraphicVariant> = {
    princess: "princess",
    sports: "sports",
    colorful: "glow",
    gamer: "game",
    superhero: "superhero",
    animal: library.id === "dinosaur" ? "dinosaur" : "party",
    birthday: "party",
  };
  return {
    label: library.label,
    accent: palette.accent,
    secondary: palette.backgroundAlt,
    background: palette.background,
    border: palette.border,
    graphicLabel: library.label,
    graphicVariant: familyVariant[library.family] ?? "party",
    approvedArtworkSlot: library.heroes[0]?.src ?? library.id,
  };
}

export function approvedInvitationArtworkUrl(input: {
  partyTheme: string | null | undefined;
  templateId: FacilityInvitationTemplateId;
}): string | null {
  const configured =
    process.env.NEXT_PUBLIC_FACILITY_INVITATION_APPROVED_ARTWORK_BASE_URL?.trim();
  if (configured) {
    const slot = resolveInvitationTheme(input.partyTheme).approvedArtworkSlot;
    if (!slot) return null;
    return `${configured.replace(/\/+$/, "")}/${encodeURIComponent(slot)}-${input.templateId}.png`;
  }
  return getInvitationLibraryTheme(matchInvitationTheme(input.partyTheme ?? "").themeId)
    .heroes[0]?.src ?? null;
}

export function buildFacilityWaiverInvitationUrl(input: {
  siteUrl?: string | null;
  bookingId: string;
  partyDate: string | null | undefined;
}): string {
  return buildFacilityPartyCheckInUrl(input);
}

export function buildQrCodeImageUrl(data: string, size = 220): string {
  const boundedSize = Math.min(600, Math.max(120, Math.round(size)));
  const url = new URL("https://api.qrserver.com/v1/create-qr-code/");
  url.searchParams.set("size", `${boundedSize}x${boundedSize}`);
  url.searchParams.set("margin", "16");
  url.searchParams.set("data", data);
  return url.toString();
}
