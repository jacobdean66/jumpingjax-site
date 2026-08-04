/**
 * Waiver submission structure validation (pure).
 * Children must be linked to a guardian on the same submission.
 */

export type ParticipantRole = "child" | "adult_signer" | "adult_covered";
export type WaiverSource = "web" | "kiosk" | "import";

export type ParticipantInput = {
  tempId: string;
  firstName: string;
  lastName: string;
  dob: string;
  role: ParticipantRole;
  guardianTempId?: string | null;
};

export type SignerInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type ConsentInput = {
  acknowledgedRisk: boolean;
  acknowledgedTerms: boolean;
  isLegalGuardian: boolean;
};

export type SubmissionDraft = {
  templateVersionId: string;
  signer: SignerInput;
  participants: ParticipantInput[];
  consent: ConsentInput;
  source: WaiverSource;
  signatureStoragePath: string;
  signatureContentType: string;
  idempotencyKey?: string | null;
};

export class WaiverValidationError extends Error {
  readonly code = "waiver_validation" as const;
  constructor(message: string) {
    super(message);
    this.name = "WaiverValidationError";
  }
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireNonEmpty(value: string, label: string, max = 80): string {
  const trimmed = value.trim();
  if (!trimmed) throw new WaiverValidationError(`${label} is required`);
  if (trimmed.length > max) {
    throw new WaiverValidationError(`${label} must be ${max} characters or fewer`);
  }
  return trimmed;
}

function requireYmd(value: string, label: string): string {
  const trimmed = value.trim();
  if (!YMD_RE.test(trimmed)) {
    throw new WaiverValidationError(`${label} must be YYYY-MM-DD`);
  }
  return trimmed;
}

export function validateSubmissionDraft(draft: SubmissionDraft): SubmissionDraft {
  if (!draft.templateVersionId.trim()) {
    throw new WaiverValidationError("templateVersionId is required");
  }
  if (!["web", "kiosk", "import"].includes(draft.source)) {
    throw new WaiverValidationError("source must be web, kiosk, or import");
  }
  if (!draft.signatureStoragePath.trim()) {
    throw new WaiverValidationError("signatureStoragePath is required");
  }
  if (!draft.signatureContentType.trim()) {
    throw new WaiverValidationError("signatureContentType is required");
  }
  if (!draft.consent.acknowledgedRisk || !draft.consent.acknowledgedTerms) {
    throw new WaiverValidationError("Required consents were not acknowledged");
  }
  if (!draft.consent.isLegalGuardian) {
    throw new WaiverValidationError("Signer must confirm legal guardian status");
  }

  const signer = {
    firstName: requireNonEmpty(draft.signer.firstName, "Signer first name"),
    lastName: requireNonEmpty(draft.signer.lastName, "Signer last name"),
    email: requireNonEmpty(draft.signer.email, "Signer email", 254),
    phone: requireNonEmpty(draft.signer.phone, "Signer phone", 40),
  };
  if (!EMAIL_RE.test(signer.email)) {
    throw new WaiverValidationError("Signer email is invalid");
  }

  if (!Array.isArray(draft.participants) || draft.participants.length === 0) {
    throw new WaiverValidationError("At least one participant is required");
  }

  const byTempId = new Map<string, ParticipantInput>();
  const participants = draft.participants.map((participant, index) => {
    const tempId = requireNonEmpty(participant.tempId || `p-${index}`, "Participant tempId", 80);
    if (byTempId.has(tempId)) {
      throw new WaiverValidationError(`Duplicate participant tempId: ${tempId}`);
    }
    const normalized: ParticipantInput = {
      tempId,
      firstName: requireNonEmpty(participant.firstName, "Participant first name"),
      lastName: requireNonEmpty(participant.lastName, "Participant last name"),
      dob: requireYmd(participant.dob, "Participant date of birth"),
      role: participant.role,
      guardianTempId: participant.guardianTempId ?? null,
    };
    if (!["child", "adult_signer", "adult_covered"].includes(normalized.role)) {
      throw new WaiverValidationError("Invalid participant role");
    }
    byTempId.set(tempId, normalized);
    return normalized;
  });

  const signers = participants.filter((p) => p.role === "adult_signer");
  if (signers.length !== 1) {
    throw new WaiverValidationError("Exactly one adult_signer is required");
  }

  for (const participant of participants) {
    if (participant.role === "child") {
      const guardianTempId = participant.guardianTempId?.trim();
      if (!guardianTempId) {
        throw new WaiverValidationError("Every child must have a guardian on the submission");
      }
      const guardian = byTempId.get(guardianTempId);
      if (!guardian) {
        throw new WaiverValidationError("Child guardian reference is invalid");
      }
      if (guardian.role !== "adult_signer" && guardian.role !== "adult_covered") {
        throw new WaiverValidationError("Child guardian must be an adult on the same submission");
      }
    } else if (participant.guardianTempId) {
      throw new WaiverValidationError("Only children may reference a guardian");
    }
  }

  return {
    ...draft,
    signer,
    participants,
    signatureStoragePath: draft.signatureStoragePath.trim(),
    signatureContentType: draft.signatureContentType.trim(),
    idempotencyKey: draft.idempotencyKey?.trim() || null,
  };
}
