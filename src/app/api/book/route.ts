import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const body = await req.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const bookingData = {
    rental_slug: body.rental_slug || "unknown",
    rental_name: body.rental_item || "Rental",
    customer_name: body.customer_name || "Guest",
    email: body.customer_email || "unknown@example.com",
    phone: body.customer_phone || "",
    event_date: body.event_date || new Date().toISOString().slice(0, 10),
    duration: body.duration || "Standard",
    span_days: body.span_days && body.span_days >= 1 ? body.span_days : 1,
    event_address: body.event_address || "",
    subtotal: typeof body.subtotal === "number" ? body.subtotal : 0,
    total:
      typeof body.total === "number"
        ? body.total
        : typeof body.subtotal === "number"
          ? body.subtotal
          : 0,
    status: "pending",
  };

  const { data, error } = await supabase
    .from("bookings")
    .insert([bookingData]);

  if (error) {
    console.error("SUPABASE INSERT ERROR:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500 },
    );
  }

  console.log("INSERT SUCCESS:", data);

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
