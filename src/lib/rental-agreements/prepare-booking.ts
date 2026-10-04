import { NextResponse } from "next/server";
import { estimateCartGrandTotal, estimateCartRentalSubtotal, estimateMileageFee, estimateRentalDeliveryFee, normalizeDistanceMiles, resolveNewFoamDurationLabel, resolveNewRentalDuration } from "@/lib/rentals/rental-pricing-text";
import { getWebsiteRentalBySlug } from "@/lib/rentals/public-catalog";
import type { CreateBookingInput } from "@/lib/supabase/booking-data";
function isValidYmd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidClockTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function prepareRentalBooking(body: Record<string, unknown>): Promise<Response | { input: CreateBookingInput; lineItems: { rental_item?: string; rental_name?: string }[]; notes: string; electricityDistance: string; waterDistance: string }> {
  const { rental_items } = body;

  const rental_item =
    typeof body.rental_item === "string" && body.rental_item.trim()
      ? body.rental_item.trim()
      : null;

  const requestedRentalItems =
    Array.isArray(rental_items) && rental_items.length > 0
      ? rental_items
      : rental_item
        ? [{ rental_item, rental_name: rental_item }]
        : [];

  if (requestedRentalItems.length > 20) {
    return NextResponse.json({ error: "Too many rental items" }, { status: 400 });
  }

  const normalizedRentalItems = (
    await Promise.all(
      requestedRentalItems.map(async (item) => {
        if (!item || typeof item !== "object") return null;
        const slug = (item as { rental_item?: unknown }).rental_item;
        if (typeof slug !== "string") return null;
        const rental = await getWebsiteRentalBySlug(slug.trim());
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
    normalizedRentalItems.length === 0 ||
    normalizedRentalItems.length !== requestedRentalItems.length ||
    new Set(normalizedRentalItems.map((item) => item.rental_item)).size !==
      normalizedRentalItems.length
  ) {
    return new Response(
      JSON.stringify({ error: "rental_items is required" }),
      { status: 400 },
    );
  }

  const requestedDeliveryWindow =
    typeof body.requested_delivery_window === "string" &&
    body.requested_delivery_window.trim()
      ? body.requested_delivery_window.trim()
      : null;
  const eventStartTime =
    typeof body.event_start_time === "string" && body.event_start_time.trim()
      ? body.event_start_time.trim()
      : null;

  if (!requestedDeliveryWindow || !eventStartTime) {
    return new Response(
      JSON.stringify({
        error: "requested_delivery_window and event_start_time are required",
      }),
      { status: 400 },
    );
  }
  if (requestedDeliveryWindow.length > 100 || !isValidClockTime(eventStartTime)) {
    return NextResponse.json({ error: "Invalid delivery or event time" }, { status: 400 });
  }

  const customerName =
    typeof body.customer_name === "string" && body.customer_name.trim()
      ? body.customer_name.trim()
      : "Guest";
  const customerEmail =
    typeof body.customer_email === "string" && body.customer_email.trim()
      ? body.customer_email.trim()
      : "";
  const idempotencyKey =
    typeof body.idempotency_key === "string" ? body.idempotency_key.trim() : "";
  const customerPhone =
    typeof body.customer_phone === "string" ? body.customer_phone.trim() : "";
  const eventDateYmd =
    typeof body.event_date === "string" && body.event_date.trim()
      ? body.event_date.trim()
      : "";
  if (
    !isValidYmd(eventDateYmd) ||
    !idempotencyKey ||
    idempotencyKey.length > 128 ||
    !customerName || customerName === "Guest" || customerName.length > 120 ||
    !customerPhone || customerPhone.length > 40 ||
    !customerEmail || customerEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
  ) {
    return NextResponse.json(
      { error: "A valid event date, email, and request key are required" },
      { status: 400 },
    );
  }
  const requestedDurationLabel =
    typeof body.duration === "string" ? body.duration.trim() : "";
  const requestedFoamDurationLabel =
    typeof body.foam_duration === "string" ? body.foam_duration.trim() : "";
  const lineItems = normalizedRentalItems as {
    rental_item?: string;
    rental_name?: string;
  }[];
  const resolvedDuration = resolveNewRentalDuration(
    lineItems,
    requestedDurationLabel,
  );
  const durationLabel = resolvedDuration.label;
  const spanDays = resolvedDuration.spanDays;
  const foamDurationLabel = resolveNewFoamDurationLabel(
    lineItems,
    requestedFoamDurationLabel || requestedDurationLabel,
    durationLabel,
  );
  const eventAddress =
    typeof body.event_address === "string" ? body.event_address.trim() : "";
  const distanceMiles = normalizeDistanceMiles(body.distance_miles);
  const mileageFee = estimateMileageFee(distanceMiles);
  const deliveryFee = estimateRentalDeliveryFee(distanceMiles);
  const setupLocation =
    typeof body.setup_location === "string" && body.setup_location.trim()
      ? body.setup_location.trim()
      : eventAddress;
  const setupSurface =
    typeof body.setup_surface === "string" ? body.setup_surface.trim() : "";
  const setupAccess =
    typeof body.setup_access === "string" ? body.setup_access.trim() : "";
  const setupNotes =
    typeof body.setup_notes === "string" ? body.setup_notes.trim() : "";
  const electricityDistance =
    typeof body.electricity_distance === "string"
      ? body.electricity_distance.trim()
      : "";
  const waterDistance =
    typeof body.water_distance === "string" ? body.water_distance.trim() : "";
  const setupNoteLines = [
    electricityDistance
      ? `Electricity distance: ${electricityDistance}`
      : null,
    waterDistance ? `Water distance: ${waterDistance}` : null,
    ...setupNotes.split(/\r?\n/).map((line) => line.trim()),
  ].filter((line): line is string => Boolean(line));
  const savedSetupNotes = Array.from(new Set(setupNoteLines)).join("\n");
  const paymentMethod =
    typeof body.payment_method === "string" ? body.payment_method.trim() : "";
  if (
    !eventAddress || eventAddress.length > 500 ||
    !setupSurface || setupSurface.length > 120 ||
    !setupAccess || setupAccess.length > 500 ||
    !paymentMethod || paymentMethod.length > 80 ||
    savedSetupNotes.length > 2000 ||
    (distanceMiles != null && distanceMiles > 500)
  ) {
    return new Response(
      JSON.stringify({
        error:
          "event_address, setup_surface, setup_access, and payment_method are required",
      }),
      { status: 400 },
    );
  }
  const notes =
    typeof body.notes === "string" && body.notes.trim()
      ? body.notes.trim()
      : "";
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

  if (subtotal == null || total == null) {
    console.error("[api/book] catalog price missing after rental validation");
    return NextResponse.json(
      { error: "A rental price is unavailable. Please refresh and try again." },
      { status: 503 },
    );
  }

  return { input: {
    idempotencyKey,
    rental_items: normalizedRentalItems,
    customerName,
    email: customerEmail || "unknown@example.com",
    phone: customerPhone,
    eventDateYmd,
    durationLabel,
    foamDurationLabel,
    spanDays,
    eventAddress,
    event_start_time: eventStartTime,
    requested_delivery_window: requestedDeliveryWindow,
    distance_miles: distanceMiles,
    delivery_fee: deliveryFee,
    mileage_fee: mileageFee,
    setup_location: setupLocation,
    setup_surface: setupSurface,
    setup_access: setupAccess,
    setup_notes: savedSetupNotes,
    payment_method: paymentMethod,
    subtotal,
    total,
  }, lineItems, notes, electricityDistance, waterDistance };
}
