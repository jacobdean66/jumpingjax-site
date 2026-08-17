import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

import {
  getFacilityOwnerEmails,
  getResendFromAddress,
} from "@/lib/email/resend";
import { rateLimit } from "@/lib/rate-limit";
import {
  createServiceRoleClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase/admin";

const PARTY_CHOICES = new Set([
  "September birthday party",
  "Back-to-school party",
]);

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function entryIsClosed() {
  const nowInEastern = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
  return new Date(nowInEastern) > new Date("2026-08-30T23:59:59");
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, {
    scope: "free-party-nomination",
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  if (entryIsClosed()) {
    return NextResponse.json(
      { error: "Nominations closed on August 30, 2026." },
      { status: 410 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  if (clean(body.website, 200)) {
    return NextResponse.json({ nominationId: crypto.randomUUID() });
  }

  const nominatorName = clean(body.nominatorName, 100);
  const nominatorEmail = clean(body.nominatorEmail, 200).toLowerCase();
  const childName = clean(body.childName, 80);
  const birthday = clean(body.birthday, 5);
  const partyChoice = clean(body.partyChoice, 80);
  const whyNominated = clean(body.whyNominated, 2000);
  const acknowledgement = clean(body.acknowledgement, 10);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nominatorEmail);
  const validBirthday = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/.test(birthday);
  if (
    !nominatorName ||
    !validEmail ||
    !childName ||
    !validBirthday ||
    !PARTY_CHOICES.has(partyChoice) ||
    whyNominated.length < 20 ||
    acknowledgement !== "yes"
  ) {
    return NextResponse.json(
      { error: "Please complete every field and check your information." },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Nominations are temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }

  const nominationId = crypto.randomUUID();
  const resend = new Resend(apiKey);
  const createdAt = new Date().toISOString();
  const submittedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "full",
    timeStyle: "long",
  });

  if (!isSupabaseServiceConfigured()) {
    return NextResponse.json(
      { error: "Nominations are temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }

  const { error: storageError } = await createServiceRoleClient()
    .from("giveaway_nominations")
    .insert({
      id: nominationId,
      nominator_name: nominatorName,
      nominator_email: nominatorEmail,
      child_name: childName,
      birthday,
      party_choice: partyChoice,
      why_nominated: whyNominated,
      source: "Nomination form",
      status: "new",
      created_at: createdAt,
    });

  if (storageError) {
    console.error("Could not store giveaway nomination:", storageError.message);
    return NextResponse.json(
      { error: "We couldn't record your nomination. Please try again." },
      { status: 503 },
    );
  }

  try {
    const { error: ownerError } = await resend.emails.send(
      {
        from: getResendFromAddress(),
        to: getFacilityOwnerEmails(),
        replyTo: nominatorEmail,
        subject: `Free Party Nomination: ${childName}`,
        text: [
          "A new Jumping Jax Free Party Giveaway nomination was submitted.",
          "",
          `Nominator: ${nominatorName}`,
          `Nominator email: ${nominatorEmail}`,
          `Child: ${childName}`,
          `Birthday: ${birthday}`,
          `Party choice: ${partyChoice}`,
          "",
          "Why this child was nominated:",
          whyNominated,
          "",
          `Submitted: ${submittedAt}`,
          `Nomination ID: ${nominationId}`,
        ].join("\n"),
      },
      { idempotencyKey: `nomination-owner-${nominationId}` },
    );
    if (ownerError) throw new Error("Owner email failed");

    await resend.emails.send(
      {
        from: getResendFromAddress(),
        to: nominatorEmail,
        subject: "We received your Jumping Jax party nomination",
        text: [
          `Hi ${nominatorName},`,
          "",
          "We received your nomination for the Jumping Jax Free Party Giveaway.",
          "",
          `Child: ${childName}`,
          `Party choice: ${partyChoice}`,
          "Prize: one public or private party for up to 20 children",
          "Included: drinks, balloons, plates, cutlery, and themed tablecloths",
          "Entry deadline: August 30, 2026",
          "Drawing: August 31, 2026",
          "Party date: winner's choice, subject to availability",
          "",
          "One winner will be selected. A parent or legal guardian must approve before the prize can be redeemed. No purchase is necessary.",
          "",
          `Confirmation: ${nominationId}`,
          "",
          "- Jumping Jax",
        ].join("\n"),
      },
      { idempotencyKey: `nomination-confirmation-${nominationId}` },
    );

  } catch (error) {
    console.error(
      "Nomination was stored, but its notification email could not be sent:",
      error instanceof Error ? error.message : "unknown email error",
    );
  }

  return NextResponse.json({ nominationId });
}

