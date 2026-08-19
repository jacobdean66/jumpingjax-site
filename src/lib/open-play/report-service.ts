import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isYmd } from "./pricing";
import {
  buildDailyReport,
  type DailyReport,
  type VisitSnapshot,
} from "./daily-report";
import type { AdmissionClassification } from "./pricing";
import type { PaymentEntry, PaymentMethod } from "./ledger";

export async function getOpenPlayDailyReport(
  dateYmd: string,
): Promise<DailyReport> {
  if (!isYmd(dateYmd)) {
    throw new Error("date must be YYYY-MM-DD");
  }

  const supabase = createServiceRoleClient();
  const { data: visits, error: visitError } = await supabase
    .from("open_play_visits")
    .select("id, visit_date, business_day_ymd, status, notes, created_at")
    .eq("business_day_ymd", dateYmd);

  if (visitError) throw new Error(visitError.message);
  const visitIds = (visits ?? []).map((visit) => visit.id);
  const { data: attendees, error: attendeeError } = await supabase
    .from("open_play_visit_attendees")
    .select("id, visit_id, participant_id, age_years_on_visit, classification, unit_price_cents, status")
    .in("visit_id", visitIds.length ? visitIds : ["00000000-0000-0000-0000-000000000000"]);
  if (attendeeError) throw new Error(attendeeError.message);

  const participantIds = [...new Set((attendees ?? []).map((item) => item.participant_id))];
  const { data: participants, error: participantError } = participantIds.length
    ? await supabase
        .from("waiver_participants")
        .select("id, submission_id, first_name, last_name, dob")
        .in("id", participantIds)
    : { data: [], error: null };
  if (participantError) throw new Error(participantError.message);
  const participantsById = new Map(
    (participants ?? []).map((participant) => [
      participant.id,
      {
        firstName: participant.first_name,
        lastName: participant.last_name,
        fullName: `${participant.first_name} ${participant.last_name}`.trim(),
        birthDate: participant.dob,
        submissionId: participant.submission_id,
      },
    ]),
  );

  const submissionIds = [...new Set((participants ?? []).map((item) => item.submission_id))];
  const [{ data: submissions, error: submissionError }, { data: waiverParticipants, error: waiverParticipantError }] =
    await Promise.all([
      submissionIds.length
        ? supabase
            .from("waiver_submissions")
            .select("id,signed_at,expires_on,signer_first_name,signer_last_name,signer_email,signer_phone,source,status,smartwaiver_external_id")
            .in("id", submissionIds)
        : Promise.resolve({ data: [], error: null }),
      submissionIds.length
        ? supabase
            .from("waiver_participants")
            .select("id,submission_id,first_name,last_name,dob,role")
            .in("submission_id", submissionIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (submissionError) throw new Error(submissionError.message);
  if (waiverParticipantError) throw new Error(waiverParticipantError.message);
  const submissionsById = new Map((submissions ?? []).map((item) => [item.id, item]));
  const waiverParticipantsBySubmission = new Map<string, NonNullable<VisitSnapshot["attendees"][number]["waiverParticipants"]>>();
  for (const participant of waiverParticipants ?? []) {
    const submission = submissionsById.get(participant.submission_id);
    if (!submission) continue;
    const item = {
      participantId: participant.id,
      submissionId: participant.submission_id,
      selectionKey: participant.id,
      source: "native" as const,
      firstName: participant.first_name,
      lastName: participant.last_name,
      fullName: `${participant.first_name} ${participant.last_name}`.trim(),
      dobYmd: participant.dob,
      birthYear: Number(participant.dob.slice(0, 4)) || 0,
      role: participant.role as "child" | "adult_signer" | "adult_covered",
      expiresOnYmd: submission.expires_on,
      expired: submission.status !== "completed" || submission.expires_on <= dateYmd,
      signerLastInitial: (submission.signer_last_name.trim()[0] || "").toUpperCase(),
      checkInEligible: submission.status === "completed" && submission.expires_on > dateYmd,
    };
    waiverParticipantsBySubmission.set(participant.submission_id, [
      ...(waiverParticipantsBySubmission.get(participant.submission_id) ?? []),
      item,
    ]);
  }

  const { data: payments, error: paymentError } = await supabase
    .from("open_play_payment_entries")
    .select(
      "id, visit_id, attendee_id, entry_type, method, amount_cents, related_entry_id, reason, created_by_staff_id, created_at",
    )
    .in("visit_id", visitIds.length ? visitIds : ["00000000-0000-0000-0000-000000000000"]);
  if (paymentError) throw new Error(paymentError.message);

  const snapshots: VisitSnapshot[] = (visits ?? []).map((visit) => {
    const visitAttendees =
      attendees
        ?.filter((item) => item.visit_id === visit.id)
        .map((item) => ({
          id: item.id,
          visitId: item.visit_id,
          participantRecordId: item.participant_id,
          source: "native" as const,
          firstName: participantsById.get(item.participant_id)?.firstName,
          lastName: participantsById.get(item.participant_id)?.lastName,
          fullName: participantsById.get(item.participant_id)?.fullName ?? "Unknown attendee",
          birthDate: participantsById.get(item.participant_id)?.birthDate,
          waiverDetails: (() => {
            const submission = submissionsById.get(participantsById.get(item.participant_id)?.submissionId ?? "");
            return submission
              ? {
                  signerFullName: `${submission.signer_first_name} ${submission.signer_last_name}`.trim(),
                  signerPhone: submission.signer_phone,
                  signerEmail: submission.signer_email,
                  signedAt: submission.signed_at,
                  expiresOnYmd: submission.expires_on,
                  status: submission.status,
                  source: submission.source,
                  waiverId: submission.smartwaiver_external_id ?? undefined,
                }
              : undefined;
          })(),
          waiverParticipants: waiverParticipantsBySubmission.get(participantsById.get(item.participant_id)?.submissionId ?? "") ?? [],
          ageYearsOnVisit: item.age_years_on_visit,
          classification: item.classification as AdmissionClassification,
          unitPriceCents: item.unit_price_cents,
          status: item.status as "active" | "removed",
        })) ?? [];

    const visitPayments: PaymentEntry[] =
      payments
        ?.filter((item) => item.visit_id === visit.id)
        .map((item) => ({
          id: item.id,
          visitId: item.visit_id,
          attendeeId: item.attendee_id,
          entryType: item.entry_type as PaymentEntry["entryType"],
          method: item.method as PaymentMethod,
          amountCents: item.amount_cents,
          relatedEntryId: item.related_entry_id,
          reason: item.reason,
          createdByStaffId: item.created_by_staff_id,
          createdAt: item.created_at,
        })) ?? [];

    return {
      id: visit.id,
      source: "native",
      visitDate: visit.visit_date,
      businessDayYmd: visit.business_day_ymd,
      status: visit.status as VisitSnapshot["status"],
      notes: visit.notes,
      createdAt: visit.created_at,
      attendees: visitAttendees,
      payments: visitPayments,
    };
  });

  const { data: legacyVisits, error: legacyVisitError } = await supabase
    .from("smartwaiver_legacy_visits")
    .select("id, visit_date, business_day_ymd, status, notes, created_at")
    .eq("business_day_ymd", dateYmd);
  if (legacyVisitError) throw new Error(legacyVisitError.message);

  const legacyVisitIds = (legacyVisits ?? []).map((visit) => visit.id);
  const legacyIds = legacyVisitIds.length
    ? legacyVisitIds
    : ["00000000-0000-0000-0000-000000000000"];
  const [{ data: legacyAttendees, error: legacyAttendeeError }, { data: legacyPayments, error: legacyPaymentError }] =
    await Promise.all([
      supabase
        .from("smartwaiver_legacy_check_ins")
        .select("id, legacy_visit_id, legacy_participant_id, age_years_on_visit, classification, unit_price_cents, status")
        .in("legacy_visit_id", legacyIds),
      supabase
        .from("smartwaiver_legacy_payment_entries")
        .select("id, legacy_visit_id, legacy_check_in_id, entry_type, method, amount_cents, related_entry_id, reason, created_by_staff_id, created_at")
        .in("legacy_visit_id", legacyIds),
    ]);
  if (legacyAttendeeError) throw new Error(legacyAttendeeError.message);
  if (legacyPaymentError) throw new Error(legacyPaymentError.message);

  const legacyParticipantIds = [
    ...new Set((legacyAttendees ?? []).map((item) => item.legacy_participant_id)),
  ];
  const { data: legacyParticipants, error: legacyParticipantError } =
    legacyParticipantIds.length
      ? await supabase
          .from("smartwaiver_legacy_participants")
          .select("id, legacy_waiver_id, first_name, last_name, dob")
          .in("id", legacyParticipantIds)
      : { data: [], error: null };
  if (legacyParticipantError) throw new Error(legacyParticipantError.message);
  const legacyParticipantsById = new Map(
    (legacyParticipants ?? []).map((participant) => [
      participant.id,
      {
        firstName: participant.first_name,
        lastName: participant.last_name,
        fullName: `${participant.first_name} ${participant.last_name}`.trim(),
        birthDate: participant.dob,
        legacyWaiverId: participant.legacy_waiver_id,
      },
    ]),
  );

  const legacyWaiverIds = [
    ...new Set((legacyParticipants ?? []).map((item) => item.legacy_waiver_id)),
  ];
  const [{ data: legacyWaivers, error: legacyWaiverError }, { data: allLegacyParticipants, error: allLegacyParticipantError }] =
    await Promise.all([
      legacyWaiverIds.length
        ? supabase
            .from("smartwaiver_legacy_waivers")
            .select("id,waiver_id,signed_at,signed_on_ymd,expires_on,waiver_title,tags,check_ins,marketing_consent,phone,email,signer_first_name,signer_last_name,signer_dob,activated")
            .in("id", legacyWaiverIds)
        : Promise.resolve({ data: [], error: null }),
      legacyWaiverIds.length
        ? supabase
            .from("smartwaiver_legacy_participants")
            .select("id,legacy_waiver_id,first_name,last_name,dob,role")
            .in("legacy_waiver_id", legacyWaiverIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (legacyWaiverError) throw new Error(legacyWaiverError.message);
  if (allLegacyParticipantError) throw new Error(allLegacyParticipantError.message);
  const legacyWaiversById = new Map((legacyWaivers ?? []).map((item) => [item.id, item]));
  const participantsByLegacyWaiver = new Map<string, NonNullable<VisitSnapshot["attendees"][number]["waiverParticipants"]>>();
  for (const participant of allLegacyParticipants ?? []) {
    const waiver = legacyWaiversById.get(participant.legacy_waiver_id);
    if (!waiver) continue;
    const item = {
      participantId: "",
      submissionId: "",
      legacyParticipantId: participant.id,
      selectionKey: `legacy:${participant.id}`,
      source: "legacy_smartwaiver" as const,
      firstName: participant.first_name,
      lastName: participant.last_name,
      fullName: `${participant.first_name} ${participant.last_name}`.trim(),
      dobYmd: participant.dob ?? "",
      birthYear: participant.dob ? Number(participant.dob.slice(0, 4)) || 0 : 0,
      role: participant.role as "child" | "adult_signer" | "adult_covered",
      expiresOnYmd: waiver.expires_on,
      expired: !waiver.activated || waiver.expires_on <= dateYmd,
      signerLastInitial: ((waiver.signer_last_name ?? "").trim()[0] || "").toUpperCase(),
      checkInEligible: waiver.activated && waiver.expires_on > dateYmd,
    };
    participantsByLegacyWaiver.set(participant.legacy_waiver_id, [
      ...(participantsByLegacyWaiver.get(participant.legacy_waiver_id) ?? []),
      item,
    ]);
  }

  for (const visit of legacyVisits ?? []) {
    snapshots.push({
      id: visit.id,
      source: "legacy_smartwaiver",
      visitDate: visit.visit_date,
      businessDayYmd: visit.business_day_ymd,
      status: visit.status as VisitSnapshot["status"],
      notes: visit.notes,
      createdAt: visit.created_at,
      attendees: (legacyAttendees ?? [])
        .filter((item) => item.legacy_visit_id === visit.id)
        .map((item) => ({
          id: item.id,
          visitId: item.legacy_visit_id,
          participantRecordId: item.legacy_participant_id,
          source: "legacy_smartwaiver" as const,
          firstName: legacyParticipantsById.get(item.legacy_participant_id)?.firstName,
          lastName: legacyParticipantsById.get(item.legacy_participant_id)?.lastName,
          fullName:
            legacyParticipantsById.get(item.legacy_participant_id)?.fullName ??
            "Unknown attendee",
          birthDate: legacyParticipantsById.get(item.legacy_participant_id)?.birthDate,
          waiverDetails: (() => {
            const waiver = legacyWaiversById.get(legacyParticipantsById.get(item.legacy_participant_id)?.legacyWaiverId ?? "");
            return waiver
              ? {
                  signerFullName: `${waiver.signer_first_name ?? ""} ${waiver.signer_last_name ?? ""}`.trim(),
                  signerPhone: waiver.phone ?? "",
                  signerEmail: waiver.email ?? "",
                  signerDobYmd: waiver.signer_dob ?? undefined,
                  signedAt: waiver.signed_at ?? waiver.signed_on_ymd ?? "",
                  expiresOnYmd: waiver.expires_on,
                  status: waiver.activated ? "active" : "inactive",
                  source: "Legacy Smartwaiver",
                  waiverId: waiver.waiver_id,
                  waiverTitle: waiver.waiver_title ?? undefined,
                  tags: waiver.tags,
                  priorCheckIns: waiver.check_ins,
                  marketingConsent: waiver.marketing_consent,
                }
              : undefined;
          })(),
          waiverParticipants: participantsByLegacyWaiver.get(legacyParticipantsById.get(item.legacy_participant_id)?.legacyWaiverId ?? "") ?? [],
          ageYearsOnVisit: item.age_years_on_visit,
          classification: item.classification as AdmissionClassification,
          unitPriceCents: item.unit_price_cents,
          status: item.status as "active" | "removed",
        })),
      payments: (legacyPayments ?? [])
        .filter((item) => item.legacy_visit_id === visit.id)
        .map((item) => ({
          id: item.id,
          visitId: item.legacy_visit_id,
          attendeeId: item.legacy_check_in_id,
          entryType: item.entry_type as PaymentEntry["entryType"],
          method: item.method as PaymentMethod,
          amountCents: item.amount_cents,
          relatedEntryId: item.related_entry_id,
          reason: item.reason,
          createdByStaffId: item.created_by_staff_id,
          createdAt: item.created_at,
        })),
    });
  }

  return buildDailyReport(dateYmd, snapshots);
}
