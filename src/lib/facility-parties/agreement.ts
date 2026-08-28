import { createHmac, createHash } from "node:crypto";

import { contact } from "@/data/site";
import { getWaiverHmacSecret, hmacIpAddress } from "@/lib/waivers/tokens";

export const AGREEMENT_POLICIES = [
  "The $50 deposit is nonrefundable.",
  "The remaining balance is due before the party begins.",
  "Charges for children above the package limit are due on the party date.",
  "Each additional child age 3 or older is $10. Each additional child age 2 or younger is $7.",
  "Jumping Jax does not provide food with the party.",
  "Jumping Jax provides prepackaged drinks.",
  "Socks are required.",
] as const;

export type AgreementPayment = {
  id?: string;
  amount: number;
  paymentKind: string;
  paymentMethod: string;
  paidAt: string;
  posReceiptNumber: string | null;
  recordedBy: string;
  notes: string | null;
};

export type FacilityAgreementSnapshot = {
  businessName: "Jumping Jax";
  businessPhone: string;
  businessAddress: string;
  bookingId: string;
  customerName: string;
  parentName: string;
  email: string;
  phone: string;
  childName: string;
  partyLabel: string;
  partyDate: string;
  partyTime: string;
  roomLabel: string;
  includedChildren: number;
  additionalChildrenAge3Plus: number;
  additionalChildrenAge2Under: number;
  additionalChildrenCharge: number;
  packagePrice: number;
  addonSubtotal: number;
  addonText: string;
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
  payments: AgreementPayment[];
  paidTotal: number;
  balanceDue: number;
  policies: readonly string[];
};

export type AgreementStatus = "sent" | "signed" | "superseded";

export type AdminAgreementSummary = {
  id: string;
  version: number;
  status: AgreementStatus;
  emailStatus: "pending" | "sent" | "failed";
  createdAt: string;
  sentAt: string | null;
  signedAt: string | null;
  signerLegalName: string | null;
  snapshot: FacilityAgreementSnapshot;
};

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function nonnegativeInteger(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.floor(parsed), 100);
}

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function includedChildrenForRoom(room: string | null, partyKind: string | null): number {
  if (room === "room-10") return 10;
  if (room === "room-20" || partyKind === "private") return 20;
  return 20;
}

export function roomAgreementLabel(room: string | null, partyKind: string | null): string {
  if (partyKind === "private") return "Private full-facility party · 20-child package";
  if (room === "room-10") return "Public play party · 10-child room";
  return "Public play party · 20-child room";
}

export function calculateAgreementPricing(input: {
  packagePrice: number | null;
  addonSubtotal: number | null;
  storedSubtotal: number | null;
  storedTax: number | null;
  additionalChildrenAge3Plus: unknown;
  additionalChildrenAge2Under: unknown;
}) {
  const age3Plus = nonnegativeInteger(input.additionalChildrenAge3Plus);
  const age2Under = nonnegativeInteger(input.additionalChildrenAge2Under);
  const packagePrice = money(numeric(input.packagePrice));
  const addonSubtotal = money(numeric(input.addonSubtotal));
  const storedSubtotal = numeric(input.storedSubtotal);
  const storedTax = numeric(input.storedTax);
  const taxRate = storedSubtotal > 0 && storedTax >= 0
    ? Math.round((storedTax / storedSubtotal) * 10000) / 10000
    : 0.07;
  const additionalChildrenCharge = money(age3Plus * 10 + age2Under * 7);
  const subtotal = money(packagePrice + addonSubtotal + additionalChildrenCharge);
  const tax = money(subtotal * taxRate);
  return {
    additionalChildrenAge3Plus: age3Plus,
    additionalChildrenAge2Under: age2Under,
    additionalChildrenCharge,
    packagePrice,
    addonSubtotal,
    subtotal,
    taxRate,
    tax,
    total: money(subtotal + tax),
  };
}

export function buildFacilityAgreementSnapshot(input: {
  booking: {
    id: string;
    customerName: string;
    email: string | null;
    phone: string | null;
    parentName: string | null;
    childName: string | null;
    partyLabel: string | null;
    readableDate: string | null;
    readableTime: string | null;
    room: string | null;
    partyKind: string | null;
    facilityPackagePrice: number | null;
    addonSubtotal: number | null;
    subtotal: number | null;
    tax: number | null;
    addonText: string;
  };
  additionalChildrenAge3Plus: unknown;
  additionalChildrenAge2Under: unknown;
}): FacilityAgreementSnapshot {
  const pricing = calculateAgreementPricing({
    packagePrice: input.booking.facilityPackagePrice,
    addonSubtotal: input.booking.addonSubtotal,
    storedSubtotal: input.booking.subtotal,
    storedTax: input.booking.tax,
    additionalChildrenAge3Plus: input.additionalChildrenAge3Plus,
    additionalChildrenAge2Under: input.additionalChildrenAge2Under,
  });
  return {
    businessName: "Jumping Jax",
    businessPhone: contact.phone,
    businessAddress: contact.address ?? "559 Beaudrot Rd, Greenwood, SC",
    bookingId: input.booking.id,
    customerName: input.booking.customerName,
    parentName: input.booking.parentName ?? input.booking.customerName,
    email: input.booking.email ?? "",
    phone: input.booking.phone ?? "",
    childName: input.booking.childName ?? "Birthday child",
    partyLabel: input.booking.partyLabel ?? "Birthday party",
    partyDate: input.booking.readableDate ?? "Date not set",
    partyTime: input.booking.readableTime ?? "Time not set",
    roomLabel: roomAgreementLabel(input.booking.room, input.booking.partyKind),
    includedChildren: includedChildrenForRoom(input.booking.room, input.booking.partyKind),
    ...pricing,
    addonText: input.booking.addonText,
    payments: [],
    paidTotal: 0,
    balanceDue: pricing.total,
    policies: AGREEMENT_POLICIES,
  };
}

export function agreementToken(agreementId: string): string {
  const secret = getWaiverHmacSecret();
  if (!secret) throw new Error("agreement_hmac_secret_missing");
  return createHmac("sha256", secret)
    .update(`facility-party-agreement-token:v1:${agreementId}`)
    .digest("base64url");
}

export function hashAgreementToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function agreementIpHmac(ip: string | null | undefined): string | null {
  return hmacIpAddress(ip);
}

export function agreementUrl(siteUrl: string, agreementId: string): string {
  return new URL(`/facility-party-agreement/${agreementToken(agreementId)}`, siteUrl).toString();
}

export function agreementEmailText(input: {
  snapshot: FacilityAgreementSnapshot;
  url: string;
  version: number;
}): string {
  const latestPayment = input.snapshot.payments.at(-1);
  const paymentLine = latestPayment
    ? `Payment recorded: $${Number(latestPayment.amount).toFixed(2)} (${latestPayment.paymentKind.replaceAll("_", " ")})`
    : `Payments recorded to date: $${Number(input.snapshot.paidTotal).toFixed(2)}`;
  return [
    `Hi ${input.snapshot.parentName},`,
    "",
    "Jumping Jax has prepared your birthday party agreement and payment receipt.",
    paymentLine,
    `Party total: $${Number(input.snapshot.total).toFixed(2)}`,
    `Balance remaining: $${Number(input.snapshot.balanceDue).toFixed(2)}`,
    "",
    "Please review and electronically sign the current agreement:",
    input.url,
    "",
    `Party: ${input.snapshot.partyLabel}`,
    `Date: ${input.snapshot.partyDate}`,
    `Time: ${input.snapshot.partyTime}`,
    `Agreement version: ${input.version}`,
  ].join("\n");
}

export function requestIp(req: Request): string | null {
  return (
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}
