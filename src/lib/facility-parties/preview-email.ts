import { createHash } from "node:crypto";
import { z } from "zod";
import {
  FACILITY_INVITATION_DELIVERY_PREFERENCES,
  FACILITY_INVITATION_QUANTITIES,
  normalizeInvitationDeliveryPreferences,
} from "./invitations";
import { invitationSnapshotFromChoice } from "./invitations/snapshot";
import { confirmedThemeSchema } from "./invitations/theme-search";
import { isCanonicalFacilityBookingYmd } from "./booking-horizon";
import { readConfirmedTheme } from "./invitations/theme-token";

import { equalDigest, previewEnabled, validId } from "./preview-session";
export { previewEnabled, previewToken, validId, validToken } from "./preview-session";

export const options = [
  { optionIndex: 0, label: "Spotlight" },
  { optionIndex: 1, label: "Portrait" },
  { optionIndex: 2, label: "Banner" },
] as const;

export function authorized(request: Request): boolean {
  const key = process.env.RECEPTIONIST_INVITATION_PREVIEW_API_KEY;
  if (!previewEnabled() || !key || key.length < 32 || key.length > 256 || !/^[\x21-\x7e]+$/.test(key)) return false;
  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  return supplied.length > 0 && supplied.length <= 256 && equalDigest(supplied, key);
}

const shortText = (max: number) => z.string().trim().min(1).max(max).regex(/^[^\x00-\x1f\x7f]+$/);
const optionalText = (max: number) => z.string().trim().max(max).regex(/^[^\x00-\x1f\x7f]*$/).default("");
const previewInput = z.object({
  requestKey: z.string().trim().regex(/^[A-Za-z0-9._:-]{16,128}$/),
  email: z.string().trim().max(254).email().transform(value => value.toLowerCase()),
  childName: shortText(80),
  childAge: z.string().trim().regex(/^(?:[1-9]|1[0-8])?$/).default(""),
  childBirthdate: z.string().trim().refine(isCanonicalFacilityBookingYmd).optional(),
  customerPhone: optionalText(40),
  balloonColors: optionalText(160),
  tableClothColors: optionalText(160),
  partyTheme: shortText(160),
  partyDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const time = Date.parse(value);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
  }),
  partyTime: shortText(80),
  confirmationToken: z.string().min(1).max(18000).optional(),
  chooseArtworkOnPage: z.literal(true).optional(),
}).strict();

export function parsePreview(value: unknown) {
  const parsed = previewInput.safeParse(value);
  if (!parsed.success) return null;
  const { confirmationToken, chooseArtworkOnPage, childBirthdate, ...input } = parsed.data;
  if (childBirthdate) {
    const partyDate = input.partyDate;
    const yearDifference = Number(partyDate.slice(0, 4)) - Number(childBirthdate.slice(0, 4));
    // Month/day comparison advances a February 29 birthday on March 1 in a non-leap year.
    const age = yearDifference - Number(partyDate.slice(5) < childBirthdate.slice(5));
    if (age < 1 || age > 18 || (input.childAge && input.childAge !== String(age))) return null;
    input.childAge = String(age);
  }
  if (chooseArtworkOnPage) {
    return childBirthdate && !confirmationToken && input.partyTheme.length >= 2
      ? { ...input, confirmedTheme: null } : null;
  }
  const confirmedTheme = readConfirmedTheme(confirmationToken, input.partyTheme);
  return confirmedTheme ? { ...input, confirmedTheme } : null;
}

export function payloadHash(value: NonNullable<ReturnType<typeof parsePreview>>) {
  return createHash("sha256").update(JSON.stringify([
    value.email, value.childName, value.partyTheme, value.partyDate, value.partyTime,
    value.childAge, value.customerPhone, value.balloonColors, value.tableClothColors,
    ...(value.confirmedTheme ? [value.confirmedTheme.id, value.confirmedTheme.imagePath] : ["pending-artwork-v1"]),
  ])).digest("hex");
}

const selectionInput = z.object({
  requestId: z.string().refine(validId),
  optionIndex: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  deliveryPreferences: z.array(z.enum(FACILITY_INVITATION_DELIVERY_PREFERENCES)).min(1).max(3)
    .refine(values => new Set(values).size === values.length)
    .transform(normalizeInvitationDeliveryPreferences),
  quantity: z.number().refine(value => FACILITY_INVITATION_QUANTITIES.some(quantity => quantity === value)),
}).strict();

export function parsePreviewSelection(value: unknown) {
  const parsed = selectionInput.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function previewLayouts(partyTheme: string, storedTheme: unknown, colorHint: string) {
  const theme = confirmedThemeSchema.safeParse(storedTheme);
  if (!theme.success || theme.data.label !== partyTheme) return null;
  return options.map(option => ({
    ...option,
    snapshot: invitationSnapshotFromChoice(partyTheme, option.optionIndex, 0, colorHint, theme.data),
  }));
}

// Start at row creation, leaving one hour of margin before the provider's key expires.
export function safeToRetry(createdAt: unknown, now = Date.now()): boolean {
  if (typeof createdAt !== "string") return false;
  const created = Date.parse(createdAt);
  return Number.isFinite(created) && created <= now && now - created < 23 * 60 * 60 * 1000;
}