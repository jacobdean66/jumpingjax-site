import { createServiceRoleClient } from "@/lib/supabase/admin";

export const MAX_WAIVER_NAME_LENGTH = 80;
export const MAX_WAIVER_NAME_REASON_LENGTH = 500;

export type WaiverDisplayNameCorrectionInput = {
  participantId: string;
  firstName: string;
  lastName: string;
  reason: string;
  staffId: string;
};

export type WaiverDisplayNameCorrectionResult = {
  participantId: string;
  submissionId: string;
  originalFirstName: string;
  originalLastName: string;
  correctedFirstName: string;
  correctedLastName: string;
  correctedAt: string;
};

type CorrectionRpcOutcome = {
  outcome: string;
  participant_id?: string;
  submission_id?: string;
  original_first_name?: string;
  original_last_name?: string;
  corrected_first_name?: string;
  corrected_last_name?: string;
  corrected_at?: string;
};

export class WaiverNameCorrectionValidationError extends Error {
  readonly code = "waiver_name_correction_validation" as const;
  constructor(message: string) {
    super(message);
    this.name = "WaiverNameCorrectionValidationError";
  }
}

export function normalizeCorrectedName(value: string, label: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    throw new WaiverNameCorrectionValidationError(`${label} is required`);
  }
  if (trimmed.length > MAX_WAIVER_NAME_LENGTH) {
    throw new WaiverNameCorrectionValidationError(
      `${label} must be ${MAX_WAIVER_NAME_LENGTH} characters or less`,
    );
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9 '\-.]*$/.test(trimmed)) {
    throw new WaiverNameCorrectionValidationError(
      `${label} contains unsupported characters`,
    );
  }
  return trimmed;
}

export function normalizeCorrectionReason(reason: string): string {
  const trimmed = reason.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    throw new WaiverNameCorrectionValidationError("Correction reason is required");
  }
  if (trimmed.length > MAX_WAIVER_NAME_REASON_LENGTH) {
    throw new WaiverNameCorrectionValidationError(
      `Correction reason must be ${MAX_WAIVER_NAME_REASON_LENGTH} characters or less`,
    );
  }
  return trimmed;
}

export async function correctWaiverParticipantDisplayName(
  input: WaiverDisplayNameCorrectionInput,
): Promise<WaiverDisplayNameCorrectionResult> {
  const participantId = input.participantId.trim();
  const staffId = input.staffId.trim();
  if (!participantId) {
    throw new WaiverNameCorrectionValidationError("participantId is required");
  }
  if (!staffId) {
    throw new WaiverNameCorrectionValidationError("staffId is required");
  }

  const firstName = normalizeCorrectedName(input.firstName, "First name");
  const lastName = normalizeCorrectedName(input.lastName, "Last name");
  const reason = normalizeCorrectionReason(input.reason);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc(
    "correct_waiver_participant_display_name_atomic",
    {
      p_payload: {
        participant_id: participantId,
        first_name: firstName,
        last_name: lastName,
        reason,
        staff_id: staffId,
      },
    },
  );

  if (error) {
    if (error.message?.includes("invalid_input")) {
      throw new WaiverNameCorrectionValidationError("Invalid name correction request");
    }
    throw new Error("Unable to correct waiver participant name");
  }

  const result = data as CorrectionRpcOutcome;
  if (result.outcome === "participant_not_found") {
    throw new WaiverNameCorrectionValidationError("Waiver participant was not found");
  }
  if (result.outcome === "no_change") {
    throw new WaiverNameCorrectionValidationError("Enter a new corrected name");
  }
  if (result.outcome === "invalid_input") {
    throw new WaiverNameCorrectionValidationError("Invalid name correction request");
  }
  if (result.outcome !== "corrected") {
    throw new Error("Unable to correct waiver participant name");
  }

  return {
    participantId: result.participant_id ?? participantId,
    submissionId: result.submission_id ?? "",
    originalFirstName: result.original_first_name ?? "",
    originalLastName: result.original_last_name ?? "",
    correctedFirstName: result.corrected_first_name ?? firstName,
    correctedLastName: result.corrected_last_name ?? lastName,
    correctedAt: result.corrected_at ?? new Date().toISOString(),
  };
}
