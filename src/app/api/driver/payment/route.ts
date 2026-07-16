import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  const form = await req.formData();
  const token = clean(form.get("token"));
  const bookingId = clean(form.get("bookingId"));
  const date = clean(form.get("date"));
  const truck = clean(form.get("truck"));
  const notes = clean(form.get("notes"));

  const auth = await verifyAdminAccess();
  if (!auth.ok) {
    return NextResponse.redirect(
      new URL(`/driver?error=${encodeURIComponent("Invalid driver link")}`, req.url),
      303,
    );
  }

  if (!bookingId) {
    return NextResponse.redirect(
      new URL(
        `/driver?token=${encodeURIComponent(token)}&date=${encodeURIComponent(date)}&error=${encodeURIComponent("Missing booking")}`,
        req.url,
      ),
      303,
    );
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("bookings")
    .update({
      payment_confirmed_at: new Date().toISOString(),
      payment_confirmed_by: auth.identity.name,
      payment_confirmation_notes: notes || null,
    })
    .eq("id", bookingId)
    .in("status", ["pending", "approved"]);

  const params = new URLSearchParams({
    token,
    date,
    message: error ? error.message : "Payment confirmed",
  });
  if (truck) params.set("truck", truck);
  if (error) params.set("error", error.message);

  return NextResponse.redirect(new URL(`/driver?${params.toString()}`, req.url), 303);
}
