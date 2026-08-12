import {
  defaultAvailabilityWindow,
  unavailableYmdsFromBookings,
  type BookingSpanRow,
} from "@/lib/bookings/unavailableDates";
import { RENTAL_INVENTORY_BLOCKING_STATUSES } from "@/lib/bookings/rental-lifecycle";
import { getWebsiteRentalBySlug } from "@/lib/rentals/public-catalog";
import {
  estimateCartGrandTotal,
  estimateCartRentalSubtotal,
  estimateMileageFee,
  estimateRentalDeliveryFee,
  normalizeDistanceMiles,
  resolveNewFoamDurationLabel,
  resolveNewRentalDuration,
} from "@/lib/rentals/rental-pricing-text";
import {
  insertPendingBooking,
  type CreateBookingResult,
} from "@/lib/supabase/booking-data";
import { createServiceRoleClient, isSupabaseServiceConfigured } from "@/lib/supabase/admin";

import type {
  AvailabilityQuery,
  AvailabilityResult,
  BookingAttemptResult,
  RentalBookingRequest,
} from "../types";

export interface RentalAvailabilityPort {
  checkAvailability(query: AvailabilityQuery): Promise<AvailabilityResult>;
}

export interface RentalBookingPort {
  createPendingBooking(
    request: RentalBookingRequest,
  ): Promise<BookingAttemptResult>;
}

function isValidYmd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidClockTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function validateRentalBookingRequest(
  request: Partial<RentalBookingRequest>,
): { ok: true; value: RentalBookingRequest } | { ok: false; message: string } {
  const rentalItems = request.rentalItems ?? [];
  if (rentalItems.length === 0) {
    return { ok: false, message: "At least one rental item slug is required." };
  }
  const customerName = request.customerName?.trim() ?? "";
  const customerEmail = request.customerEmail?.trim() ?? "";
  const customerPhone = request.customerPhone?.trim() ?? "";
  const eventDateYmd = request.eventDateYmd?.trim() ?? "";
  const eventStartTime = request.eventStartTime?.trim() ?? "";
  const requestedDeliveryWindow = request.requestedDeliveryWindow?.trim() ?? "";
  const eventAddress = request.eventAddress?.trim() ?? "";
  const setupSurface = request.setupSurface?.trim() ?? "";
  const setupAccess = request.setupAccess?.trim() ?? "";
  const paymentMethod = request.paymentMethod?.trim() ?? "";
  const idempotencyKey = request.idempotencyKey?.trim() ?? "";

  if (
    !idempotencyKey ||
    idempotencyKey.length > 128 ||
    !customerName ||
    customerName === "Guest" ||
    !customerEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) ||
    !customerPhone ||
    !isValidYmd(eventDateYmd) ||
    !isValidClockTime(eventStartTime) ||
    !requestedDeliveryWindow ||
    !eventAddress ||
    !setupSurface ||
    !setupAccess ||
    !paymentMethod
  ) {
    return {
      ok: false,
      message:
        "Missing required booking fields (customer, date/time, address, setup, payment method, or idempotency key).",
    };
  }

  return {
    ok: true,
    value: {
      idempotencyKey,
      rentalItems: rentalItems.map((item) => ({
        rentalItem: item.rentalItem.trim(),
        rentalName: item.rentalName?.trim(),
      })),
      customerName,
      customerEmail,
      customerPhone,
      eventDateYmd,
      eventStartTime,
      requestedDeliveryWindow,
      eventAddress,
      setupSurface,
      setupAccess,
      paymentMethod,
      durationLabel: request.durationLabel?.trim(),
      setupNotes: request.setupNotes?.trim(),
      distanceMiles: request.distanceMiles ?? null,
    },
  };
}

/**
 * In-memory availability for simulated E2E tests (no Supabase).
 */
export class SimRentalAvailabilityAdapter implements RentalAvailabilityPort {
  constructor(private readonly unavailableBySlug = new Map<string, string[]>()) {}

  async checkAvailability(query: AvailabilityQuery): Promise<AvailabilityResult> {
    const slug = query.rentalItem.trim();
    if (!slug) {
      return { ok: false, code: "invalid_rental", message: "rental_item is required" };
    }
    return {
      ok: true,
      rentalItem: slug,
      unavailableYmds: this.unavailableBySlug.get(slug) ?? [],
    };
  }

  setUnavailable(slug: string, ymds: string[]) {
    this.unavailableBySlug.set(slug, [...ymds].sort());
  }
}

/**
 * In-memory pending booking store for simulated E2E tests.
 */
export class SimRentalBookingAdapter implements RentalBookingPort {
  private readonly byIdempotency = new Map<
    string,
    { bookingId: string; request: RentalBookingRequest }
  >();
  private readonly blockedDates = new Set<string>();

  blockDate(ymd: string) {
    this.blockedDates.add(ymd);
  }

  async createPendingBooking(
    request: RentalBookingRequest,
  ): Promise<BookingAttemptResult> {
    const validated = validateRentalBookingRequest(request);
    if (!validated.ok) {
      return { ok: false, code: "missing_fields", message: validated.message };
    }
    const existing = this.byIdempotency.get(validated.value.idempotencyKey);
    if (existing) {
      return {
        ok: true,
        bookingId: existing.bookingId,
        status: "pending",
        message:
          "Your rental request is already on file and pending Jumping Jax confirmation.",
      };
    }
    if (this.blockedDates.has(validated.value.eventDateYmd)) {
      return {
        ok: false,
        code: "conflict",
        message: "That date is unavailable for the selected rental.",
      };
    }
    const bookingId = `sim-booking-${this.byIdempotency.size + 1}`;
    this.byIdempotency.set(validated.value.idempotencyKey, {
      bookingId,
      request: validated.value,
    });
    return {
      ok: true,
      bookingId,
      status: "pending",
      message:
        "I submitted your rental request. It is pending Jumping Jax confirmation — this is not a final booking yet.",
    };
  }
}

/**
 * Live SoT availability adapter (read-only against bookings inventory).
 */
export class SupabaseRentalAvailabilityAdapter implements RentalAvailabilityPort {
  async checkAvailability(query: AvailabilityQuery): Promise<AvailabilityResult> {
    const rentalItem = query.rentalItem.trim();
    const rental = rentalItem ? await getWebsiteRentalBySlug(rentalItem) : undefined;
    if (!rentalItem || !rental) {
      return {
        ok: false,
        code: "invalid_rental",
        message: "A valid rental item is required.",
      };
    }
    if (!isSupabaseServiceConfigured()) {
      return {
        ok: false,
        code: "unavailable",
        message: "Availability is temporarily unavailable.",
      };
    }

    const monthsAhead = Math.min(36, Math.max(1, query.monthsAhead ?? 6));
    const { winStart, winEnd } = defaultAvailabilityWindow(monthsAhead);
    const supabase = createServiceRoleClient();

    const { data: primaryRows, error } = await supabase
      .from("bookings")
      .select("event_date, span_days")
      .eq("rental_item", rentalItem)
      .in("status", [...RENTAL_INVENTORY_BLOCKING_STATUSES]);

    if (error) {
      return {
        ok: false,
        code: "unavailable",
        message: "Availability is temporarily unavailable.",
      };
    }

    const { data: childItems } = await supabase
      .from("booking_rental_items")
      .select("booking_id")
      .eq("rental_item", rentalItem);

    const childIds = [
      ...new Set((childItems ?? []).map((row) => row.booking_id as string)),
    ];
    let secondaryRows: BookingSpanRow[] = [];
    if (childIds.length > 0) {
      const { data } = await supabase
        .from("bookings")
        .select("event_date, span_days")
        .in("id", childIds)
        .in("status", [...RENTAL_INVENTORY_BLOCKING_STATUSES]);
      secondaryRows = (data ?? []) as BookingSpanRow[];
    }

    const ymds = unavailableYmdsFromBookings(
      [...((primaryRows ?? []) as BookingSpanRow[]), ...secondaryRows],
      winStart,
      winEnd,
    );
    return { ok: true, rentalItem, unavailableYmds: ymds };
  }
}

/**
 * Live SoT booking adapter — creates pending rentals only (owner approval still required).
 */
export class SupabaseRentalBookingAdapter implements RentalBookingPort {
  async createPendingBooking(
    request: RentalBookingRequest,
  ): Promise<BookingAttemptResult> {
    const validated = validateRentalBookingRequest(request);
    if (!validated.ok) {
      return { ok: false, code: "missing_fields", message: validated.message };
    }

    const normalizedItems = (
      await Promise.all(
        validated.value.rentalItems.map(async (item) => {
          const rental = await getWebsiteRentalBySlug(item.rentalItem);
          return rental
            ? {
                rental_item: rental.slug,
                rental_name: rental.title,
                starting_price: rental.startingPrice,
              }
            : null;
        }),
      )
    ).filter(
      (
        item,
      ): item is {
        rental_item: string;
        rental_name: string;
        starting_price: number;
      } => item !== null,
    );

    if (
      normalizedItems.length === 0 ||
      normalizedItems.length !== validated.value.rentalItems.length
    ) {
      return {
        ok: false,
        code: "invalid_input",
        message: "One or more rental items were not found in the catalog.",
      };
    }

    const lineItems = normalizedItems.map((item) => ({
      rental_item: item.rental_item,
      rental_name: item.rental_name,
    }));
    const resolvedDuration = resolveNewRentalDuration(
      lineItems,
      validated.value.durationLabel ?? "",
    );
    const durationLabel = resolvedDuration.label;
    const spanDays = resolvedDuration.spanDays;
    const foamDurationLabel = resolveNewFoamDurationLabel(
      lineItems,
      validated.value.durationLabel ?? "",
      durationLabel,
    );
    const distanceMiles = normalizeDistanceMiles(validated.value.distanceMiles);
    const mileageFee = estimateMileageFee(distanceMiles);
    const deliveryFee = estimateRentalDeliveryFee(distanceMiles);
    const subtotal = estimateCartRentalSubtotal(
      lineItems,
      durationLabel,
      spanDays,
      foamDurationLabel,
    );
    const total = estimateCartGrandTotal(
      lineItems,
      durationLabel,
      spanDays,
      deliveryFee,
      foamDurationLabel,
    );

    const result: CreateBookingResult = await insertPendingBooking({
      idempotencyKey: validated.value.idempotencyKey,
      rental_items: lineItems,
      customerName: validated.value.customerName,
      email: validated.value.customerEmail,
      phone: validated.value.customerPhone,
      eventDateYmd: validated.value.eventDateYmd,
      durationLabel,
      foamDurationLabel,
      spanDays,
      eventAddress: validated.value.eventAddress,
      event_start_time: validated.value.eventStartTime,
      requested_delivery_window: validated.value.requestedDeliveryWindow,
      distance_miles: distanceMiles,
      delivery_fee: deliveryFee,
      mileage_fee: mileageFee,
      setup_location: validated.value.eventAddress,
      setup_surface: validated.value.setupSurface,
      setup_access: validated.value.setupAccess,
      setup_notes: validated.value.setupNotes ?? "",
      payment_method: validated.value.paymentMethod,
      subtotal,
      total,
    });

    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        message:
          result.message ??
          (result.code === "conflict"
            ? "That rental is unavailable for the selected dates."
            : "Unable to save the rental request."),
      };
    }

    return {
      ok: true,
      bookingId: result.id,
      status: "pending",
      message:
        "I submitted your rental request. It is pending Jumping Jax confirmation — this is not a final booking yet.",
    };
  }
}
