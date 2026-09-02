import {
  type ResolvedFacilityAddonLine,
} from "@/lib/facility-parties/addons";
import {
  formatFacilityPricingLines,
  type FacilityPricingResult,
} from "@/lib/facility-parties/pricing";

export type FacilityBookingCalendarFields = {
  id: string;
  customer_name: string;
  email: string | null;
  phone: string | null;
  parent_name: string | null;
  child_name: string | null;
  child_gender: string | null;
  child_age: string | null;
  party_theme: string | null;
  invitation?: unknown;
  balloon_colors: string | null;
  table_cloth_colors: string | null;
  drink_choice: string | null;
  payment_method: string | null;
  deposit_acknowledged: boolean | null;
  party_label: string | null;
  room: string | null;
  readable_date: string | null;
  readable_time: string | null;
  start_time: string;
  end_time: string;
  notes: string | null;
  addon_selections: unknown;
  facility_package_price: number | null;
  addon_subtotal: number | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  pricing_details: unknown;
  google_calendar_event_id: string | null;
  google_calendar_secondary_event_id: string | null;
};

function numberOrZero(value: number | null): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function facilityPricingFromBooking(
  booking: FacilityBookingCalendarFields,
): FacilityPricingResult {
  const taxRate =
    booking.pricing_details &&
    typeof booking.pricing_details === "object" &&
    typeof (booking.pricing_details as { taxRate?: unknown }).taxRate ===
      "number"
      ? (booking.pricing_details as { taxRate: number }).taxRate
      : 0.07;

  return {
    packagePrice: numberOrZero(booking.facility_package_price),
    addonSubtotal: numberOrZero(booking.addon_subtotal),
    subtotal: numberOrZero(booking.subtotal),
    tax: numberOrZero(booking.tax),
    total: numberOrZero(booking.total),
    taxRate,
    missingPrice: null,
  };
}

function addonLinesFromStored(stored: unknown): ResolvedFacilityAddonLine[] {
  if (!stored || typeof stored !== "object") {
    return [];
  }
  const record = stored as { lines?: ResolvedFacilityAddonLine[] };
  return Array.isArray(record.lines) ? record.lines : [];
}

function formatCalendarAddonLine(line: ResolvedFacilityAddonLine): string {
  const price = `$${Number.isInteger(line.lineTotal) ? line.lineTotal : line.lineTotal.toFixed(2)}`;

  if (line.key === "goodieBags") {
    return `- Goodie Bags (x${line.quantity}) (${price})`;
  }

  if (line.key === "cottonCandy10" || line.key === "cottonCandy20") {
    const kids = line.detail ?? "";
    return `- Cotton Candy (${kids}) (${price})`;
  }

  return `- ${line.label} (${price})`;
}

export function formatFacilityCalendarDescription(
  booking: FacilityBookingCalendarFields,
): string {
  const sections: string[] = [
    "Customer:",
    `Name: ${booking.customer_name}`,
  ];

  if (booking.email) {
    sections.push(`Email: ${booking.email}`);
  }
  if (booking.phone) {
    sections.push(`Phone: ${booking.phone}`);
  }
  if (booking.parent_name) {
    sections.push(`Parent: ${booking.parent_name}`);
  }

  sections.push("", "Booking:");
  if (booking.party_label) {
    sections.push(`Type: ${booking.party_label}`);
  }
  if (booking.child_name) {
    sections.push(`Child: ${booking.child_name}`);
  }
  if (booking.child_gender) {
    sections.push(`Child gender: ${booking.child_gender}`);
  }
  if (booking.child_age) {
    sections.push(`Child age: ${booking.child_age}`);
  }
  if (booking.party_theme) {
    sections.push(`Theme: ${booking.party_theme}`);
  }
  if (booking.balloon_colors) {
    sections.push(`Balloon colors: ${booking.balloon_colors}`);
  }
  if (booking.table_cloth_colors) {
    sections.push(`Table cloth colors: ${booking.table_cloth_colors}`);
  }
  if (booking.drink_choice) {
    sections.push(`Drink choice: ${booking.drink_choice}`);
  }
  if (booking.payment_method) {
    sections.push(`Payment method: ${booking.payment_method}`);
  }
  sections.push(
    `Deposit acknowledgement: ${
      booking.deposit_acknowledged ? "Checked" : "Not checked"
    }`,
  );
  if (booking.room) {
    sections.push(`Room: ${booking.room}`);
  }

  const timeValue =
    booking.readable_time && booking.readable_date
      ? `${booking.readable_date}, ${booking.readable_time}`
      : booking.readable_time
        ? booking.readable_time
        : `${booking.start_time} - ${booking.end_time}`;
  sections.push(`Time: ${timeValue}`);

  const addonLines = addonLinesFromStored(booking.addon_selections);
  if (addonLines.length > 0) {
    sections.push("", "Add-ons:");
    for (const line of addonLines) {
      sections.push(formatCalendarAddonLine(line));
    }
  }
  sections.push(
    "",
    ...formatFacilityPricingLines(facilityPricingFromBooking(booking)),
  );

  const notes = booking.notes?.trim();
  if (notes) {
    sections.push("", "Notes:", notes);
  }

  return sections.join("\n");
}
