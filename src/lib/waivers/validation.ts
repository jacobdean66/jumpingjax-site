/**
 * Waiver submission structure validation (pure).
 * Children must be linked to a guardian on the same submission.
 */

import { isYmd } from "@/lib/open-play/pricing";

export type ParticipantRole = "child" | "adult_signer" | "adult_covered";
export type WaiverSource = "web" | "kiosk" | "import";

export const WAIVER_LIMITS = {
  maxBodyBytes: 256 * 1024,
  maxParticipants: 20,
  maxAdults: 8,
  maxChildren: 12,
  maxNameLength: 80,
  maxEmailLength: 254,
  maxPhoneLength: 40,
  maxTempIdLength: 80,
  maxIdempotencyKeyLength: 128,
  minIdempotencyKeyLength: 16,
  maxUserAgentLength: 512,
  allowedSignatureContentTypes: [
    "image/png",
    "image/jpeg",
    "image/webp",
  ] as const,
} as const;

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
  /** Server chooses storage path; clients may only supply content type. */
  signatureContentType: string;
  idempotencyKey: string;
};

export class WaiverValidationError extends Error {
  readonly code = "waiver_validation" as const;
  constructor(message: string) {
    super(message);
    this.name = "WaiverValidationError";
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireNonEmpty(value: string, label: string, max = 80): string {
  const trimmed = value.trim();
  if (!trimmed) throw new WaiverValidationError(`${label} is required`);
  if (trimmed.length > max) {
    throw new WaiverValidationError(`${label} must be ${max} characters or fewer`);
  }
  return trimmed;
}

function requireYmdDob(value: string, todayYmd: string): string {
  const trimmed = value.trim();
  if (!isYmd(trimmed)) {
    throw new WaiverValidationError("Participant date of birth must be a real YYYY-MM-DD date");
  }
  if (trimmed > todayYmd) {
    throw new WaiverValidationError("Participant date of birth cannot be in the future");
  }
  return trimmed;
}

export function validateSubmissionDraft(
  draft: SubmissionDraft,
  options?: { todayYmd?: string },
): SubmissionDraft {
  if (!UUID_RE.test(draft.templateVersionId.trim())) {
    throw new WaiverValidationError("templateVersionId must be a UUID");
  }
  if (!["web", "kiosk", "import"].includes(draft.source)) {
    throw new WaiverValidationError("source must be web, kiosk, or import");
  }

  const contentType = draft.signatureContentType.trim().toLowerCase();
  if (
    !(WAIVER_LIMITS.allowedSignatureContentTypes as readonly string[]).includes(
      contentType,
    )
  ) {
    throw new WaiverValidationError("signatureContentType is not allowed");
  }

  if (!draft.consent.acknowledgedRisk || !draft.consent.acknowledgedTerms) {
    throw new WaiverValidationError("Required consents were not acknowledged");
  }
  if (!draft.consent.isLegalGuardian) {
    throw new WaiverValidationError("Signer must confirm legal guardian status");
  }

  const idempotencyKey = requireNonEmpty(
    draft.idempotencyKey,
    "idempotencyKey",
    WAIVER_LIMITS.maxIdempotencyKeyLength,
  );
  if (idempotencyKey.length < WAIVER_LIMITS.minIdempotencyKeyLength) {
    throw new WaiverValidationError(
      `idempotencyKey must be at least ${WAIVER_LIMITS.minIdempotencyKeyLength} characters`,
    );
  }

  const signer = {
    firstName: requireNonEmpty(
      draft.signer.firstName,
      "Signer first name",
      WAIVER_LIMITS.maxNameLength,
    ),
    lastName: requireNonEmpty(
      draft.signer.lastName,
      "Signer last name",
      WAIVER_LIMITS.maxNameLength,
    ),
    email: requireNonEmpty(
      draft.signer.email,
      "Signer email",
      WAIVER_LIMITS.maxEmailLength,
    ),
    phone: requireNonEmpty(
      draft.signer.phone,
      "Signer phone",
      WAIVER_LIMITS.maxPhoneLength,
    ),
  };
  if (!EMAIL_RE.test(signer.email)) {
    throw new WaiverValidationError("Signer email is invalid");
  }

  if (!Array.isArray(draft.participants) || draft.participants.length === 0) {
    throw new WaiverValidationError("At least one participant is required");
  }
  if (draft.participants.length > WAIVER_LIMITS.maxParticipants) {
    throw new WaiverValidationError(
      `At most ${WAIVER_LIMITS.maxParticipants} participants are allowed`,
    );
  }

  const todayYmd =
    options?.todayYmd ??
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

  const byTempId = new Map<string, ParticipantInput>();
  const participants = draft.participants.map((participant, index) => {
    const tempId = requireNonEmpty(
      participant.tempId || `p-${index}`,
      "Participant tempId",
      WAIVER_LIMITS.maxTempIdLength,
    );
    if (byTempId.has(tempId)) {
      throw new WaiverValidationError(`Duplicate participant tempId: ${tempId}`);
    }
    const normalized: ParticipantInput = {
      tempId,
      firstName: requireNonEmpty(
        participant.firstName,
        "Participant first name",
        WAIVER_LIMITS.maxNameLength,
      ),
      lastName: requireNonEmpty(
        participant.lastName,
        "Participant last name",
        WAIVER_LIMITS.maxNameLength,
      ),
      dob: requireYmdDob(participant.dob, todayYmd),
      role: participant.role,
      guardianTempId: participant.guardianTempId ?? null,
    };
    if (!["child", "adult_signer", "adult_covered"].includes(normalized.role)) {
      throw new WaiverValidationError("Invalid participant role");
    }
    byTempId.set(tempId, normalized);
    return normalized;
  });

  const adults = participants.filter((p) => p.role !== "child");
  const children = participants.filter((p) => p.role === "child");
  if (adults.length > WAIVER_LIMITS.maxAdults) {
    throw new WaiverValidationError(
      `At most ${WAIVER_LIMITS.maxAdults} adults are allowed`,
    );
  }
  if (children.length > WAIVER_LIMITS.maxChildren) {
    throw new WaiverValidationError(
      `At most ${WAIVER_LIMITS.maxChildren} children are allowed`,
    );
  }

  const signers = participants.filter((p) => p.role === "adult_signer");
  if (signers.length !== 1) {
    throw new WaiverValidationError("Exactly one adult_signer is required");
  }
  const adultSigner = signers[0];
  if (
    adultSigner.firstName.toLowerCase() !== signer.firstName.toLowerCase() ||
    adultSigner.lastName.toLowerCase() !== signer.lastName.toLowerCase()
  ) {
    throw new WaiverValidationError(
      "Signer identity must match the adult_signer participant",
    );
  }

  for (const participant of participants) {
    if (participant.role === "child") {
      const guardianTempId = participant.guardianTempId?.trim();
      if (!guardianTempId) {
        throw new WaiverValidationError(
          "Every child must have a guardian on the submission",
        );
      }
      const guardian = byTempId.get(guardianTempId);
      if (!guardian) {
        throw new WaiverValidationError("Child guardian reference is invalid");
      }
      if (guardian.role !== "adult_signer" && guardian.role !== "adult_covered") {
        throw new WaiverValidationError(
          "Child guardian must be an adult on the same submission",
        );
      }
      if (guardianTempId === participant.tempId) {
        throw new WaiverValidationError("Child cannot be their own guardian");
      }
    } else if (participant.guardianTempId) {
      throw new WaiverValidationError("Only children may reference a guardian");
    }
  }

  return {
    templateVersionId: draft.templateVersionId.trim().toLowerCase(),
    signer,
    participants,
    consent: draft.consent,
    source: draft.source,
    signatureContentType: contentType,
    idempotencyKey,
  };
}

export function buildCanonicalSubmissionPayload(draft: SubmissionDraft) {
  return {
    templateVersionId: draft.templateVersionId,
    signer: draft.signer,
    participants: draft.participants.map((p) => ({
      tempId: p.tempId,
      firstName: p.firstName,
      lastName: p.lastName,
      dob: p.dob,
      role: p.role,
      guardianTempId: p.guardianTempId ?? null,
    })),
    consent: draft.consent,
    source: draft.source,
    signatureContentType: draft.signatureContentType,
  };
}
