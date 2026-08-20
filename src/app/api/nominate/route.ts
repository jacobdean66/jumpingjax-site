import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

import {
  getFacilityOwnerEmails,
  getResendFromAddress,
} from "@/lib/email/resend";
import { formatPublicChildDisplayName } from "@/lib/giveaway/public-nominee-display";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Legacy nominate endpoint retained for any old clients.
 * Saves to giveaway_nominations before attempting email, matching the
 * canonical /api/giveaway/nominate database-first behavior.
 */

const ENTRY_DEADLINE = new Date("2026-08-31T04:00:00.000Z");
const PARTY_TO_CODE = {
  "September birthday party": "september_birthday",
  "Back-to-school party": "back_to_school",
} as const;

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, {
    scope: "free-party-nomination",
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  if (new Date() >= ENTRY_DEADLINE) {
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
  const childNameRaw = clean(body.childName, 80);
  const childName = formatPublicChildDisplayName(childNameRaw);
  const birthday = clean(body.birthday, 5);
  const partyLabel = clean(body.partyChoice, 80);
  const whyNominated = clean(body.whyNominated, 2000);
  const acknowledgement = clean(body.acknowledgement, 10);
  const partyChoice = PARTY_TO_CODE[partyLabel as keyof typeof PARTY_TO_CODE];

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nominatorEmail);
  const birthdayMatch = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/.exec(birthday);
  if (
    !nominatorName ||
    !validEmail ||
    !childNameRaw ||
    childName === "Nominee" ||
    !birthdayMatch ||
    !partyChoice ||
    whyNominated.length < 20 ||
    acknowledgement !== "yes"
  ) {
    return NextResponse.json(
      { error: "Please complete every field and check your information." },
      { status: 400 },
    );
  }

  const birthMonth = Number(birthdayMatch[1]);
  const birthDay = Number(birthdayMatch[2]);
  const idempotencyKey = `legacy-nominate:${nominatorEmail}:${childName}:${birthday}:${partyChoice}:${whyNominated.slice(0, 64)}`;

  const supabase = createServiceRoleClient();
  const { data: inserted, error: insertError } = await supabase
    .from("giveaway_nominations")
    .upsert(
      {
        idempotency_key: idempotencyKey,
        nominator_name: nominatorName,
        nominator_email: nominatorEmail,
        child_name: childName,
        child_birth_month: birthMonth,
        child_birth_day: birthDay,
        party_choice: partyChoice,
        nomination_reason: whyNominated,
        permission_acknowledged: true,
      },
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();

  if (insertError) {
    console.error("[giveaway] legacy nomination save failed", { code: insertError.code });
    return NextResponse.json(
      { error: "We couldn't record your nomination. Please try again." },
      { status: 503 },
    );
  }

  let nominationId = inserted?.id as string | undefined;
  if (!nominationId) {
    const { data: existing } = await supabase
      .from("giveaway_nominations")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    nominationId = existing?.id as string | undefined;
  }

  if (!nominationId) {
    return NextResponse.json(
      { error: "We couldn't record your nomination. Please try again." },
      { status: 503 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  let confirmationEmailSent = false;
  let ownerEmailSent = false;

  if (apiKey) {
    try {
      const resend = new Resend(apiKey);
      const submittedAt = new Date().toLocaleString("en-US", {
        timeZone: "America/New_York",
        dateStyle: "full",
        timeStyle: "long",
      });

      const owner = await resend.emails.send(
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
            `Party choice: ${partyLabel}`,
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
      ownerEmailSent = !owner.error;

      const confirmation = await resend.emails.send(
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
            `Party choice: ${partyLabel}`,
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
      confirmationEmailSent = !confirmation.error;
    } catch (emailError) {
      console.error("[giveaway] legacy notification email failed", emailError);
    }
  }

  await supabase
    .from("giveaway_nominations")
    .update({
      confirmation_email_sent: confirmationEmailSent,
      owner_email_sent: ownerEmailSent,
    })
    .eq("id", nominationId);

  return NextResponse.json({ nominationId });
}
