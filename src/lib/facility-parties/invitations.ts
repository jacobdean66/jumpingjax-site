import { buildFacilityPartyCheckInUrl } from "./check-in";
import {
  matchInvitationTheme,
  type FacilityInvitationGraphicVariant,
} from "./invitation-theme-catalog";

export type { FacilityInvitationGraphicVariant } from "./invitation-theme-catalog";

export const FACILITY_INVITATION_DELIVERY_PREFERENCES = [
  "print",
  "email",
  "office_pickup",
] as const;

export const FACILITY_INVITATION_TEMPLATE_IDS = [
  "spotlight",
  "ticket",
  "poster",
] as const;

export type FacilityInvitationDeliveryPreference =
  (typeof FACILITY_INVITATION_DELIVERY_PREFERENCES)[number];

export type FacilityInvitationDeliveryPreferences =
  readonly FacilityInvitationDeliveryPreference[];

export type FacilityInvitationTemplateId =
  (typeof FACILITY_INVITATION_TEMPLATE_IDS)[number];

export type FacilityInvitationTheme = Readonly<{
  id: string;
  label: string;
  accent: string;
  secondary: string;
  background: string;
  border: string;
  graphicLabel: string;
  graphicVariant: FacilityInvitationGraphicVariant;
  approvedArtworkSlot: string | null;
}>;

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

export function normalizeInvitationDeliveryPreferences(
  value: unknown,
): FacilityInvitationDeliveryPreference[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const normalized = values
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
  if (preference === "email") return "Email invitations";
  if (preference === "office_pickup") return "Office pickup";
  return "Print at home";
}

export function formatInvitationDeliveryPreferences(
  preferences: readonly FacilityInvitationDeliveryPreference[],
): string {
  return preferences.map((preference) => invitationDeliveryPreferenceLabel(preference)).join(", ");
}

export function resolveInvitationTheme(
  partyTheme: string | null | undefined,
): FacilityInvitationTheme {
  const { aliases, category, ...theme } = matchInvitationTheme(partyTheme);
  void aliases;
  void category;
  return theme;
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

export function buildPublicFacilityInvitationUrl(input: {
  siteUrl?: string | null;
  bookingId: string;
  token: string;
  layout?: "single" | "sheet";
}): string {
  const base = input.siteUrl?.trim() || "https://jumpingjaxllc.com";
  const url = new URL(
    `/facility-party-invitations/${encodeURIComponent(input.bookingId)}`,
    `${base.replace(/\/+$/, "")}/`,
  );
  url.searchParams.set("token", input.token);
  if (input.layout === "single") url.searchParams.set("layout", "single");
  return url.toString();
}

export function buildQrCodeImageUrl(data: string, size = 220): string {
  const boundedSize = Math.min(600, Math.max(120, Math.round(size)));
  const url = new URL("https://api.qrserver.com/v1/create-qr-code/");
  url.searchParams.set("size", `${boundedSize}x${boundedSize}`);
  url.searchParams.set("margin", "16");
  url.searchParams.set("data", data);
  return url.toString();
}
