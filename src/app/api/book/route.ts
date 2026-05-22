import { NextResponse } from "next/server";
import { Resend } from "resend";
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

  const rental_item =
    typeof body.rental_item === "string" && body.rental_item.trim()
      ? body.rental_item.trim()
      : null;

  if (!rental_item) {
    return new Response(
      JSON.stringify({ error: 'rental_item is required' }),
      { status: 400 }
    )
  }

  const customerName =
    typeof body.customer_name === "string" && body.customer_name.trim()
      ? body.customer_name.trim()
      : "Guest";
  const customerEmail =
    typeof body.customer_email === "string" && body.customer_email.trim()
      ? body.customer_email.trim()
      : "";
  const customerPhone =
    typeof body.customer_phone === "string" ? body.customer_phone.trim() : "";
  const eventDateYmd =
    typeof body.event_date === "string" && body.event_date.trim()
      ? body.event_date.trim()
      : new Date().toISOString().slice(0, 10);
  const durationLabel =
    typeof body.duration === "string" ? body.duration.trim() : "";
  const spanDays =
    typeof body.span_days === "number" && body.span_days >= 1
      ? body.span_days
      : 1;
  const eventAddress =
    typeof body.event_address === "string" ? body.event_address.trim() : "";
  const notes =
    typeof body.notes === "string" && body.notes.trim()
      ? body.notes.trim()
      : "";

  const result = await insertPendingBooking({
    rental_item: rental_item,
    rentalName: rental_item,
    customerName,
    email: customerEmail || "unknown@example.com",
    phone: customerPhone,
    eventDateYmd,
    durationLabel: durationLabel || "Standard",
    spanDays,
    eventAddress,
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

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const facilityOwnerEmail = process.env.FACILITY_OWNER_EMAIL?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  const durationParts: string[] = [];
  if (durationLabel) durationParts.push(durationLabel);
  if (spanDays > 1) durationParts.push(`${spanDays} days`);
  else if (spanDays === 1 && !durationLabel) durationParts.push("1 day");
  const durationLine =
    durationParts.length > 0 ? durationParts.join(" — ") : null;

  if (resendApiKey) {
    const resend = new Resend(resendApiKey);

    if (customerEmail) {
      try {
        const { error: emailError } = await resend.emails.send({
          from: "Jumping Jax <onboarding@resend.dev>",
          to: customerEmail,
          subject: "We received your Jumping Jax rental request",
          text: [
            `Hi ${customerName},`,
            "",
            "We received your rental request.",
            "It is waiting for confirmation.",
            "Jumping Jax will contact you once your request has been reviewed.",
            "",
            `Booking reference: ${result.id}`,
            `Rental: ${rental_item}`,
            `Event date: ${eventDateYmd}`,
            durationLine ? `Duration: ${durationLine}` : null,
            `Name: ${customerName}`,
            customerPhone ? `Phone: ${customerPhone}` : null,
            eventAddress ? `Event address: ${eventAddress}` : null,
          ]
            .filter((line): line is string => line !== null)
            .join("\n"),
        });

        if (emailError) {
          console.error("[api/book] rental customer email error", emailError);
        }
      } catch (emailError) {
        console.error("[api/book] rental customer email error", emailError);
      }
    }

    if (facilityOwnerEmail) {
      try {
        const { error: emailError } = await resend.emails.send({
          from: "Jumping Jax <onboarding@resend.dev>",
          to: facilityOwnerEmail,
          subject: "New Jumping Jax rental request",
          text: [
            "New rental request — manual review required.",
            "This rental still needs manual review.",
            "",
            `Booking ID: ${result.id}`,
            `Rental: ${rental_item}`,
            `Event date: ${eventDateYmd}`,
            durationLine ? `Duration: ${durationLine}` : `Span: ${spanDays} day(s)`,
            `Customer: ${customerName}`,
            `Email: ${customerEmail || "(not provided)"}`,
            customerPhone ? `Phone: ${customerPhone}` : "Phone: (not provided)",
            eventAddress
              ? `Event address: ${eventAddress}`
              : "Event address: (not provided)",
            notes ? `Notes: ${notes}` : "Notes: (none)",
            "",
            "Confirm this booking:",
            `${siteUrl}/api/rentals/confirm?id=${result.id}&action=confirm`,
            "",
            "Reject this booking:",
            `${siteUrl}/api/rentals/confirm?id=${result.id}&action=reject`,
          ].join("\n"),
        });

        if (emailError) {
          console.error("[api/book] rental admin email error", emailError);
        }
      } catch (emailError) {
        console.error("[api/book] rental admin email error", emailError);
      }
    }
  }

  return NextResponse.json({ ok: true, id: result.id });
}
