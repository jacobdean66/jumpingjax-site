import { getRentalBySlug } from "@/data/rentals";
import {
  MOCK_DURATION_OPTIONS,
  MOCK_SERVICE_FEE,
  estimateRentalSubtotal,
} from "@/lib/mockBooking";

export type RentalLineInput = {
  rental_item?: string;
  rental_name?: string;
};

export function formatUsd(amount: number): string {
  return `$${Math.round(amount)}`;
}

export function durationMultiplierForBooking(
  durationLabel: string,
  spanDays: number,
): number {
  const label = durationLabel.trim();
  const byLabel = MOCK_DURATION_OPTIONS.find((d) => d.label === label);
  if (byLabel) return byLabel.priceMultiplier;

  const bySpan = MOCK_DURATION_OPTIONS.find((d) => d.spanDays === spanDays);
  return bySpan?.priceMultiplier ?? 1;
}

export function estimateCartRentalSubtotal(
  items: RentalLineInput[],
  durationLabel: string,
  spanDays: number,
): number {
  const multiplier = durationMultiplierForBooking(durationLabel, spanDays);
  return items.reduce((sum, item) => {
    const slug =
      typeof item.rental_item === "string" ? item.rental_item.trim() : "";
    const rental = slug ? getRentalBySlug(slug) : undefined;
    if (!rental) return sum;
    return sum + estimateRentalSubtotal(rental.startingPrice, multiplier);
  }, 0);
}

export function estimateCartGrandTotal(
  items: RentalLineInput[],
  durationLabel: string,
  spanDays: number,
  serviceFee: number = MOCK_SERVICE_FEE,
): number {
  return (
    estimateCartRentalSubtotal(items, durationLabel, spanDays) + serviceFee
  );
}

export function buildRentalListWithPrices(
  items: RentalLineInput[],
  durationLabel: string,
  spanDays: number,
): string {
  const multiplier = durationMultiplierForBooking(durationLabel, spanDays);

  return items
    .map((item) => {
      const slug =
        typeof item.rental_item === "string" ? item.rental_item.trim() : "";
      const name =
        (typeof item.rental_name === "string" && item.rental_name.trim()) ||
        slug ||
        "Rental";
      const rental = slug ? getRentalBySlug(slug) : undefined;
      if (!rental) {
        return `- ${name}`;
      }
      const itemEstimate = estimateRentalSubtotal(
        rental.startingPrice,
        multiplier,
      );
      return `- ${name} (estimated ${formatUsd(itemEstimate)})`;
    })
    .join("\n");
}

export function formatEstimatedTotalLine(total: number | null | undefined): string {
  if (total == null || !Number.isFinite(Number(total))) {
    return "Estimated total: —";
  }
  return `Estimated total: ${formatUsd(Number(total))}`;
}

export function buildRentalCalendarDescription(input: {
  items: RentalLineInput[];
  durationLabel: string;
  spanDays: number;
  total: number | null | undefined;
  eventDateYmd: string;
  deliveryTime?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  eventAddress?: string | null;
  bookingId: string;
}): string {
  const lines = [
    `Booking ID: ${input.bookingId}`,
    `Customer: ${input.customerName}`,
    input.customerPhone ? `Phone: ${input.customerPhone}` : null,
    input.customerEmail ? `Email: ${input.customerEmail}` : null,
    `Event date: ${input.eventDateYmd}`,
    input.deliveryTime ? `Delivery time: ${input.deliveryTime}` : null,
    input.durationLabel ? `Duration: ${input.durationLabel}` : null,
    input.spanDays > 1 ? `Span: ${input.spanDays} days` : null,
    input.eventAddress ? `Event address: ${input.eventAddress}` : null,
    "",
    "Rentals:",
    buildRentalListWithPrices(
      input.items,
      input.durationLabel,
      input.spanDays,
    ),
    "",
    formatEstimatedTotalLine(input.total),
    "(Mock estimate — final quote confirmed by Jumping Jax.)",
  ];

  return lines.filter((line): line is string => line !== null).join("\n");
}

export function rentalCalendarDateTimes(
  eventDateYmd: string,
  deliveryTime: string | null | undefined,
  spanDays: number,
): { start: string; end: string } {
  const raw = (deliveryTime ?? "09:00").trim();
  const timePart = raw.length >= 5 ? raw.slice(0, 5) : "09:00";
  const start = `${eventDateYmd}T${timePart}:00`;

  const [y, m, d] = eventDateYmd.split("-").map(Number);
  const endDate = new Date(y, m - 1, d, 12, 0, 0, 0);
  endDate.setDate(endDate.getDate() + Math.max(1, spanDays));
  const endYmd = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

  return { start, end: `${endYmd}T${timePart}:00` };
}
