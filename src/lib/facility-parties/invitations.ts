import { buildFacilityPartyCheckInUrl } from "./check-in";

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

const DEFAULT_THEME: FacilityInvitationTheme = {
  label: "Birthday Party",
  accent: "#f97316",
  secondary: "#0891b2",
  background: "#fff7ed",
  border: "#fed7aa",
  graphicLabel: "Party",
  graphicVariant: "party",
  approvedArtworkSlot: null,
};

const THEME_PRESETS: readonly (FacilityInvitationTheme & {
  keywords: readonly string[];
})[] = [
  {
    label: "Princess Party",
    keywords: ["princess", "barbie", "fairy", "unicorn", "pink", "purple"],
    accent: "#db2777",
    secondary: "#7c3aed",
    background: "#fdf2f8",
    border: "#fbcfe8",
    graphicLabel: "Princess",
    graphicVariant: "princess",
    approvedArtworkSlot: "princess",
  },
  {
    label: "Sports Party",
    keywords: ["sports", "football", "basketball", "baseball", "soccer"],
    accent: "#16a34a",
    secondary: "#2563eb",
    background: "#f0fdf4",
    border: "#bbf7d0",
    graphicLabel: "Game Day",
    graphicVariant: "sports",
    approvedArtworkSlot: "sports",
  },
  {
    label: "Glow Party",
    keywords: ["glow", "neon", "dance"],
    accent: "#a21caf",
    secondary: "#06b6d4",
    background: "#fdf4ff",
    border: "#f5d0fe",
    graphicLabel: "Glow",
    graphicVariant: "glow",
    approvedArtworkSlot: "glow",
  },
  {
    label: "Superhero Party",
    keywords: ["hero", "superhero", "spider", "batman", "marvel"],
    accent: "#dc2626",
    secondary: "#2563eb",
    background: "#eff6ff",
    border: "#bfdbfe",
    graphicLabel: "Hero",
    graphicVariant: "superhero",
    approvedArtworkSlot: "superhero",
  },
  {
    label: "Game Party",
    keywords: ["sonic", "mario", "minecraft", "game", "gaming", "pokemon"],
    accent: "#2563eb",
    secondary: "#facc15",
    background: "#eff6ff",
    border: "#bfdbfe",
    graphicLabel: "Game On",
    graphicVariant: "game",
    approvedArtworkSlot: "game",
  },
  {
    label: "Dinosaur Party",
    keywords: ["dinosaur", "dino", "jurassic"],
    accent: "#65a30d",
    secondary: "#ea580c",
    background: "#f7fee7",
    border: "#d9f99d",
    graphicLabel: "Dino",
    graphicVariant: "dinosaur",
    approvedArtworkSlot: "dinosaur",
  },
];

const APPROVED_CHARACTER_ARTWORK_SLOTS: readonly {
  keywords: readonly string[];
  slot: string;
  label: string;
}[] = [
  { keywords: ["sonic"], slot: "sonic", label: "Sonic" },
  { keywords: ["mario"], slot: "mario", label: "Mario" },
  { keywords: ["minecraft"], slot: "minecraft", label: "Minecraft" },
  { keywords: ["pokemon", "pikachu"], slot: "pokemon", label: "Pokemon" },
  { keywords: ["barbie"], slot: "barbie", label: "Barbie" },
  { keywords: ["spider", "spiderman"], slot: "spider-hero", label: "Hero" },
  { keywords: ["batman"], slot: "bat-hero", label: "Hero" },
];

function clean(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

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
  const normalized = clean(partyTheme).toLowerCase();
  const characterArtwork = APPROVED_CHARACTER_ARTWORK_SLOTS.find((item) =>
    item.keywords.some((keyword) => normalized.includes(keyword)),
  );
  const preset = THEME_PRESETS.find((item) =>
    item.keywords.some((keyword) => normalized.includes(keyword)),
  );
  if (preset) {
    const { keywords, ...theme } = preset;
    void keywords;
    return {
      ...theme,
      graphicLabel: characterArtwork?.label ?? theme.graphicLabel,
      approvedArtworkSlot:
        characterArtwork?.slot ?? theme.approvedArtworkSlot,
    };
  }

  return {
    ...DEFAULT_THEME,
    label: clean(partyTheme) || DEFAULT_THEME.label,
    graphicLabel: clean(partyTheme).slice(0, 18) || DEFAULT_THEME.graphicLabel,
    approvedArtworkSlot:
      characterArtwork?.slot ?? DEFAULT_THEME.approvedArtworkSlot,
  };
}

export function approvedInvitationArtworkUrl(input: {
  partyTheme: string | null | undefined;
  templateId: FacilityInvitationTemplateId;
}): string | null {
  const base =
    process.env.NEXT_PUBLIC_FACILITY_INVITATION_APPROVED_ARTWORK_BASE_URL?.trim();
  if (!base) return null;

  const slot = resolveInvitationTheme(input.partyTheme).approvedArtworkSlot;
  if (!slot) return null;

  return `${base.replace(/\/+$/, "")}/${encodeURIComponent(slot)}-${input.templateId}.png`;
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
