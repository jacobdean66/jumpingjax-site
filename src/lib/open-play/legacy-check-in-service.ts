import { randomUUID } from "node:crypto";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { CheckInValidationError, type VisitAttendeeRequest } from "./check-in";
import {
  assertClientPriceMatches,
  classifyAdultAdmission,
  classifyChildAdmission,
} from "./pricing";
import { isWaiverExpired } from "../waivers/expiration";

export type LegacyCheckInInput = {
  visitDateYmd: string;
  staffId: string;
  notes?: string | null;
  attendees: Array<
    VisitAttendeeRequest & {
      participantId?: string;
      legacyParticipantId: string;
    }
  >;
};

export type LegacyCheckInResult = {
  businessDayYmd: string;
  checkInIds: string[];
  attendees: Array<{
    attendeeId: string;
    participantId: string;
    classification: string;
    unitPriceCents: number;
  }>;
  paymentEntries: Array<{
    id: string;
    attendeeId: string;
    method: "cash" | "card";
    amountCents: number;
  }>;
};

type LegacyParticipantRow = {
  id: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  role: "child" | "adult_signer" | "adult_covered";
  smartwaiver_legacy_waivers:
    | { expires_on: string; activated: boolean; waiver_id: string }
    | { expires_on: string; activated: boolean; waiver_id: string }[]
    | null;
};

type LegacyCheckInRpcOutcome = {
  outcome: string;
  check_in_ids?: string[];
  attendees?: Array<{
    attendee_id: string;
    participant_id: string;
    classification: string;
    unit_price_cents: number;
  }>;
  payments?: Array<{
    id: string;
    attendee_id: string;
    method: "cash" | "card";
    amount_cents: number;
  }>;
};

/**
 * Writes Legacy Smartwaiver check-ins and audit events atomically.
 * Native waiver evidence is never created or changed by this path.
 */
export async function createLegacySmartwaiverCheckIns(
  input: LegacyCheckInInput,
): Promise<LegacyCheckInResult> {
  if (!input.attendees.length) {
    throw new CheckInValidationError("At least one attendee is required");
  }

  const supabase = createServiceRoleClient();
  const ids = input.attendees.map((item) => item.legacyParticipantId.trim());
  if (ids.some((id) => !id)) {
    throw new CheckInValidationError("legacyParticipantId is required");
  }
  if (new Set(ids).size !== ids.length) {
    throw new CheckInValidationError("Duplicate participant in the same visit");
  }

  const { data, error } = await supabase
    .from("smartwaiver_legacy_participants")
    .select(
      "id, first_name, last_name, dob, role, smartwaiver_legacy_waivers(expires_on, activated, waiver_id)",
    )
    .in("id", ids);
  if (error) {
    throw new CheckInValidationError("Unable to load legacy participants");
  }

  const byId = new Map<string, LegacyParticipantRow>();
  for (const row of (data as LegacyParticipantRow[] | null) ?? []) {
    byId.set(row.id, row);
  }

  const prepared: Record<string, unknown>[] = [];
  for (const request of input.attendees) {
    const row = byId.get(request.legacyParticipantId);
    if (!row) {
      throw new CheckInValidationError(
        `Legacy participant not found: ${request.legacyParticipantId}`,
      );
    }
    const waiverRaw = row.smartwaiver_legacy_waivers;
    const waiver = Array.isArray(waiverRaw) ? waiverRaw[0] : waiverRaw;
    if (!waiver || !waiver.activated) {
      throw new CheckInValidationError("Legacy waiver is not active");
    }
    if (!row.dob) {
      throw new CheckInValidationError(
        "Legacy Smartwaiver records without DOB cannot be checked in",
      );
    }
    if (
      isWaiverExpired({
        expiresOnYmd: waiver.expires_on,
        evaluationLocalYmd: input.visitDateYmd,
      })
    ) {
      throw new CheckInValidationError("Expired participants cannot be checked in");
    }

    let classification: string;
    let ageYearsOnVisit: number;
    let unitPriceCents: number;
    if (row.role === "child") {
      const child = classifyChildAdmission(row.dob, input.visitDateYmd);
      classification = child.classification;
      ageYearsOnVisit = child.ageYears;
      unitPriceCents = child.unitPriceCents;
    } else {
      if (request.adultMode !== "playing" && request.adultMode !== "watching") {
        throw new CheckInValidationError(
          "Adult attendees require adultMode playing or watching",
        );
      }
      const adult = classifyAdultAdmission(
        request.adultMode,
        row.dob,
        input.visitDateYmd,
      );
      classification = adult.classification;
      ageYearsOnVisit = adult.ageYears;
      unitPriceCents = adult.unitPriceCents;
    }

    assertClientPriceMatches(unitPriceCents, request.clientPriceCents ?? null);
    const paymentMethod = request.paymentMethod ?? null;
    if (unitPriceCents > 0 && paymentMethod !== "cash" && paymentMethod !== "card") {
      throw new CheckInValidationError(
        "Paid attendees require a cash or card payment method",
      );
    }
    if (unitPriceCents === 0 && paymentMethod) {
      throw new CheckInValidationError(
        "Free watching adults must not include a payment method",
      );
    }

    prepared.push({
      check_in_id: randomUUID(),
      payment_id: unitPriceCents > 0 ? randomUUID() : null,
      audit_id: randomUUID(),
      legacy_participant_id: row.id,
      waiver_id: waiver.waiver_id,
      classification,
      age_years_on_visit: ageYearsOnVisit,
      unit_price_cents: unitPriceCents,
      payment_method: paymentMethod,
    });
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "create_smartwaiver_legacy_check_ins_atomic",
    {
      p_payload: {
        business_day_ymd: input.visitDateYmd,
        staff_id: input.staffId,
        notes: input.notes?.trim() || null,
        attendees: prepared,
      },
    },
  );
  if (rpcError) {
    throw new Error("Unable to create legacy check-ins");
  }

  const outcome = rpcData as LegacyCheckInRpcOutcome;
  if (outcome.outcome === "duplicate_same_day_attendee") {
    throw new CheckInValidationError(
      "Participant is already checked in for this business day",
    );
  }
  if (outcome.outcome !== "created") {
    throw new Error("Unable to create legacy check-ins");
  }

  return {
    businessDayYmd: input.visitDateYmd,
    checkInIds: outcome.check_in_ids ?? [],
    attendees: (outcome.attendees ?? []).map((item) => ({
      attendeeId: item.attendee_id,
      participantId: item.participant_id,
      classification: item.classification,
      unitPriceCents: item.unit_price_cents,
    })),
    paymentEntries: (outcome.payments ?? []).map((item) => ({
      id: item.id,
      attendeeId: item.attendee_id,
      method: item.method,
      amountCents: item.amount_cents,
    })),
  };
}
