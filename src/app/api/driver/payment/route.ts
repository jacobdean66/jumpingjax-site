import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function redirectDriver(
  req: Request,
  params: Record<string, string | undefined>,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return NextResponse.redirect(new URL(`/driver?${search.toString()}`, req.url), 303);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const token = clean(form.get("token"));
  const bookingId = clean(form.get("bookingId"));
  const date = clean(form.get("date"));
  const truck = clean(form.get("truck"));
  const notes = clean(form.get("notes"));
  const view = clean(form.get("view"));

  const auth = await verifyAdminAccess(token);
  if (!auth.ok) {
    return redirectDriver(req, { error: "Invalid driver link" });
  }

  if (!bookingId) {
    return redirectDriver(req, {
      token,
      date,
      truck,
      view,
      error: "Missing booking",
    });
  }

  const supabase = createServiceRoleClient();
  const { data: booking, error: loadError } = await supabase
    .from("bookings")
    .select("id")
    .eq("id", bookingId)
    .in("status", ["pending", "approved"])
    .maybeSingle<{ id: string | number }>();

  if (loadError || !booking) {
    return redirectDriver(req, {
      token,
      date,
      truck,
      view,
      error: loadError?.message ?? "Booking not found",
    });
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      payment_confirmed_at: new Date().toISOString(),
      payment_confirmed_by: auth.identity.name,
      payment_confirmation_notes: notes || null,
    })
    .eq("id", bookingId)
    .in("status", ["pending", "approved"]);

  return redirectDriver(req, {
    token,
    date,
    truck,
    view,
    message: error ? error.message : "Payment confirmed",
    error: error ? error.message : undefined,
  });
}
