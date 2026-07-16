import { NextResponse } from "next/server";
import { Resend } from "resend";
import { saveDriverCloseoutReport } from "@/lib/admin/driver-closeout";
import { verifyAdminAccess } from "@/lib/admin/session";
import { getResendFromAddress } from "@/lib/email/resend";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function checked(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

export async function POST(req: Request) {
  const form = await req.formData();
  const token = clean(form.get("token"));
  const date = clean(form.get("date"));
  const truck = clean(form.get("truck"));
  const bookingId = clean(form.get("bookingId"));
  const nextUrl = clean(form.get("nextUrl"));
  const nextBookingId = clean(form.get("nextBookingId"));

  const auth = await verifyAdminAccess();
  if (!auth.ok) {
    return NextResponse.redirect(
      new URL(`/driver?error=${encodeURIComponent("Invalid driver link")}`, req.url),
      303,
    );
  }

  if (!bookingId || !date || !truck) {
    const params = new URLSearchParams({
      token,
      date,
      error: "Unable to save end-of-day notes",
    });
    if (truck) params.set("truck", truck);
    return NextResponse.redirect(new URL(`/driver?${params.toString()}`, req.url), 303);
  }

  try {
    const paid = checked(form.get("paid"));
    const cashPayment = checked(form.get("cashPayment"));
    const creditPayment = checked(form.get("creditPayment"));
    const notifyNextCustomer = checked(form.get("notifyNextCustomer"));

    await saveDriverCloseoutReport({
      bookingId,
      eventDate: date,
      truck,
      driverName: auth.identity.name,
      damageIssue: checked(form.get("damageIssue")),
      missingItemIssue: checked(form.get("missingItemIssue")),
      customerIssue: checked(form.get("customerIssue")),
      siteAccessIssue: checked(form.get("siteAccessIssue")),
      latePickupIssue: checked(form.get("latePickupIssue")),
      officeFollowupNeeded: checked(form.get("officeFollowupNeeded")),
      outOfSlideSpray: checked(form.get("outOfSlideSpray")),
      cashPayment,
      creditPayment,
      paid,
      unpaid: checked(form.get("unpaid")),
      boughtGas: checked(form.get("boughtGas")),
      boughtDrinks: checked(form.get("boughtDrinks")),
      customerHappy: checked(form.get("customerHappy")),
      notes: clean(form.get("notes")),
    });

    const supabase = createServiceRoleClient();
    const bookingUpdate: Record<string, string | null> = {
      delivery_route_status: "picked-up",
    };
    const paymentMethod = cashPayment ? "Cash" : creditPayment ? "Credit" : null;
    if (paymentMethod) bookingUpdate.payment_method = paymentMethod;
    if (paid) {
      bookingUpdate.payment_confirmed_at = new Date().toISOString();
      bookingUpdate.payment_confirmed_by = auth.identity.name;
      bookingUpdate.payment_confirmation_notes = clean(form.get("notes")) || null;
    }

    const { error: bookingError } = await supabase
      .from("bookings")
      .update(bookingUpdate)
      .eq("id", bookingId)
      .in("status", ["pending", "approved"]);
    if (bookingError) throw new Error(bookingError.message);

    const { error: itemError } = await supabase
      .from("booking_rental_items")
      .update({ delivery_route_status: "picked-up" })
      .eq("booking_id", bookingId);
    if (itemError) throw new Error(itemError.message);

    if (notifyNextCustomer && nextBookingId) {
      const { data: nextBooking, error: nextBookingError } = await supabase
        .from("bookings")
        .select(
          "id, customer_name, customer_email, event_date, event_address, event_start_time, requested_delivery_window",
        )
        .eq("id", nextBookingId)
        .in("status", ["pending", "approved"])
        .maybeSingle<{
          id: string | number;
          customer_name: string | null;
          customer_email: string | null;
          event_date: string | null;
          event_address: string | null;
          event_start_time: string | null;
          requested_delivery_window: string | null;
        }>();

      if (nextBookingError) throw new Error(nextBookingError.message);
      const resendApiKey = process.env.RESEND_API_KEY?.trim();
      const customerEmail = nextBooking?.customer_email?.trim();

      if (resendApiKey && customerEmail) {
        const resend = new Resend(resendApiKey);
        const { error: emailError } = await resend.emails.send({
          from: getResendFromAddress(),
          to: customerEmail,
          subject: "Jumping Jax is on the way",
          text: [
            `Hi ${nextBooking?.customer_name?.trim() || "there"},`,
            "",
            "Your Jumping Jax delivery crew is on the way to your rental.",
            "",
            nextBooking?.event_date ? `Event date: ${nextBooking.event_date}` : null,
            nextBooking?.event_start_time
              ? `Party start time: ${nextBooking.event_start_time}`
              : null,
            nextBooking?.requested_delivery_window
              ? `Requested delivery window: ${nextBooking.requested_delivery_window}`
              : null,
            nextBooking?.event_address
              ? `Delivery address: ${nextBooking.event_address}`
              : null,
            "",
            "Please make sure the setup area is clear and accessible.",
            "Thank you for booking with Jumping Jax.",
          ]
            .filter((line): line is string => line !== null)
            .join("\n"),
        });
        if (emailError) throw new Error("Checklist saved, but next customer email failed.");
      }
    }

    if (nextUrl.startsWith("https://www.google.com/maps/")) {
      return NextResponse.redirect(nextUrl, 303);
    }

    const params = new URLSearchParams({
      token,
      date,
      truck,
      message: "End-of-day notes saved",
    });
    return NextResponse.redirect(new URL(`/driver?${params.toString()}`, req.url), 303);
  } catch (error) {
    const params = new URLSearchParams({
      token,
      date,
      truck,
      error: error instanceof Error ? error.message : "Unable to save end-of-day notes",
    });
    return NextResponse.redirect(new URL(`/driver?${params.toString()}`, req.url), 303);
  }
}
