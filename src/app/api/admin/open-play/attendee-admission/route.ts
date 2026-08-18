import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireStaffAuth, publicSafeError } from "@/lib/open-play/staff-auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(req: Request) {
  const limited = rateLimit(req, {
    scope: "admin-open-play-attendee-admission",
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const auth = await requireStaffAuth();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return publicSafeError("invalid_json", 400, "Invalid JSON request body");
  }

  const attendeeId = typeof body.attendeeId === "string" ? body.attendeeId : "";
  const visitId = typeof body.visitId === "string" ? body.visitId : "";
  const paymentOption = typeof body.paymentOption === "string" ? body.paymentOption : "";
  const adultMode = body.adultMode === "playing"
    ? "playing"
    : body.adultMode === "watching"
      ? "watching"
      : null;
  const amountCents = Number(body.amountCents);
  const source = body.source === "native" ? "native" : body.source === "legacy_smartwaiver" ? "legacy_smartwaiver" : null;

  if (
    !source ||
    !UUID.test(attendeeId) ||
    !UUID.test(visitId) ||
    !Number.isInteger(amountCents) ||
    amountCents < 0 ||
    amountCents > 50_000 ||
    !["cash", "card", "free_pass"].includes(paymentOption) ||
    (paymentOption === "free_pass" && amountCents !== 0) ||
    (paymentOption !== "free_pass" && amountCents === 0)
  ) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid amount and payment option." },
      { status: 400 },
    );
  }

  if (
    adultMode &&
    ((adultMode === "watching" && (amountCents !== 0 || paymentOption !== "free_pass")) ||
      (adultMode === "playing" &&
        (amountCents !== 700 || (paymentOption !== "cash" && paymentOption !== "card"))))
  ) {
    return NextResponse.json(
      { ok: false, error: "Watching adults are free; playing adults are $7 paid by cash or card." },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();
  const attendeeTable = source === "native"
    ? "open_play_visit_attendees"
    : "smartwaiver_legacy_check_ins";
  const attendeeVisitColumn = source === "native" ? "visit_id" : "legacy_visit_id";
  const paymentTable = source === "native"
    ? "open_play_payment_entries"
    : "smartwaiver_legacy_payment_entries";
  const paymentVisitColumn = source === "native" ? "visit_id" : "legacy_visit_id";
  const paymentAttendeeColumn = source === "native" ? "attendee_id" : "legacy_check_in_id";
  const { data: attendee, error: attendeeError } = await supabase
    .from(attendeeTable)
    .select(`id, ${attendeeVisitColumn}, status`)
    .eq("id", attendeeId)
    .eq(attendeeVisitColumn, visitId)
    .maybeSingle();

  if (attendeeError) return publicSafeError("database", 503);
  if (!attendee || attendee.status !== "active") {
    return NextResponse.json(
      { ok: false, error: "This child check-in is no longer active." },
      { status: 404 },
    );
  }

  if (adultMode) {
    const rpcName = source === "native"
      ? "update_open_play_adult_attendance_atomic"
      : "update_legacy_open_play_adult_attendance_atomic";
    const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, {
      p_attendee_id: attendeeId,
      p_visit_id: visitId,
      p_mode: adultMode,
      p_payment_method: adultMode === "playing" ? paymentOption : null,
      p_staff_id: auth.auth.identity.id,
    });
    if (rpcError) return publicSafeError("database", 503, "Unable to update adult attendance");
    const outcome = rpcData as { outcome?: string } | null;
    if (outcome?.outcome !== "updated") {
      return NextResponse.json(
        { ok: false, error: outcome?.outcome === "not_adult" ? "Only adult check-ins can use watching or playing." : "Unable to update adult attendance." },
        { status: outcome?.outcome === "not_found" ? 404 : 400 },
      );
    }
    return NextResponse.json({
      ok: true,
      admission: {
        amountCents,
        paymentOption,
        classification: adultMode === "playing" ? "playing_adult" : "watching_adult",
      },
    });
  }

  const { data: entries, error: entriesError } = await supabase
    .from(paymentTable)
    .select("id, entry_type, method, amount_cents, created_at")
    .eq(paymentVisitColumn, visitId)
    .eq(paymentAttendeeColumn, attendeeId)
    .order("created_at", { ascending: true });

  if (entriesError) return publicSafeError("database", 503);

  const ledger = entries ?? [];
  const originalCharge = ledger.find((entry) => entry.entry_type === "charge");
  const currentAmountCents = ledger.reduce(
    (total, entry) => total + Number(entry.amount_cents),
    0,
  );
  let currentMethod: "cash" | "card" =
    originalCharge?.method === "card" ? "card" : "cash";
  for (const entry of ledger) {
    if (entry.entry_type === "correction" && Number(entry.amount_cents) > 0) {
      currentMethod = entry.method === "card" ? "card" : "cash";
    }
  }

  const targetMethod = paymentOption === "card" ? "card" : "cash";
  const reason = paymentOption === "free_pass"
    ? "Admission changed to free pass"
    : "Admission amount edited from check-in details";
  const inserts: Array<Record<string, unknown>> = [];

  if (!originalCharge && amountCents > 0) {
    inserts.push({
      [paymentVisitColumn]: visitId,
      [paymentAttendeeColumn]: attendeeId,
      entry_type: "charge",
      method: targetMethod,
      amount_cents: amountCents,
      created_by_staff_id: auth.auth.identity.id,
    });
  } else if (originalCharge) {
    if (currentAmountCents > 0 && currentMethod !== targetMethod && amountCents > 0) {
      inserts.push(
        {
          [paymentVisitColumn]: visitId,
          [paymentAttendeeColumn]: attendeeId,
          entry_type: "correction",
          method: currentMethod,
          amount_cents: -currentAmountCents,
          related_entry_id: originalCharge.id,
          reason,
          created_by_staff_id: auth.auth.identity.id,
        },
        {
          [paymentVisitColumn]: visitId,
          [paymentAttendeeColumn]: attendeeId,
          entry_type: "correction",
          method: targetMethod,
          amount_cents: amountCents,
          related_entry_id: originalCharge.id,
          reason,
          created_by_staff_id: auth.auth.identity.id,
        },
      );
    } else {
      const delta = amountCents - currentAmountCents;
      if (delta !== 0) {
        inserts.push({
          [paymentVisitColumn]: visitId,
          [paymentAttendeeColumn]: attendeeId,
          entry_type: "correction",
          method: amountCents > 0 ? targetMethod : currentMethod,
          amount_cents: delta,
          related_entry_id: originalCharge.id,
          reason,
          created_by_staff_id: auth.auth.identity.id,
        });
      }
    }
  }

  if (inserts.length) {
    const { error: insertError } = await supabase
      .from(paymentTable)
      .insert(inserts);
    if (insertError) {
      return publicSafeError("database", 503, "Unable to save admission details");
    }
  }

  await supabase.from("open_play_audit_events").insert({
    actor_staff_id: auth.auth.identity.id,
    action: `${source}_attendee_admission_edit`,
    entity_type: source === "native" ? "open_play_visit_attendee" : "smartwaiver_legacy_check_in",
    entity_id: attendeeId,
    detail: { visitId, previousAmountCents: currentAmountCents, amountCents, paymentOption },
  });

  return NextResponse.json({ ok: true, admission: { amountCents, paymentOption } });
}
