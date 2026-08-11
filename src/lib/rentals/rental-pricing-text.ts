import { getRentalBySlug } from "@/data/rentals";
import {
  FOAM_DURATION_OPTIONS,
  MOCK_DURATION_OPTIONS,
  MOCK_SERVICE_FEE,
  ONE_DAY_RENTAL_DURATION,
  estimateRentalSubtotal,
} from "@/lib/mockBooking";

export const FOAM_PARTY_RENTAL_ITEM = "foam-party";
export const JUMPING_JAX_FACILITY_ADDRESS =
  "559 Beaudrot Rd, Greenwood, SC";
export const RENTAL_DELIVERY_BASE_FEE = MOCK_SERVICE_FEE;
export const RENTAL_INCLUDED_DELIVERY_MILES = 25;
export const RENTAL_EXTRA_MILE_RATE = 2;
// Owner-confirmed policy: catalog rental prices are tax-inclusive. Do not add a
// second percentage surcharge unless a future configured tax model replaces it.
export const RENTAL_PRICES_INCLUDE_TAX = true;

export type RentalLineInput = {
  rental_item?: string;
  rental_name?: string;
  starting_price?: number;
};

// Kept only for rendering/recalculating historical rows. New bookings are
// canonicalized to the selectable One Day option before pricing or storage.
const LEGACY_STANDARD_DURATION_MULTIPLIERS = [
  { label: "Half Day", spanDays: 1, priceMultiplier: 0.72 },
  { label: "Full Day", spanDays: 1, priceMultiplier: 1 },
  { label: "2-day weekend", spanDays: 2, priceMultiplier: 1.82 },
  { label: "3-day event", spanDays: 3, priceMultiplier: 2.58 },
] as const;

function standardDurationMultiplier(
  durationLabel: string,
  spanDays: number,
): number {
  const normalizedLabel = durationLabel.trim().toLowerCase();
  const current = MOCK_DURATION_OPTIONS.find(
    (duration) => duration.label.toLowerCase() === normalizedLabel,
  );
  if (current) return current.priceMultiplier;

  const legacyByLabel = LEGACY_STANDARD_DURATION_MULTIPLIERS.find(
    (duration) => duration.label.toLowerCase() === normalizedLabel,
  );
  if (legacyByLabel) return legacyByLabel.priceMultiplier;

  const legacyBySpan = LEGACY_STANDARD_DURATION_MULTIPLIERS.find(
    (duration) => duration.spanDays === spanDays,
  );
  return legacyBySpan?.priceMultiplier ?? 1;
}

export function isFoamPartyRentalItem(slug: string | null | undefined): boolean {
  return slug?.trim() === FOAM_PARTY_RENTAL_ITEM;
}

export function cartContainsFoamParty(items: RentalLineInput[]): boolean {
  return items.some((item) => isFoamPartyRentalItem(item.rental_item));
}

export function cartContainsStandardRental(items: RentalLineInput[]): boolean {
  return items.some((item) => !isFoamPartyRentalItem(item.rental_item));
}

export function resolveFoamDurationOption(
  requestedFoamDurationLabel: string | null | undefined,
) {
  const label = requestedFoamDurationLabel?.trim() ?? "";
  return (
    FOAM_DURATION_OPTIONS.find((option) => option.label === label) ??
    FOAM_DURATION_OPTIONS[0]!
  );
}

/**
 * Booking-level duration for new rentals.
 * Mixed carts (foam + inflatable/accessory) always use One Day.
 * Foam-only carts use the selected foam package label.
 */
export function resolveNewRentalDuration(
  items: RentalLineInput[],
  requestedDurationLabel: string,
): { label: string; spanDays: number } {
  if (cartContainsStandardRental(items)) {
    return {
      label: ONE_DAY_RENTAL_DURATION.label,
      spanDays: ONE_DAY_RENTAL_DURATION.spanDays,
    };
  }

  const resolved = resolveFoamDurationOption(requestedDurationLabel);
  return { label: resolved.label, spanDays: resolved.spanDays };
}

/**
 * Foam package label for carts that include foam.
 * Mixed carts read an independent foam duration; foam-only carts reuse booking duration.
 */
export function resolveNewFoamDurationLabel(
  items: RentalLineInput[],
  requestedFoamDurationLabel: string | null | undefined,
  bookingDurationLabel: string,
): string | null {
  if (!cartContainsFoamParty(items)) {
    return null;
  }

  if (cartContainsStandardRental(items)) {
    return resolveFoamDurationOption(requestedFoamDurationLabel).label;
  }

  return resolveFoamDurationOption(
    requestedFoamDurationLabel?.trim() || bookingDurationLabel,
  ).label;
}

/** Resolve foam package for stored bookings (including historical foam-only rows). */
export function foamDurationLabelForBooking(
  items: RentalLineInput[],
  bookingDurationLabel: string | null | undefined,
  foamDurationLabel: string | null | undefined,
): string | null {
  if (!cartContainsFoamParty(items)) {
    return null;
  }

  const storedFoam = foamDurationLabel?.trim() ?? "";
  if (storedFoam) {
    return resolveFoamDurationOption(storedFoam).label;
  }

  const bookingLabel = bookingDurationLabel?.trim() ?? "";
  const fromBooking = FOAM_DURATION_OPTIONS.find(
    (option) => option.label === bookingLabel,
  );
  return fromBooking?.label ?? FOAM_DURATION_OPTIONS[0]!.label;
}

export function formatUsd(amount: number): string {
  return `$${Math.round(amount)}`;
}

export function durationMultiplierForBooking(
  durationLabel: string,
  spanDays: number,
): number {
  return standardDurationMultiplier(durationLabel, spanDays);
}

function durationMultiplierForRentalItem(
  slug: string,
  durationLabel: string,
  spanDays: number,
  foamDurationLabel?: string | null,
): number {
  if (isFoamPartyRentalItem(slug)) {
    const foamLabel = (foamDurationLabel ?? durationLabel).trim();
    const foamByLabel = FOAM_DURATION_OPTIONS.find((d) => d.label === foamLabel);
    return foamByLabel?.priceMultiplier ?? FOAM_DURATION_OPTIONS[0]!.priceMultiplier;
  }

  return standardDurationMultiplier(durationLabel.trim(), spanDays);
}

export function estimateRentalLineSubtotal(
  item: RentalLineInput,
  durationLabel: string,
  spanDays: number,
  foamDurationLabel?: string | null,
): number | null {
  const slug =
    typeof item.rental_item === "string" ? item.rental_item.trim() : "";
  const rental = slug ? getRentalBySlug(slug) : undefined;
  const startingPrice =
    typeof item.starting_price === "number" && Number.isFinite(item.starting_price)
      ? item.starting_price
      : rental?.startingPrice;
  if (startingPrice == null) return null;

  return estimateRentalSubtotal(
    startingPrice,
    durationMultiplierForRentalItem(
      slug,
      durationLabel,
      spanDays,
      foamDurationLabel,
    ),
  );
}

export function estimateCartRentalSubtotal(
  items: RentalLineInput[],
  durationLabel: string,
  spanDays: number,
  foamDurationLabel?: string | null,
): number | null {
  let subtotal = 0;
  for (const item of items) {
    const lineSubtotal = estimateRentalLineSubtotal(
      item,
      durationLabel,
      spanDays,
      foamDurationLabel,
    );
    if (lineSubtotal == null) return null;
    subtotal += lineSubtotal;
  }
  return subtotal;
}

export function estimateCartGrandTotal(
  items: RentalLineInput[],
  durationLabel: string,
  spanDays: number,
  serviceFee: number = RENTAL_DELIVERY_BASE_FEE,
  foamDurationLabel?: string | null,
): number | null {
  const subtotal = estimateCartRentalSubtotal(
    items,
    durationLabel,
    spanDays,
    foamDurationLabel,
  );
  return subtotal == null ? null : subtotal + serviceFee;
}

export function normalizeDistanceMiles(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function estimateMileageFee(distanceMiles: number | null): number {
  if (distanceMiles == null) {
    return 0;
  }
  return Math.max(
    0,
    Math.ceil(distanceMiles - RENTAL_INCLUDED_DELIVERY_MILES) *
      RENTAL_EXTRA_MILE_RATE,
  );
}

export function estimateRentalDeliveryFee(distanceMiles: number | null): number {
  return RENTAL_DELIVERY_BASE_FEE + estimateMileageFee(distanceMiles);
}

export function formatDeliveryFeeLines(input: {
  deliveryFee: number;
  mileageFee: number;
  distanceMiles: number | null;
}): string[] {
  return [
    `Delivery base fee: ${formatUsd(RENTAL_DELIVERY_BASE_FEE)}`,
    input.distanceMiles != null
      ? `Estimated one-way driving distance: ${input.distanceMiles} miles`
      : "Estimated one-way driving distance: not provided",
    `Mileage after ${RENTAL_INCLUDED_DELIVERY_MILES} miles (${formatUsd(RENTAL_EXTRA_MILE_RATE)}/mile): ${formatUsd(input.mileageFee)}`,
    `Estimated delivery total: ${formatUsd(input.deliveryFee)}`,
  ];
}

export function buildRentalListWithPrices(
  items: RentalLineInput[],
  durationLabel: string,
  spanDays: number,
  foamDurationLabel?: string | null,
): string {
  return items
    .map((item) => {
      const slug =
        typeof item.rental_item === "string" ? item.rental_item.trim() : "";
      const name =
        (typeof item.rental_name === "string" && item.rental_name.trim()) ||
        slug ||
        "Rental";
      const rental = slug ? getRentalBySlug(slug) : undefined;
      const startingPrice =
        typeof item.starting_price === "number" &&
        Number.isFinite(item.starting_price)
          ? item.starting_price
          : rental?.startingPrice;
      const foamLabel =
        isFoamPartyRentalItem(slug) && foamDurationLabel?.trim()
          ? foamDurationLabel.trim()
          : null;
      const displayName = foamLabel ? `${name} — ${foamLabel}` : name;
      if (startingPrice == null) {
        return `- ${displayName}`;
      }
      const itemEstimate = estimateRentalLineSubtotal(
        item,
        durationLabel,
        spanDays,
        foamDurationLabel,
      );
      return `- ${displayName} (estimated ${formatUsd(itemEstimate ?? startingPrice)})`;
    })
    .join("\n");
}

export function formatEstimatedTotalLine(total: number | null | undefined): string {
  if (total == null || !Number.isFinite(Number(total))) {
    return "Estimated total: —";
  }
  return `Estimated total (rental prices include tax): ${formatUsd(Number(total))}`;
}

export function buildRentalCalendarDescription(input: {
  items: RentalLineInput[];
  durationLabel: string;
  spanDays: number;
  foamDurationLabel?: string | null;
  total: number | null | undefined;
  deliveryFee?: number | null;
  mileageFee?: number | null;
  distanceMiles?: number | null;
  eventDateYmd: string;
  deliveryTime?: string | null;
  eventStartTime?: string | null;
  requestedDeliveryWindow?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  eventAddress?: string | null;
  setupSurface?: string | null;
  setupAccess?: string | null;
  setupNotes?: string | null;
  paymentMethod?: string | null;
  bookingId: string;
}): string {
  const foamDurationLabel = foamDurationLabelForBooking(
    input.items,
    input.durationLabel,
    input.foamDurationLabel,
  );
  const lines = [
    `Booking ID: ${input.bookingId}`,
    `Customer: ${input.customerName}`,
    input.customerPhone ? `Phone: ${input.customerPhone}` : null,
    input.customerEmail ? `Email: ${input.customerEmail}` : null,
    `Event date: ${input.eventDateYmd}`,
    input.eventStartTime
      ? `Official party start time: ${input.eventStartTime}`
      : null,
    input.requestedDeliveryWindow
      ? `Requested delivery window: ${input.requestedDeliveryWindow}`
      : input.deliveryTime
        ? `Requested delivery window: ${input.deliveryTime}`
      : null,
    input.durationLabel ? `Duration: ${input.durationLabel}` : null,
    foamDurationLabel && foamDurationLabel !== input.durationLabel
      ? `Foam time: ${foamDurationLabel}`
      : null,
    input.spanDays > 1 ? `Span: ${input.spanDays} days` : null,
    input.eventAddress ? `Event address: ${input.eventAddress}` : null,
    input.setupSurface ? `Setup surface: ${input.setupSurface}` : null,
    input.setupAccess ? `Setup access: ${input.setupAccess}` : null,
    input.setupNotes ? `Setup notes: ${input.setupNotes}` : null,
    input.paymentMethod ? `Payment method: ${input.paymentMethod}` : null,
    "",
    "Rentals:",
    buildRentalListWithPrices(
      input.items,
      input.durationLabel,
      input.spanDays,
      foamDurationLabel,
    ),
    "",
    ...(input.deliveryFee != null && input.mileageFee != null
      ? formatDeliveryFeeLines({
          deliveryFee: input.deliveryFee,
          mileageFee: input.mileageFee,
          distanceMiles: input.distanceMiles ?? null,
        })
      : []),
    formatEstimatedTotalLine(input.total),
    "(Estimate only — final quote confirmed by Jumping Jax.)",
  ];

  return lines.filter((line): line is string => line !== null).join("\n");
}

export function rentalCalendarDateTimes(
  eventDateYmd: string,
  deliveryTime: string | null | undefined,
  spanDays: number,
  eventStartTime?: string | null,
): { start: string; end: string } {
  const raw = (eventStartTime || deliveryTime || "09:00").trim();
  const timeMatch = raw.match(/\b(\d{1,2}):(\d{2})\b/);
  const timePart = timeMatch
    ? `${timeMatch[1]!.padStart(2, "0")}:${timeMatch[2]}`
    : "09:00";
  const start = `${eventDateYmd}T${timePart}:00`;

  const [y, m, d] = eventDateYmd.split("-").map(Number);
  const endDate = new Date(y, m - 1, d, 12, 0, 0, 0);
  endDate.setDate(endDate.getDate() + Math.max(1, spanDays));
  const endYmd = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

  return { start, end: `${endYmd}T${timePart}:00` };
}
