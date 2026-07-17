import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  allowedStatusForWorkType,
  buildDriverStatusItemPatch,
  onTheWayEmailCopy,
  parseDriverWorkType,
  shouldSendOnTheWayNotification,
  validateDriverMutationContext,
} from "@/lib/admin/driver-app";
import { verifyAdminAccess } from "@/lib/admin/session";
import { getResendFromAddress } from "@/lib/email/resend";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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
  const itemId = clean(form.get("itemId") || form.get("bookingRentalItemId"));
  const date = clean(form.get("date"));
  const status = clean(form.get("status"));
  const truck = clean(form.get("truck"));
  const notes = clean(form.get("notes"));
  const clearNotes = clean(form.get("clearNotes")) === "1";
  const workType = parseDriverWorkType(clean(form.get("workType")));
  const view = clean(form.get("view"));

  const auth = await verifyAdminAccess(token);
  if (!auth.ok) {
    return redirectDriver(req, { error: "Invalid driver link" });
  }

  if (!bookingId || !itemId || !workType || !allowedStatusForWorkType(workType, status)) {
    return redirectDriver(req, {
      token,
      date,
      truck,
      view,
      error: "Unable to update stop",
    });
  }

  const supabase = createServiceRoleClient();
  const { data: booking, error: bookingLoadError } = await supabase
    .from("bookings")
    .select(
      "id, customer_name, customer_email, customer_phone, event_date, event_address, event_start_time, requested_delivery_window, span_days",
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
      span_days: number | null;
    }>();

  if (bookingLoadError || !booking) {
    return redirectDriver(req, {
      token,
      date,
      truck,
      view,
      error: bookingLoadError?.message ?? "Stop not found",
    });
  }

  const { data: itemRow, error: itemLoadError } = await supabase
    .from("booking_rental_items")
    .select(
      "id, booking_id, delivery_date, delivery_truck, trailer_load, delivery_route_status, pickup_date, pickup_truck, pickup_trailer_load, pickup_route_status",
    )
    .eq("id", itemId)
    .eq("booking_id", bookingId)
    .maybeSingle<{
      id: string;
      booking_id: string | number;
      delivery_date: string | null;
      delivery_truck: string | null;
      trailer_load: number | null;
      delivery_route_status: string | null;
      pickup_date: string | null;
      pickup_truck: string | null;
      pickup_trailer_load: number | null;
      pickup_route_status: string | null;
    }>();

  if (itemLoadError || !itemRow) {
    return redirectDriver(req, {
      token,
      date,
      truck,
      view,
      error: itemLoadError?.message ?? "Rental item not found",
    });
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
    submittedTruck: truck || null,
    submittedDate: date || null,
    requireAssignedTruck: true,
  });

  if (!context.ok) {
    return redirectDriver(req, {
      token,
      date,
      truck,
      view,
      error: context.reason,
    });
  }

  const itemPatch = buildDriverStatusItemPatch({
    workType,
    status,
    notes: notes || null,
    clearNotes,
  });

  const currentStatus =
    workType === "delivery"
      ? itemRow.delivery_route_status
      : itemRow.pickup_route_status;
  const shouldNotify = shouldSendOnTheWayNotification({
    requestedStatus: status,
    currentStatus,
  });
  const statusColumn =
    workType === "delivery" ? "delivery_route_status" : "pickup_route_status";

  let itemUpdateQuery = supabase
    .from("booking_rental_items")
    .update(itemPatch)
    .eq("id", itemId)
    .eq("booking_id", bookingId);

  // Claim an on-the-way transition using the status that was validated above. If
  // another request wins this comparison, this request must not send another email.
  if (shouldNotify) {
    itemUpdateQuery =
      currentStatus === null
        ? itemUpdateQuery.is(statusColumn, null)
        : itemUpdateQuery.eq(statusColumn, currentStatus);
  }

  const itemUpdate = await itemUpdateQuery.select("id").maybeSingle<{ id: string }>();

  if (itemUpdate.error) {
    return redirectDriver(req, {
      token,
      date,
      truck,
      view,
      error: itemUpdate.error.message,
    });
  }

  let message = "Stop updated";
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (shouldNotify && !itemUpdate.data) {
    message = "Stop was already updated";
  } else if (shouldNotify) {
    const customerEmail = booking.customer_email?.trim();
    if (resendApiKey && customerEmail) {
      try {
        const copy = onTheWayEmailCopy({
          workType,
          customerName: booking.customer_name,
          eventDate: booking.event_date,
          eventStartTime: booking.event_start_time,
          requestedDeliveryWindow: booking.requested_delivery_window,
          eventAddress: booking.event_address,
        });
        const resend = new Resend(resendApiKey);
        const { error: emailError } = await resend.emails.send({
          from: getResendFromAddress(),
          to: customerEmail,
          subject: copy.subject,
          text: copy.text,
        });
        message = emailError
          ? "Stop updated, but customer email failed"
          : workType === "pickup"
            ? "Customer emailed: pickup on the way"
            : "Customer emailed: on the way";
      } catch {
        message = "Stop updated, but customer email failed";
      }
    } else {
      message = "Stop updated, but no customer email was available";
    }
  }

  return redirectDriver(req, {
    token,
    date,
    truck,
    view,
    message,
  });
}
