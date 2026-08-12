/**
 * Pure helpers for building Open Play visit attendee drafts.
 */

import {
  assertClientPriceMatches,
  classifyAdultAdmission,
  classifyChildAdmission,
  type AdmissionClassification,
  type AdultPlayMode,
} from "./pricing";
import { isWaiverExpired } from "../waivers/expiration";

export type ParticipantRecord = {
  id: string;
  submissionId: string;
  firstName: string;
  lastName: string;
  dob: string;
  role: "child" | "adult_signer" | "adult_covered";
  expiresOnYmd: string;
  submissionStatus: "completed" | "voided";
};

export type VisitAttendeeRequest = {
  participantId: string;
  adultMode?: AdultPlayMode | null;
  clientPriceCents?: number | null;
  paymentMethod?: "cash" | "card" | null;
};

export type PreparedAttendee = {
  participantId: string;
  waiverSubmissionId: string;
  classification: AdmissionClassification;
  ageYearsOnVisit: number;
  unitPriceCents: number;
  paymentMethod: "cash" | "card" | null;
};

export class CheckInValidationError extends Error {
  readonly code = "check_in_validation" as const;
  constructor(message: string) {
    super(message);
    this.name = "CheckInValidationError";
  }
}

export function prepareVisitAttendees(options: {
  visitDateYmd: string;
  participantsById: Map<string, ParticipantRecord>;
  requests: VisitAttendeeRequest[];
}): PreparedAttendee[] {
  if (!options.requests.length) {
    throw new CheckInValidationError("At least one attendee is required");
  }

  const seen = new Set<string>();
  const prepared: PreparedAttendee[] = [];

  for (const request of options.requests) {
    const participantId = request.participantId.trim();
    if (!participantId) {
      throw new CheckInValidationError("participantId is required");
    }
    if (seen.has(participantId)) {
      throw new CheckInValidationError("Duplicate participant in the same visit");
    }
    seen.add(participantId);

    const participant = options.participantsById.get(participantId);
    if (!participant) {
      throw new CheckInValidationError(`Participant not found: ${participantId}`);
    }
    if (participant.submissionStatus !== "completed") {
      throw new CheckInValidationError("Only completed waivers can be checked in");
    }
    if (
      isWaiverExpired({
        expiresOnYmd: participant.expiresOnYmd,
        evaluationLocalYmd: options.visitDateYmd,
      })
    ) {
      throw new CheckInValidationError("Expired participants cannot be checked in");
    }

    let classification: AdmissionClassification;
    let ageYearsOnVisit: number;
    let unitPriceCents: number;

    if (participant.role === "child") {
      const child = classifyChildAdmission(participant.dob, options.visitDateYmd);
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
        participant.dob,
        options.visitDateYmd,
      );
      classification = adult.classification;
      ageYearsOnVisit = adult.ageYears;
      unitPriceCents = adult.unitPriceCents;
    }

    assertClientPriceMatches(unitPriceCents, request.clientPriceCents);

    const paymentMethod = request.paymentMethod ?? null;
    if (unitPriceCents > 0) {
      if (paymentMethod !== "cash" && paymentMethod !== "card") {
        throw new CheckInValidationError(
          "Paid attendees require a cash or card payment method",
        );
      }
    } else if (paymentMethod) {
      throw new CheckInValidationError("Free watching adults must not include a payment method");
    }

    prepared.push({
      participantId: participant.id,
      waiverSubmissionId: participant.submissionId,
      classification,
      ageYearsOnVisit,
      unitPriceCents,
      paymentMethod,
    });
  }

  return prepared;
}
