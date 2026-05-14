import { NextResponse } from "next/server";
import { createServiceRoleClient, isSupabaseServiceConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  console.log("[api/book] request received");

  if (!isSupabaseServiceConfigured()) {
    console.error("[api/book] missing Supabase env", {
      hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          "Server missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      },
      { status: 500 },
    );
  }

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

  const bookingData = {
    rental_slug:
      typeof body.rental_slug === "string" && body.rental_slug.trim()
        ? body.rental_slug.trim()
        : "unknown",
    rental_name:
      typeof body.rental_item === "string" && body.rental_item.trim()
        ? body.rental_item.trim()
        : "Rental",
    customer_name:
      typeof body.customer_name === "string" && body.customer_name.trim()
        ? body.customer_name.trim()
        : "Guest",
    email:
      typeof body.customer_email === "string" && body.customer_email.trim()
        ? body.customer_email.trim()
        : "unknown@example.com",
    phone:
      typeof body.customer_phone === "string" ? body.customer_phone.trim() : "",
    event_date:
      typeof body.event_date === "string" && body.event_date.trim()
        ? body.event_date.trim()
        : new Date().toISOString().slice(0, 10),
    duration:
      typeof body.duration === "string" ? body.duration.trim() : "Standard",
    span_days:
      typeof body.span_days === "number" && body.span_days >= 1
        ? body.span_days
        : 1,
    event_address:
      typeof body.event_address === "string" ? body.event_address.trim() : "",
    subtotal: typeof body.subtotal === "number" ? body.subtotal : 0,
    total:
      typeof body.total === "number"
        ? body.total
        : typeof body.subtotal === "number"
          ? body.subtotal
          : 0,
    status: "pending" as const,
  };

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("bookings")
    .insert([bookingData])
    .select("id")
    .single();

  console.log("[api/book] Supabase response", { data, error });

  if (error) {
    console.error("[api/book] Supabase insert error", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}
