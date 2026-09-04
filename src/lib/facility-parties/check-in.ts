import { buildAbsoluteUrl, CANONICAL_PRODUCTION_SITE_URL } from "@/lib/site-url";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export type FacilityPartyCheckInContext = {
  bookingId: string;
  partyDate: string | null;
};

export type FacilityPartyGuest = {
  id: string;
  participantId: string;
  submissionId: string;
  firstName: string;
  lastName: string;
  dob: string;
  role: string;
  signerName: string;
  waiverExpiresOn: string;
  checkedInAt: string | null;
  checkedInBy: string | null;
  createdAt: string;
};

export type PublicFacilityPartyGuest = {
  id: string;
  displayName: string;
  checkedInAt: string;
};

export type PublicFacilityParty = {
  id: string;
  title: string;
  partyLabel: string;
  date: string;
  time: string;
  checkedInGuests: PublicFacilityPartyGuest[];
};

export type FacilityPartyWaiverMatch = {
  participantId: string;
  firstName: string;
  lastName: string;
  ageYears: number | null;
};

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function cleanPartyCheckInText(value: unknown, max = 80): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

export function normalizePartyDate(value: unknown): string | null {
  const cleaned = cleanPartyCheckInText(value, 40);
  return cleaned ? cleaned : null;
}

export function normalizeGuestDob(value: unknown): string {
  const cleaned = cleanPartyCheckInText(value, 10);
  return YMD_RE.test(cleaned) ? cleaned : "";
}

export function buildFacilityPartyCheckInUrl(input: {
  siteUrl?: string | null;
  bookingId: string;
  partyDate: string | null | undefined;
}): string {
  return buildAbsoluteUrl(
    "/facility-party-check-in",
    input.siteUrl || CANONICAL_PRODUCTION_SITE_URL,
    {
      booking: input.bookingId,
      ...(normalizePartyDate(input.partyDate) ? { date: normalizePartyDate(input.partyDate)! } : {}),
    },
  );
}

export function buildFacilityPartyWaiverSignUrl(input: {
  siteUrl?: string | null;
  bookingId: string;
  partyDate: string | null | undefined;
  arrival?: boolean;
}): string {
  return buildAbsoluteUrl(
    "/waiver",
    input.siteUrl || CANONICAL_PRODUCTION_SITE_URL,
    {
      source: "facility-party",
      booking: input.bookingId,
      ...(normalizePartyDate(input.partyDate) ? { date: normalizePartyDate(input.partyDate)! } : {}),
      ...(input.arrival ? { arrival: "1" } : {}),
    },
  );
}

export function partyCheckInArrivalMessage(partyDate: string | null | undefined): string {
  const suffix = partyDate ? ` for the party on ${partyDate}` : " for the party";
  return `You are checked in${suffix}. Your name is now on the live guest list.`;
}

export function partyCheckInSigningMessage(partyDate: string | null | undefined): string {
  const suffix = partyDate ? ` for the party on ${partyDate}` : " for the party";
  return `We did not find your waiver yet. Sign the waiver and we will check you in${suffix}.`;
}
