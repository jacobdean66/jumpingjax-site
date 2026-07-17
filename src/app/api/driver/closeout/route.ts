import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  buildDriverCloseoutItemPatch,
  onTheWayEmailCopy,
  parseDriverWorkType,
  shouldSendOnTheWayNotification,
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
  const nextItemId = clean(form.get("nextItemId"));
  const nextWorkType = parseDriverWorkType(clean(form.get("nextWorkType")));
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

    type NextNotification = {
      booking: {
        customer_name: string | null;
        customer_email: string | null;
        event_date: string | null;
        event_address: string | null;
        event_start_time: string | null;
        requested_delivery_window: string | null;
      };
      bookingId: string;
      itemId: string;
      workType: NonNullable<typeof nextWorkType>;
      statusColumn: "delivery_route_status" | "pickup_route_status";
      currentStatus: string | null;
    };
    let nextNotification: NextNotification | null = null;

    // Validate every submitted task context before the first write. The closeout and
    // notification writes are separate operations, so this prevents a stale next-stop
    // form from partially saving the current stop before it is rejected.
    if (notifyNextCustomer) {
      if (!nextBookingId || !nextItemId || !nextWorkType) {
        throw new Error("Next stop details are incomplete");
      }

      const { data: nextBooking, error: nextBookingError } = await supabase
        .from("bookings")
        .select(
          "id, customer_name, customer_email, event_date, event_address, event_start_time, requested_delivery_window, span_days",
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
          span_days: number | null;
        }>();

      if (nextBookingError || !nextBooking) {
        throw new Error(nextBookingError?.message ?? "Next booking not found");
      }

      const { data: nextItem, error: nextItemError } = await supabase
        .from("booking_rental_items")
        .select(
          "id, booking_id, delivery_date, delivery_truck, trailer_load, delivery_route_status, pickup_date, pickup_truck, pickup_trailer_load, pickup_route_status",
        )
        .eq("id", nextItemId)
        .eq("booking_id", nextBookingId)
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

      if (nextItemError || !nextItem) {
        throw new Error(nextItemError?.message ?? "Next rental item not found");
      }

      const nextContext = validateDriverMutationContext({
        bookingId: nextBookingId,
        itemId: nextItemId,
        workType: nextWorkType,
        item: {
          id: nextItem.id,
          bookingId: String(nextItem.booking_id),
          deliveryDate: nextItem.delivery_date?.slice(0, 10) ?? null,
          deliveryTruck: nextItem.delivery_truck,
          trailerLoad: nextItem.trailer_load,
          pickupDate: nextItem.pickup_date?.slice(0, 10) ?? null,
          pickupTruck: nextItem.pickup_truck,
          pickupTrailerLoad: nextItem.pickup_trailer_load,
          eventDate: (nextBooking.event_date ?? "").slice(0, 10),
          spanDays:
            nextBooking.span_days && nextBooking.span_days > 0
              ? nextBooking.span_days
              : 1,
        },
        submittedTruck: truck,
        submittedDate: date,
        requireAssignedTruck: true,
      });

      if (!nextContext.ok) {
        throw new Error(nextContext.reason);
      }

      const statusColumn =
        nextWorkType === "delivery" ? "delivery_route_status" : "pickup_route_status";
      nextNotification = {
        booking: nextBooking,
        bookingId: nextBookingId,
        itemId: nextItemId,
        workType: nextWorkType,
        statusColumn,
        currentStatus: nextItem[statusColumn],
      };
    }

    // Live-context validation succeeded. Write route completion before the closeout
    // report so a rejected/stale retry cannot leave a report without a status change.
    const itemPatch = buildDriverCloseoutItemPatch({ workType });
    const { data: completedItem, error: itemError } = await supabase
      .from("booking_rental_items")
      .update(itemPatch)
      .eq("id", itemId)
      .eq("booking_id", bookingId)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (itemError) throw new Error(itemError.message);
    if (!completedItem) {
      throw new Error("Stop changed before closeout could be saved. Refresh and try again.");
    }

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

    let message = "End-of-day notes saved";
    let notificationWarning = false;

    if (nextNotification) {
      if (
        shouldSendOnTheWayNotification({
          requestedStatus: "on-the-way",
          currentStatus: nextNotification.currentStatus,
        })
      ) {
        let claim = supabase
          .from("booking_rental_items")
          .update({ [nextNotification.statusColumn]: "on-the-way" })
          .eq("id", nextNotification.itemId)
          .eq("booking_id", nextNotification.bookingId);
        claim =
          nextNotification.currentStatus === null
            ? claim.is(nextNotification.statusColumn, null)
            : claim.eq(nextNotification.statusColumn, nextNotification.currentStatus);
        const { data: claimedItem, error: nextStatusError } = await claim
          .select("id")
          .maybeSingle<{ id: string }>();
        if (nextStatusError) throw new Error(nextStatusError.message);

        if (!claimedItem) {
          message = "End-of-day notes saved; next stop was already updated";
        } else {
          // The status claim is intentionally retained if delivery fails. A later retry
          // therefore will not send a duplicate email; the warning tells the driver that
          // office follow-up is required. These separate writes are not atomic.
          const resendApiKey = process.env.RESEND_API_KEY?.trim();
          const customerEmail = nextNotification.booking.customer_email?.trim();
          if (resendApiKey && customerEmail) {
            try {
              const copy = onTheWayEmailCopy({
                workType: nextNotification.workType,
                customerName: nextNotification.booking.customer_name,
                eventDate: nextNotification.booking.event_date,
                eventStartTime: nextNotification.booking.event_start_time,
                requestedDeliveryWindow:
                  nextNotification.booking.requested_delivery_window,
                eventAddress: nextNotification.booking.event_address,
              });
              const resend = new Resend(resendApiKey);
              const { error: emailError } = await resend.emails.send({
                from: getResendFromAddress(),
                to: customerEmail,
                subject: copy.subject,
                text: copy.text,
              });
              if (emailError) {
                notificationWarning = true;
                message =
                  "End-of-day notes saved, but next customer email failed";
              } else {
                message =
                  nextNotification.workType === "pickup"
                    ? "End-of-day notes saved; next customer emailed for pickup"
                    : "End-of-day notes saved; next customer emailed";
              }
            } catch {
              notificationWarning = true;
              message =
                "End-of-day notes saved, but next customer email failed";
            }
          } else {
            notificationWarning = true;
            message =
              "End-of-day notes saved, but no next customer email was available";
          }
        }
      } else {
        message = "End-of-day notes saved; next stop was already on the way";
      }
    }

    // Keep email-delivery warnings visible instead of navigating away to Maps.
    if (!notificationWarning && nextUrl.startsWith("https://www.google.com/maps/")) {
      return NextResponse.redirect(nextUrl, 303);
    }

    return redirectDriver(req, {
      token,
      date,
      truck,
      view,
      message,
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
