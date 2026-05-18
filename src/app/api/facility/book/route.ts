import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { party_kind, room, start_time, end_time } = body;

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

    const supabase = createServiceRoleClient();
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    if (party_kind === "private") {
      const durationMinutes = (endDate.getTime() - startDate.getTime()) / 60000;

      if (room !== "room-20" || ![90, 120, 180].includes(durationMinutes)) {
        return NextResponse.json(
          { error: "Invalid private booking window" },
          { status: 400 },
        );
      }

      const { data: conflicts, error: conflictError } = await supabase
        .from("facility_bookings")
        .select("id")
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

    const { data, error } = await supabase
      .from("facility_bookings")
      .insert([
        {
          party_kind,
          room,
          start_time: startIso,
          end_time: endIso,
        },
      ])
      .select()
      .single();

    console.log("BOOKING INSERT RESULT", { data, error });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const confirmLink = `${process.env.NEXT_PUBLIC_SITE_URL}/api/facility/confirm?id=${data.id}`;

      const { error: emailError } = await resend.emails.send({
        from: "Jumping Jax <onboarding@resend.dev>",
        to: "jacobdean1166@gmail.com",
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
        ].join("\n"),
      });

      if (emailError) {
        console.error("BOOKING EMAIL ERROR", emailError);
      }
    } catch (emailError) {
      console.error("BOOKING EMAIL ERROR", emailError);
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 },
    );
  }
}
