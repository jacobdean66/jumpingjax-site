import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  buildDriverCloseoutItemPatch,
  parseDriverWorkType,
  validateDriverMutationContext,
} from "@/lib/admin/driver-app";
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
  const date = clean(form.get("date"));
  const truck = clean(form.get("truck"));
  const bookingId = clean(form.get("bookingId"));
  const itemId = clean(form.get("itemId") || form.get("bookingRentalItemId"));
  const workType = parseDriverWorkType(clean(form.get("workType")));
  const nextUrl = clean(form.get("nextUrl"));
  const nextBookingId = clean(form.get("nextBookingId"));
  const view = clean(form.get("view"));

  const auth = await verifyAdminAccess(token);
  if (!auth.ok) {
    return redirectDriver(req, { error: "Invalid driver link" });
  }

  if (!bookingId || !itemId || !date || !truck || !workType) {
    return redirectDriver(req, {
      token,
      date,
      truck,
      view,
      error: "Unable to save end-of-day notes",
    });
  }

  try {
    const paid = checked(form.get("paid"));
    const cashPayment = checked(form.get("cashPayment"));
    const creditPayment = checked(form.get("creditPayment"));
    const notifyNextCustomer = checked(form.get("notifyNextCustomer"));

    const supabase = createServiceRoleClient();

    const { data: booking, error: bookingLoadError } = await supabase
      .from("bookings")
      .select("id, event_date, span_days")
      .eq("id", bookingId)
      .in("status", ["pending", "approved"])
      .maybeSingle<{
        id: string | number;
        event_date: string | null;
        span_days: number | null;
      }>();

    if (bookingLoadError || !booking) {
      throw new Error(bookingLoadError?.message ?? "Booking not found for closeout");
    }

    const { data: itemRow, error: itemLoadError } = await supabase
      .from("booking_rental_items")
      .select(
        "id, booking_id, delivery_date, delivery_truck, trailer_load, pickup_date, pickup_truck, pickup_trailer_load",
      )
      .eq("id", itemId)
      .eq("booking_id", bookingId)
      .maybeSingle<{
        id: string;
        booking_id: string | number;
        delivery_date: string | null;
        delivery_truck: string | null;
        trailer_load: number | null;
        pickup_date: string | null;
        pickup_truck: string | null;
        pickup_trailer_load: number | null;
      }>();

    if (itemLoadError || !itemRow) {
      throw new Error(itemLoadError?.message ?? "Rental item not found for closeout");
    }

    const eventDate = (booking.event_date ?? "").slice(0, 10);
    const context = validateDriverMutationContext({
      bookingId,
      itemId,
      workType,
      item: {
        id: itemRow.id,
        bookingId: String(itemRow.booking_id),
        deliveryDate: itemRow.delivery_date?.slice(0, 10) ?? null,
        deliveryTruck: itemRow.delivery_truck,
        trailerLoad: itemRow.trailer_load,
        pickupDate: itemRow.pickup_date?.slice(0, 10) ?? null,
        pickupTruck: itemRow.pickup_truck,
        pickupTrailerLoad: itemRow.pickup_trailer_load,
        eventDate,
        spanDays: booking.span_days && booking.span_days > 0 ? booking.span_days : 1,
      },
      submittedTruck: truck,
      submittedDate: date,
      requireAssignedTruck: true,
    });

    if (!context.ok) {
      throw new Error(context.reason);
    }

    // Validate live plan context before writing closeout or status.
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

    const itemPatch = buildDriverCloseoutItemPatch({ workType });
    const { error: itemError } = await supabase
      .from("booking_rental_items")
      .update(itemPatch)
      .eq("id", itemId)
      .eq("booking_id", bookingId);
    if (itemError) throw new Error(itemError.message);

    const bookingUpdate: Record<string, string | null> = {};
    const paymentMethod = cashPayment ? "Cash" : creditPayment ? "Credit" : null;
    if (paymentMethod) bookingUpdate.payment_method = paymentMethod;
    if (paid) {
      bookingUpdate.payment_confirmed_at = new Date().toISOString();
      bookingUpdate.payment_confirmed_by = auth.identity.name;
      bookingUpdate.payment_confirmation_notes = clean(form.get("notes")) || null;
    }

    if (Object.keys(bookingUpdate).length > 0) {
      const { error: bookingError } = await supabase
        .from("bookings")
        .update(bookingUpdate)
        .eq("id", bookingId)
        .in("status", ["pending", "approved"]);
      if (bookingError) throw new Error(bookingError.message);
    }

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
        const pickupCopy = workType === "pickup";
        const { error: emailError } = await resend.emails.send({
          from: getResendFromAddress(),
          to: customerEmail,
          subject: pickupCopy
            ? "Jumping Jax is on the way for pickup"
            : "Jumping Jax is on the way",
          text: [
            `Hi ${nextBooking?.customer_name?.trim() || "there"},`,
            "",
            pickupCopy
              ? "Your Jumping Jax crew is on the way to pick up your rental."
              : "Your Jumping Jax delivery crew is on the way to your rental.",
            "",
            nextBooking?.event_date ? `Event date: ${nextBooking.event_date}` : null,
            nextBooking?.event_start_time
              ? `Party start time: ${nextBooking.event_start_time}`
              : null,
            !pickupCopy && nextBooking?.requested_delivery_window
              ? `Requested delivery window: ${nextBooking.requested_delivery_window}`
              : null,
            nextBooking?.event_address
              ? `${pickupCopy ? "Pickup" : "Delivery"} address: ${nextBooking.event_address}`
              : null,
            "",
            pickupCopy
              ? "Please make sure the inflatable is ready for pickup."
              : "Please make sure the setup area is clear and accessible.",
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

    return redirectDriver(req, {
      token,
      date,
      truck,
      view,
      message: "End-of-day notes saved",
    });
  } catch (error) {
    return redirectDriver(req, {
      token,
      date,
      truck,
      view,
      error: error instanceof Error ? error.message : "Unable to save end-of-day notes",
    });
  }
}
