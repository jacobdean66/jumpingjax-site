import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  computeTaxExportTotals,
  dateBasisLabel,
  taxExportToCsv,
  toTaxExportLine,
  type TaxExportDateBasis,
  type TaxExportLine,
  type TaxExportSourceBooking,
} from "@/lib/admin/tax-export";

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function moneyNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed =
    typeof value === "string" ? Number(value.replace(/[^0-9.-]/g, "")) : value;
  return Number.isFinite(parsed) ? parsed : null;
}

function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function loadTaxExportBookings(input: {
  from: string;
  to: string;
  dateBasis: TaxExportDateBasis;
}): Promise<{
  lines: TaxExportLine[];
  csv: string;
  dateBasisLabel: string;
}> {
  // Production bookings do not store a creation timestamp column. Keep the
  // "created" date-basis option in the UI, but fail closed instead of querying
  // a missing created_at field.
  if (input.dateBasis === "created") {
    throw new Error(
      "Booking creation-date filtering is unavailable because bookings do not store created_at.",
    );
  }

  const supabase = createServiceRoleClient();

  let query = supabase
    .from("bookings")
    .select(
      "id, status, customer_name, customer_email, customer_phone, event_address, event_date, delivery_time, span_days, payment_method, payment_confirmed_at, subtotal, delivery_fee, mileage_fee, total, rental_item, rental_name",
    )
    .order("event_date", { ascending: true });

  if (input.dateBasis === "payment") {
    query = query
      .gte("payment_confirmed_at", `${input.from}T00:00:00`)
      .lte("payment_confirmed_at", `${input.to}T23:59:59.999`);
  } else {
    query = query.gte("event_date", input.from).lte("event_date", input.to);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const ids = rows.map((row) => row.id);
  const itemMap = new Map<
    string,
    { rental_item: string; rental_name: string; quantity?: number }[]
  >();

  if (ids.length > 0) {
    const { data: itemRows, error: itemError } = await supabase
      .from("booking_rental_items")
      .select("booking_id, rental_item, rental_name")
      .in("booking_id", ids);
    if (itemError) throw new Error(itemError.message);
    for (const item of itemRows ?? []) {
      const key = String(item.booking_id);
      itemMap.set(key, [
        ...(itemMap.get(key) ?? []),
        {
          rental_item: clean(item.rental_item) ?? "rental",
          rental_name:
            clean(item.rental_name) ?? clean(item.rental_item) ?? "Rental",
          quantity: 1,
        },
      ]);
    }
  }

  const sources: TaxExportSourceBooking[] = rows.map((row) => {
    const id = String(row.id);
    const eventDate = String(row.event_date).slice(0, 10);
    const span =
      typeof row.span_days === "number" && row.span_days >= 1
        ? row.span_days
        : 1;
    const fallbackItems = [
      {
        rental_item: clean(row.rental_item) ?? "rental",
        rental_name: clean(row.rental_name) ?? clean(row.rental_item) ?? "Rental",
        quantity: 1,
      },
    ];
    return {
      id,
      createdAt: null,
      status: clean(row.status) ?? "pending",
      customerName: clean(row.customer_name) ?? "Guest",
      customerEmail: clean(row.customer_email),
      customerPhone: clean(row.customer_phone),
      eventAddress: clean(row.event_address),
      eventDate,
      deliveryDate: eventDate,
      pickupDate: addDays(eventDate, Math.max(0, span - 1)),
      paymentMethod: clean(row.payment_method),
      paymentConfirmedAt: clean(row.payment_confirmed_at),
      subtotal: moneyNumber(row.subtotal),
      deliveryFee: moneyNumber(row.delivery_fee),
      mileageFee: moneyNumber(row.mileage_fee),
      total: moneyNumber(row.total),
      // Rental catalog prices are tax-inclusive; no separate tax column exists.
      tax: null,
      discount: null,
      refundAmount: null,
      amountPaid: null,
      items: itemMap.get(id) ?? fallbackItems,
    };
  });

  const lines = sources.map(toTaxExportLine);
  const totals = computeTaxExportTotals(lines);
  const csv = taxExportToCsv(lines, totals, {
    dateBasis: input.dateBasis,
    from: input.from,
    to: input.to,
  });

  return {
    lines,
    csv,
    dateBasisLabel: dateBasisLabel(input.dateBasis),
  };
}
