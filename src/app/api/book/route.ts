import { NextResponse } from "next/server";
import { insertPendingBooking } from "@/lib/supabase/booking-data";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  console.log("[api/book] request received");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (error) {
    console.error("BOOK API ERROR:", error);
    return NextResponse.json(
      {
        ok: false,
        error: String(error),
      },
      { status: 500 },
    );
  }

  console.log("[api/book] request body", body);

  const rentalItem =
    typeof body.rental_item === "string" && body.rental_item.trim()
      ? body.rental_item.trim()
      : null;

  const result = await insertPendingBooking({
    rental_item: rentalItem,
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

  console.log("SUPABASE RESULT:", result);

  if (!result.ok) {
    console.error("SUPABASE FULL ERROR:", result);
    const error = result.message ?? result.code ?? result;
    console.error("BOOK API ERROR:", error);
    return NextResponse.json(
      {
        ok: false,
        error: String(error),
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: result.id });
}
