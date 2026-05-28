import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

import {
  listPrivateSlotDispositions,
  listPublicSaturdaySlotDispositions,
} from "@/lib/facility-parties/availability";
import { FACILITY_PARTY_BUFFER_MINUTES } from "@/lib/facility-parties/constants";
import type {
  FacilityRoomId,
  PrivateDurationMinutes,
} from "@/lib/facility-parties/types";
import {
  facilityAddonsForStorage,
  formatFacilityAddonsForEmail,
  resolveFacilityAddons,
} from "@/lib/facility-parties/addons";
import {
  formatFacilityPricingLines,
  priceFacilityParty,
} from "@/lib/facility-parties/pricing";
import { getResendFromAddress } from "@/lib/email/resend";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const FACILITY_TIME_ZONE = "America/New_York";

function getFacilityDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FACILITY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
    minutes: Number(getPart("hour")) * 60 + Number(getPart("minute")),
  };
}

function isFacilityRoomId(value: string): value is FacilityRoomId {
  return value === "room-10" || value === "room-20";
}

function isPrivateDuration(value: number): value is PrivateDurationMinutes {
  return value === 90 || value === 120 || value === 180;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmail(value: unknown): value is string {
  return isNonEmptyString(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      party_kind,
      room,
      start_time,
      end_time,
      customer_name,
      email,
      phone,
      parent_name,
      child_name,
      child_gender,
      child_age,
      party_theme,
      balloon_colors,
      table_cloth_colors,
      drink_choice,
      payment_method,
      deposit_acknowledged,
      notes,
      readable_date,
      readable_time,
      party_label,
      addon_selections,
    } = body;

    const resolvedAddons = resolveFacilityAddons(addon_selections);
    const storedAddons = facilityAddonsForStorage(resolvedAddons);
    const addonsEmailText = formatFacilityAddonsForEmail(resolvedAddons);

    if (
      (party_kind !== "public" && party_kind !== "private") ||
      typeof room !== "string" ||
      !start_time ||
      !end_time
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (
      !isNonEmptyString(customer_name) ||
      !isValidEmail(email) ||
      !isNonEmptyString(phone) ||
      !isNonEmptyString(parent_name) ||
      !isNonEmptyString(child_name) ||
      !isNonEmptyString(child_gender) ||
      !isNonEmptyString(child_age) ||
      !isNonEmptyString(party_theme) ||
      !isNonEmptyString(balloon_colors) ||
      !isNonEmptyString(table_cloth_colors) ||
      !isNonEmptyString(drink_choice) ||
      !isNonEmptyString(payment_method) ||
      !isNonEmptyString(readable_date) ||
      !isNonEmptyString(readable_time) ||
      !isNonEmptyString(party_label)
    ) {
      return NextResponse.json(
        { error: "Missing or invalid customer booking fields" },
        { status: 400 },
      );
    }

    const startDate = new Date(start_time);
    const endDate = new Date(end_time);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate >= endDate
    ) {
      return NextResponse.json(
        { error: "Invalid booking window" },
        { status: 400 },
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    const facilityOwnerEmail = process.env.FACILITY_OWNER_EMAIL?.trim();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

    if (!resendApiKey || !facilityOwnerEmail || !siteUrl) {
      return NextResponse.json(
        { error: "Missing facility notification configuration" },
        { status: 500 },
      );
    }

    const supabase = createServiceRoleClient();
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();
    const startParts = getFacilityDateParts(startDate);
    const durationMinutes = (endDate.getTime() - startDate.getTime()) / 60000;
    const pricing = priceFacilityParty({
      partyKind: party_kind,
      roomId: room as FacilityRoomId,
      date: startParts.date,
      durationMinutes,
      addonSubtotal: resolvedAddons.subtotal,
    });

    if (pricing.missingPrice) {
      return NextResponse.json(
        { error: "Facility pricing is not configured for this party option" },
        { status: 400 },
      );
    }

    const pricingLines = formatFacilityPricingLines(pricing);

    if (party_kind === "public") {
      if (!isFacilityRoomId(room)) {
        return NextResponse.json(
          { error: "Invalid public booking room" },
          { status: 400 },
        );
      }

      const validPublicSlot = listPublicSaturdaySlotDispositions(
        startParts.date,
        room,
        [],
      ).some(
        (slot) =>
          slot.startMinutes === startParts.minutes &&
          slot.endMinutes - slot.startMinutes === durationMinutes,
      );

      if (!validPublicSlot) {
        return NextResponse.json(
          { error: "Invalid public booking window" },
          { status: 400 },
        );
      }

      const { data: conflicts, error: conflictError } = await supabase
        .from("facility_bookings")
        .select("id")
        .eq("status", "confirmed")
        .eq("room", room)
        .lt("start_time", endIso)
        .gt("end_time", startIso)
        .limit(1);

      if (conflictError) {
        return NextResponse.json(
          { error: conflictError.message },
          { status: 500 },
        );
      }

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json(
          { error: "Booking window is unavailable" },
          { status: 409 },
        );
      }
    }

    if (party_kind === "private") {
      if (room !== "room-20" || !isPrivateDuration(durationMinutes)) {
        return NextResponse.json(
          { error: "Invalid private booking window" },
          { status: 400 },
        );
      }

      const validPrivateSlot = listPrivateSlotDispositions(
        startParts.date,
        durationMinutes,
        [],
      ).some((slot) => slot.startMinutes === startParts.minutes);

      if (!validPrivateSlot) {
        return NextResponse.json(
          { error: "Invalid private booking window" },
          { status: 400 },
        );
      }

      const bufferedStartIso = new Date(
        startDate.getTime() - FACILITY_PARTY_BUFFER_MINUTES * 60 * 1000,
      ).toISOString();

      const { data: conflicts, error: conflictError } = await supabase
        .from("facility_bookings")
        .select("id")
        .eq("status", "confirmed")
        .lt("start_time", endIso)
        .gt("end_time", bufferedStartIso)
        .limit(1);

      if (conflictError) {
        return NextResponse.json(
          { error: conflictError.message },
          { status: 500 },
        );
      }

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json(
          { error: "Booking window is unavailable" },
          { status: 409 },
        );
      }
    }

    const { data, error } = await supabase
      .from("facility_bookings")
      .insert([
        {
          party_kind,
          room,
          start_time: startIso,
          end_time: endIso,
          customer_name,
          email,
          phone,
          parent_name: String(parent_name).trim(),
          child_name: String(child_name).trim(),
          child_gender: String(child_gender).trim(),
          child_age: String(child_age).trim(),
          party_theme: String(party_theme).trim(),
          balloon_colors: String(balloon_colors).trim(),
          table_cloth_colors: String(table_cloth_colors).trim(),
          drink_choice: String(drink_choice).trim(),
          payment_method: String(payment_method).trim(),
          deposit_acknowledged: deposit_acknowledged === true,
          notes,
          readable_date,
          readable_time,
          party_label,
          addon_selections: storedAddons,
          facility_package_price: pricing.packagePrice,
          addon_subtotal: pricing.addonSubtotal,
          subtotal: pricing.subtotal,
          tax: pricing.tax,
          total: pricing.total,
          pricing_details: {
            taxRate: pricing.taxRate,
            source: "facility-party-price-sheet",
          },
        },
      ])
      .select()
      .single();

    console.log("BOOKING INSERT RESULT", { id: data?.id, error });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    try {
      const resend = new Resend(resendApiKey);
      const confirmLink = `${siteUrl}/api/facility/confirm?id=${data.id}&action=confirm`;
      const rejectLink = `${siteUrl}/api/facility/confirm?id=${data.id}&action=reject`;
      const fromAddress = getResendFromAddress();

      const { error: adminEmailError } = await resend.emails.send({
        from: fromAddress,
        to: facilityOwnerEmail,
        subject: "New facility booking request",
        text: [
          "New facility booking request",
          "",
          `Booking ID: ${data.id}`,
          `Customer: ${customer_name}`,
          `Parent name: ${String(parent_name).trim()}`,
          `Email: ${email}`,
          `Phone: ${phone}`,
          `Child name: ${String(child_name).trim()}`,
          `Child gender: ${String(child_gender).trim()}`,
          `Child age: ${String(child_age).trim()}`,
          `Party theme: ${String(party_theme).trim()}`,
          `Balloon colors: ${String(balloon_colors).trim()}`,
          `Table cloth colors: ${String(table_cloth_colors).trim()}`,
          `Drink choice: ${String(drink_choice).trim()}`,
          `Payment method: ${String(payment_method).trim()}`,
          `Deposit acknowledgement: ${
            deposit_acknowledged === true ? "Checked" : "Not checked"
          }`,
          `Party: ${party_label}`,
          `Date: ${readable_date}`,
          `Time: ${readable_time}`,
          `Party kind: ${party_kind}`,
          `Room: ${room}`,
          `Start time: ${startIso}`,
          `End time: ${endIso}`,
          notes?.trim() ? `Notes: ${String(notes).trim()}` : "Notes: (none)",
          "",
          addonsEmailText,
          ...pricingLines,
          "",
          `Confirm link: ${confirmLink}`,
          `Reject link: ${rejectLink}`,
        ].join("\n"),
      });

      if (adminEmailError) {
        console.error("BOOKING EMAIL ERROR", adminEmailError);
        return NextResponse.json(
          { error: "Booking was saved but admin notification failed" },
          { status: 500 },
        );
      }

      const { error: customerEmailError } = await resend.emails.send({
        from: fromAddress,
        to: email,
        subject: "Your Jumping Jax facility booking request was received",
        text: [
          `Hi ${customer_name},`,
          "",
          "We received your facility booking request. It is waiting for confirmation from Jumping Jax.",
          "",
          `Party: ${party_label}`,
          `Date: ${readable_date}`,
          `Time: ${readable_time}`,
          `Parent name: ${String(parent_name).trim()}`,
          `Child name: ${String(child_name).trim()}`,
          `Child age: ${String(child_age).trim()}`,
          `Party theme: ${String(party_theme).trim()}`,
          `Drink choice: ${String(drink_choice).trim()}`,
          `Payment method: ${String(payment_method).trim()}`,
          `Deposit: $50 due within one week of making this reservation, paid directly to Jumping Jax.`,
          "",
          addonsEmailText,
          ...pricingLines,
          "",
          "A second email will be sent once your booking is confirmed.",
        ].join("\n"),
      });

      if (customerEmailError) {
        console.error("CUSTOMER BOOKING REQUEST EMAIL ERROR", customerEmailError);
        return NextResponse.json(
          { error: "Booking was saved but customer notification failed" },
          { status: 500 },
        );
      }
    } catch (emailError) {
      console.error("BOOKING EMAIL ERROR", emailError);
      return NextResponse.json(
        { error: "Booking was saved but notification failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 },
    );
  }
}
