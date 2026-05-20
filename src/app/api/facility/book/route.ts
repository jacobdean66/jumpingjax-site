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
      notes,
      readable_date,
      readable_time,
      party_label,
    } = body;

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
          notes,
          readable_date,
          readable_time,
          party_label,
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

      const { error: emailError } = await resend.emails.send({
        from: "Jumping Jax <onboarding@resend.dev>",
        to: facilityOwnerEmail,
        subject: "New facility booking request",
        text: [
          "New facility booking request",
          "",
          `Booking ID: ${data.id}`,
          `Party kind: ${party_kind}`,
          `Room: ${room}`,
          `Start time: ${startIso}`,
          `End time: ${endIso}`,
          `Confirm link: ${confirmLink}`,
          `Reject link: ${rejectLink}`,
        ].join("\n"),
      });

      if (emailError) {
        console.error("BOOKING EMAIL ERROR", emailError);
        return NextResponse.json(
          { error: "Booking was saved but notification failed" },
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
