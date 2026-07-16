import { NextResponse } from "next/server";
import { Resend } from "resend";
import { verifyAdminAccess } from "@/lib/admin/session";
import { getResendFromAddress } from "@/lib/email/resend";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set([
  "planned",
  "on-the-way",
  "delivered",
  "setup-complete",
  "picked-up",
]);

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  const form = await req.formData();
  const token = clean(form.get("token"));
  const bookingId = clean(form.get("bookingId"));
  const date = clean(form.get("date"));
  const status = clean(form.get("status"));
  const truck = clean(form.get("truck"));
  const notes = clean(form.get("notes"));

  const auth = await verifyAdminAccess();
  if (!auth.ok) {
    return NextResponse.redirect(
      new URL(`/driver?error=${encodeURIComponent("Invalid driver link")}`, req.url),
      303,
    );
  }

  if (!bookingId || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.redirect(
      new URL(
        `/driver?token=${encodeURIComponent(token)}&date=${encodeURIComponent(date)}&error=${encodeURIComponent("Unable to update stop")}`,
        req.url,
      ),
      303,
    );
  }

  const update = {
    delivery_route_status: status,
    delivery_route_notes: notes || null,
  };
  const supabase = createServiceRoleClient();
  const { data: booking, error: bookingLoadError } = await supabase
    .from("bookings")
    .select(
      "id, customer_name, customer_email, customer_phone, event_date, event_address, event_start_time, requested_delivery_window",
    )
    .eq("id", bookingId)
    .in("status", ["pending", "approved"])
    .maybeSingle<{
      id: string | number;
      customer_name: string | null;
      customer_email: string | null;
      customer_phone: string | null;
      event_date: string | null;
      event_address: string | null;
      event_start_time: string | null;
      requested_delivery_window: string | null;
    }>();

  if (bookingLoadError || !booking) {
    return NextResponse.redirect(
      new URL(
        `/driver?token=${encodeURIComponent(token)}&date=${encodeURIComponent(date)}&truck=${encodeURIComponent(truck)}&error=${encodeURIComponent(bookingLoadError?.message ?? "Stop not found")}`,
        req.url,
      ),
      303,
    );
  }

  const bookingUpdate = await supabase
    .from("bookings")
    .update(update)
    .eq("id", bookingId)
    .in("status", ["pending", "approved"]);

  if (bookingUpdate.error) {
    return NextResponse.redirect(
      new URL(
        `/driver?token=${encodeURIComponent(token)}&date=${encodeURIComponent(date)}&truck=${encodeURIComponent(truck)}&error=${encodeURIComponent(bookingUpdate.error.message)}`,
        req.url,
      ),
      303,
    );
  }

  const itemUpdate = await supabase
    .from("booking_rental_items")
    .update(update)
    .eq("booking_id", bookingId);

  if (itemUpdate.error) {
    return NextResponse.redirect(
      new URL(
        `/driver?token=${encodeURIComponent(token)}&date=${encodeURIComponent(date)}&truck=${encodeURIComponent(truck)}&error=${encodeURIComponent(itemUpdate.error.message)}`,
        req.url,
      ),
      303,
    );
  }

  let message = "Stop updated";
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (status === "on-the-way") {
    const customerEmail = booking.customer_email?.trim();
    if (resendApiKey && customerEmail) {
      try {
        const resend = new Resend(resendApiKey);
        const { error: emailError } = await resend.emails.send({
          from: getResendFromAddress(),
          to: customerEmail,
          subject: "Jumping Jax is on the way",
          text: [
            `Hi ${booking.customer_name?.trim() || "there"},`,
            "",
            "Your Jumping Jax delivery crew is on the way.",
            "",
            booking.event_date ? `Event date: ${booking.event_date}` : null,
            booking.event_start_time
              ? `Party start time: ${booking.event_start_time}`
              : null,
            booking.requested_delivery_window
              ? `Requested delivery window: ${booking.requested_delivery_window}`
              : null,
            booking.event_address
              ? `Delivery address: ${booking.event_address}`
              : null,
            "",
            "Please make sure the setup area is clear and accessible.",
            "Thank you for booking with Jumping Jax.",
          ]
            .filter((line): line is string => line !== null)
            .join("\n"),
        });
        message = emailError
          ? "Stop updated, but customer email failed"
          : "Customer emailed: on the way";
      } catch {
        message = "Stop updated, but customer email failed";
      }
    } else {
      message = "Stop updated, but no customer email was available";
    }
  }

  const params = new URLSearchParams({
    token,
    date,
    message,
  });
  if (truck) params.set("truck", truck);
  return NextResponse.redirect(new URL(`/driver?${params.toString()}`, req.url), 303);
}
