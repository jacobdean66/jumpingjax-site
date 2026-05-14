import { NextResponse } from "next/server";
import { insertPendingBooking } from "@/lib/supabase/booking-data";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  console.log("[api/book] request received");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (e) {
    console.error("[api/book] invalid JSON body", e);
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  console.log("[api/book] request body", body);

  const result = await insertPendingBooking({
    rentalSlug:
      typeof body.rental_slug === "string" && body.rental_slug.trim()
        ? body.rental_slug.trim()
        : "unknown",
    rentalName:
      typeof body.rental_item === "string" && body.rental_item.trim()
        ? body.rental_item.trim()
        : "Rental",
    customerName:
      typeof body.customer_name === "string" && body.customer_name.trim()
        ? body.customer_name.trim()
        : "Guest",
    email:
      typeof body.customer_email === "string" && body.customer_email.trim()
        ? body.customer_email.trim()
        : "unknown@example.com",
    phone:
      typeof body.customer_phone === "string" ? body.customer_phone.trim() : "",
    eventDateYmd:
      typeof body.event_date === "string" && body.event_date.trim()
        ? body.event_date.trim()
        : new Date().toISOString().slice(0, 10),
    durationLabel:
      typeof body.duration === "string" ? body.duration.trim() : "Standard",
    spanDays:
      typeof body.span_days === "number" && body.span_days >= 1
        ? body.span_days
        : 1,
    eventAddress:
      typeof body.event_address === "string" ? body.event_address.trim() : "",
    subtotal: typeof body.subtotal === "number" ? body.subtotal : 0,
    total:
      typeof body.total === "number"
        ? body.total
        : typeof body.subtotal === "number"
          ? body.subtotal
          : 0,
  });

  console.log("[api/book] Supabase response", result);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.message ?? result.code },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: result.id });
}
