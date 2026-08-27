import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

import {
  getFacilityOwnerEmails,
  getResendFromAddress,
} from "@/lib/email/resend";
import { formatPublicChildDisplayName } from "@/lib/giveaway/public-nominee-display";
import { saveGiveawayNomination } from "@/lib/giveaway/nomination-store";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const ENTRY_DEADLINE = new Date("2026-08-31T04:00:00.000Z");
const PARTY_LABELS = {
  september_birthday: "September birthday party",
  back_to_school: "Back-to-school party",
} as const;

type PartyChoice = keyof typeof PARTY_LABELS;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPartyChoice(value: unknown): value is PartyChoice {
  return value === "september_birthday" || value === "back_to_school";
}

function isValidMonthDay(month: number, day: number) {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(2024, month, 0).getDate();
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, {
    scope: "giveaway-nomination",
    limit: 6,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  if (new Date() >= ENTRY_DEADLINE) {
    return NextResponse.json(
      { error: "Nominations closed August 30, 2026." },
      { status: 410 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 32 * 1024) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  try {
    const body = await request.json();
    if (cleanText(body.website, 200)) {
      return NextResponse.json({ success: true });
    }

    const nominatorName = cleanText(body.nominator_name, 120);
    const nominatorEmail = cleanText(body.nominator_email, 254).toLowerCase();
    const childNameRaw = cleanText(body.child_name, 80);
    const childName = formatPublicChildDisplayName(childNameRaw);
    const reason = cleanText(body.nomination_reason, 1500);
    const idempotencyKey = cleanText(body.idempotency_key, 128);
    const birthMonth = Number(body.child_birth_month);
    const birthDay = Number(body.child_birth_day);
    const partyChoice = body.party_choice;

    if (
      !nominatorName ||
      !isEmail(nominatorEmail) ||
      !childNameRaw ||
      childName === "Nominee" ||
      childNameRaw.split(/\s+/).length > 3 ||
      !isValidMonthDay(birthMonth, birthDay) ||
      !isPartyChoice(partyChoice) ||
      reason.length < 10 ||
      !idempotencyKey ||
      body.permission_acknowledged !== true
    ) {
      return NextResponse.json(
        { error: "Please complete every required field." },
        { status: 400 },
      );
    }

    const row = {
      idempotency_key: idempotencyKey,
      nominator_name: nominatorName,
      nominator_email: nominatorEmail,
      child_name: childName,
      child_birth_month: birthMonth,
      child_birth_day: birthDay,
      party_choice: partyChoice,
      nomination_reason: reason,
      permission_acknowledged: true as const,
    };

    let nominationId: string;
    try {
      nominationId = (await saveGiveawayNomination(row)).id;
    } catch (saveError) {
      console.error("[giveaway] nomination save failed", saveError instanceof Error ? saveError.message : "Unknown error");
      return NextResponse.json(
        { error: "We could not save the nomination. Please try again." },
        { status: 503 },
      );
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    let confirmationEmailSent = false;
    let ownerEmailSent = false;

    if (apiKey) {
      try {
        const resend = new Resend(apiKey);
      const birthday = `${String(birthMonth).padStart(2, "0")}/${String(birthDay).padStart(2, "0")}`;
      const partyLabel = PARTY_LABELS[partyChoice];

        const confirmation = await resend.emails.send(
        {
          from: getResendFromAddress(),
          to: nominatorEmail,
          subject: "Your Jumping Jax giveaway nomination is entered",
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
            "Party date: winner's choice, subject to availability",
            "",
            "One winner will be selected after entries close. A parent or legal guardian must approve the prize before it can be redeemed.",
            "",
            "Thank you for helping Jumping Jax celebrate a special child!",
          ].join("\n"),
        },
        { idempotencyKey: `giveaway-${nominationId}-confirmation-v1` },
      );
        confirmationEmailSent = !confirmation.error;

        const ownerText = [
        "New Jumping Jax giveaway nomination",
        "",
        `Nomination ID: ${nominationId}`,
        `Nominator: ${nominatorName}`,
        `Nominator email: ${nominatorEmail}`,
        `Child: ${childName}`,
        `Birthday: ${birthday}`,
        `Party choice: ${partyLabel}`,
        "",
        "Why this child was nominated:",
        reason,
      ].join("\n");

        const ownerResults = await Promise.all(
          getFacilityOwnerEmails().map((ownerEmail) =>
            resend.emails.send(
              {
                from: getResendFromAddress(),
                to: ownerEmail,
                subject: "New Jumping Jax giveaway nomination",
                text: ownerText,
              },
              { idempotencyKey: `giveaway-${nominationId}-owner-${ownerEmail}-v1` },
            ),
          ),
        );
        ownerEmailSent = ownerResults.some((result) => !result.error);
      } catch (emailError) {
        console.error("[giveaway] notification email failed", emailError);
      }
    }

    await createServiceRoleClient()
      .from("giveaway_nominations")
      .update({
        confirmation_email_sent: confirmationEmailSent,
        owner_email_sent: ownerEmailSent,
      })
      .eq("id", nominationId);

    return NextResponse.json({ success: true, id: nominationId });
  } catch (error) {
    console.error("[giveaway] unexpected nomination error", error);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
