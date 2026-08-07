/**
 * Pure client-side helpers for the public multi-step waiver form.
 * Field names match src/lib/waivers/validation.ts / submit route contracts.
 */

import { isYmd } from "@/lib/open-play/pricing";
import {
  WAIVER_LIMITS,
  type ConsentInput,
  type ParticipantRole,
  type SignerInput,
} from "@/lib/waivers/validation";

export const SIGNER_PARTICIPANT_TEMP_ID = "signer";

export type WaiverFormStep =
  | "signer"
  | "participants"
  | "legal"
  | "signature"
  | "review"
  | "submit";

export const WAIVER_FORM_STEPS = [
  "signer",
  "participants",
  "legal",
  "signature",
  "review",
] as const satisfies readonly WaiverFormStep[];

export type CoveredParticipantDraft = {
  tempId: string;
  firstName: string;
  lastName: string;
  dob: string;
  /** User-selected kind; mapped to backend roles when building the payload. */
  kind: "child" | "adult";
  /** Required when kind === "child"; references an adult tempId on this waiver. */
  guardianTempId: string | null;
};

export type SignerFormState = SignerInput & {
  /** Required for the adult_signer participant row. */
  dob: string;
};

export type WaiverFormState = {
  signer: SignerFormState;
  participants: CoveredParticipantDraft[];
  consent: ConsentInput;
  /** Drawn signature present in memory (not persisted). */
  signaturePresent: boolean;
  signatureContentType: "image/png" | "image/jpeg" | "image/webp" | "";
  /**
   * Active template version UUID from a public template contract.
   * Empty when no public template retrieval API exists.
   */
  templateVersionId: string;
  /**
   * Backend-owned legal HTML when a public template contract provides it.
   * Never invent or paraphrase legal language into this field.
   */
  legalBodyHtml: string | null;
  legalVersionLabel: string | null;
  legalTemplateAvailable: boolean;
};

export type FieldErrors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createEmptySigner(): SignerFormState {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dob: "",
  };
}

export function createEmptyConsent(): ConsentInput {
  return {
    acknowledgedRisk: false,
    acknowledgedTerms: false,
    isLegalGuardian: false,
  };
}

export function createInitialWaiverFormState(): WaiverFormState {
  return {
    signer: createEmptySigner(),
    participants: [],
    consent: createEmptyConsent(),
    signaturePresent: false,
    signatureContentType: "",
    templateVersionId: "",
    legalBodyHtml: null,
    legalVersionLabel: null,
    legalTemplateAvailable: false,
  };
}

export function createParticipantDraft(
  partial?: Partial<CoveredParticipantDraft>,
): CoveredParticipantDraft {
  return {
    tempId: partial?.tempId ?? `p-${cryptoRandomTempId()}`,
    firstName: partial?.firstName ?? "",
    lastName: partial?.lastName ?? "",
    dob: partial?.dob ?? "",
    kind: partial?.kind ?? "child",
    guardianTempId:
      partial && Object.prototype.hasOwnProperty.call(partial, "guardianTempId")
        ? (partial.guardianTempId ?? null)
        : SIGNER_PARTICIPANT_TEMP_ID,
  };
}

function cryptoRandomTempId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Idempotency key for one submission attempt (min 16, max 128). */
export function createWaiverIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `wvr_${crypto.randomUUID().replace(/-/g, "")}`;
  }
  const rand = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `wvr_${rand}`.slice(0, WAIVER_LIMITS.maxIdempotencyKeyLength);
}

export function todayYmdAmericaNewYork(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function requireTrimmed(
  value: string,
  label: string,
  max: number,
  errors: FieldErrors,
  key: string,
): string {
  const trimmed = value.trim();
  if (!trimmed) {
    errors[key] = `${label} is required`;
    return "";
  }
  if (trimmed.length > max) {
    errors[key] = `${label} must be ${max} characters or fewer`;
    return trimmed;
  }
  return trimmed;
}

export function validateSignerStep(signer: SignerFormState): FieldErrors {
  const errors: FieldErrors = {};
  requireTrimmed(signer.firstName, "First name", WAIVER_LIMITS.maxNameLength, errors, "firstName");
  requireTrimmed(signer.lastName, "Last name", WAIVER_LIMITS.maxNameLength, errors, "lastName");
  const email = requireTrimmed(
    signer.email,
    "Email",
    WAIVER_LIMITS.maxEmailLength,
    errors,
    "email",
  );
  if (email && !EMAIL_RE.test(email)) {
    errors.email = "Enter a valid email address";
  }
  requireTrimmed(signer.phone, "Phone", WAIVER_LIMITS.maxPhoneLength, errors, "phone");
  const dob = signer.dob.trim();
  if (!dob) {
    errors.dob = "Date of birth is required";
  } else if (!isYmd(dob)) {
    errors.dob = "Enter a valid date of birth";
  } else if (dob > todayYmdAmericaNewYork()) {
    errors.dob = "Date of birth cannot be in the future";
  }
  return errors;
}

export function adultOptionsForGuardian(
  signer: SignerFormState,
  participants: CoveredParticipantDraft[],
): Array<{ tempId: string; label: string }> {
  const options: Array<{ tempId: string; label: string }> = [
    {
      tempId: SIGNER_PARTICIPANT_TEMP_ID,
      label: `${signer.firstName.trim() || "Signer"} ${signer.lastName.trim()}`.trim() || "Signer",
    },
  ];
  for (const p of participants) {
    if (p.kind !== "adult") continue;
    const name = `${p.firstName.trim()} ${p.lastName.trim()}`.trim() || "Adult participant";
    options.push({ tempId: p.tempId, label: name });
  }
  return options;
}

export function validateParticipantsStep(
  signer: SignerFormState,
  participants: CoveredParticipantDraft[],
): FieldErrors {
  const errors: FieldErrors = {};
  const adults = participants.filter((p) => p.kind === "adult");
  const children = participants.filter((p) => p.kind === "child");

  // Signer counts as one adult.
  if (1 + adults.length > WAIVER_LIMITS.maxAdults) {
    errors.form = `At most ${WAIVER_LIMITS.maxAdults} adults are allowed`;
  }
  if (children.length > WAIVER_LIMITS.maxChildren) {
    errors.form = `At most ${WAIVER_LIMITS.maxChildren} children are allowed`;
  }
  if (1 + participants.length > WAIVER_LIMITS.maxParticipants) {
    errors.form = `At most ${WAIVER_LIMITS.maxParticipants} participants are allowed`;
  }

  const today = todayYmdAmericaNewYork();
  const adultIds = new Set([
    SIGNER_PARTICIPANT_TEMP_ID,
    ...adults.map((p) => p.tempId),
  ]);

  participants.forEach((p, index) => {
    const prefix = `participants.${index}`;
    requireTrimmed(p.firstName, "First name", WAIVER_LIMITS.maxNameLength, errors, `${prefix}.firstName`);
    requireTrimmed(p.lastName, "Last name", WAIVER_LIMITS.maxNameLength, errors, `${prefix}.lastName`);
    const dob = p.dob.trim();
    if (!dob) {
      errors[`${prefix}.dob`] = "Date of birth is required";
    } else if (!isYmd(dob)) {
      errors[`${prefix}.dob`] = "Enter a valid date of birth";
    } else if (dob > today) {
      errors[`${prefix}.dob`] = "Date of birth cannot be in the future";
    }

    if (p.kind === "child") {
      const guardian = p.guardianTempId?.trim() ?? "";
      if (!guardian) {
        errors[`${prefix}.guardianTempId`] =
          "Select this child’s parent or legal guardian";
      } else if (!adultIds.has(guardian)) {
        errors[`${prefix}.guardianTempId`] =
          "Guardian must be an adult on this waiver";
      }
    }
  });

  return errors;
}

export function validateConsentStep(consent: ConsentInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!consent.acknowledgedRisk) {
    errors.acknowledgedRisk = "Required — please check this box";
  }
  if (!consent.acknowledgedTerms) {
    errors.acknowledgedTerms = "Required — please check this box";
  }
  if (!consent.isLegalGuardian) {
    errors.isLegalGuardian = "Required — please confirm your authority to sign";
  }
  return errors;
}

export function validateLegalStep(state: WaiverFormState): FieldErrors {
  const errors = validateConsentStep(state.consent);
  if (!state.legalTemplateAvailable || !state.templateVersionId.trim()) {
    errors.template =
      "Waiver legal text is not available from the server, so consent cannot be completed yet.";
  } else if (!UUID_RE.test(state.templateVersionId.trim())) {
    errors.template = "Waiver version information is invalid.";
  }
  return errors;
}

export function validateSignatureStep(state: WaiverFormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!state.signaturePresent) {
    errors.signature = "Please draw your signature";
  }
  if (
    !state.signatureContentType ||
    !(WAIVER_LIMITS.allowedSignatureContentTypes as readonly string[]).includes(
      state.signatureContentType,
    )
  ) {
    errors.signatureContentType = "Signature format is not accepted";
  }
  return errors;
}

export type PublicSubmitParticipant = {
  tempId: string;
  firstName: string;
  lastName: string;
  dob: string;
  role: ParticipantRole;
  guardianTempId?: string | null;
};

export type PublicSubmitBody = {
  templateVersionId: string;
  signer: SignerInput;
  participants: PublicSubmitParticipant[];
  consent: ConsentInput;
  source: "web";
  signatureContentType: string;
  idempotencyKey: string;
};

/**
 * Builds the exact POST /api/waiver/submit JSON body from form state.
 * Does not include signature image bytes — the reviewed contract accepts
 * signatureContentType only (no public binary upload field).
 */
export function buildPublicSubmitBody(
  state: WaiverFormState,
  idempotencyKey: string,
): PublicSubmitBody {
  const signer: SignerInput = {
    firstName: state.signer.firstName.trim(),
    lastName: state.signer.lastName.trim(),
    email: state.signer.email.trim(),
    phone: state.signer.phone.trim(),
  };

  const adultSigner: PublicSubmitParticipant = {
    tempId: SIGNER_PARTICIPANT_TEMP_ID,
    firstName: signer.firstName,
    lastName: signer.lastName,
    dob: state.signer.dob.trim(),
    role: "adult_signer",
    guardianTempId: null,
  };

  const others: PublicSubmitParticipant[] = state.participants.map((p) => {
    if (p.kind === "child") {
      return {
        tempId: p.tempId,
        firstName: p.firstName.trim(),
        lastName: p.lastName.trim(),
        dob: p.dob.trim(),
        role: "child",
        guardianTempId: p.guardianTempId?.trim() || null,
      };
    }
    return {
      tempId: p.tempId,
      firstName: p.firstName.trim(),
      lastName: p.lastName.trim(),
      dob: p.dob.trim(),
      role: "adult_covered",
      guardianTempId: null,
    };
  });

  return {
    templateVersionId: state.templateVersionId.trim(),
    signer,
    participants: [adultSigner, ...others],
    consent: {
      acknowledgedRisk: state.consent.acknowledgedRisk === true,
      acknowledgedTerms: state.consent.acknowledgedTerms === true,
      isLegalGuardian: state.consent.isLegalGuardian === true,
    },
    source: "web",
    signatureContentType: state.signatureContentType || "image/png",
    idempotencyKey,
  };
}

/** Stable fingerprint so idempotency key regenerates when the draft changes. */
export function waiverDraftFingerprint(body: Omit<PublicSubmitBody, "idempotencyKey">): string {
  return JSON.stringify(body);
}

export function stepIndex(step: WaiverFormStep): number {
  if (step === "submit") return WAIVER_FORM_STEPS.length;
  const idx = WAIVER_FORM_STEPS.indexOf(step);
  return idx < 0 ? WAIVER_FORM_STEPS.length : idx;
}

export function canNavigateToStep(
  target: WaiverFormStep,
  state: WaiverFormState,
): { ok: boolean; errors: FieldErrors; blockedAt?: WaiverFormStep } {
  const targetIdx = stepIndex(target);
  for (let i = 0; i < targetIdx; i += 1) {
    const step = WAIVER_FORM_STEPS[i];
    let errors: FieldErrors = {};
    if (step === "signer") errors = validateSignerStep(state.signer);
    else if (step === "participants") {
      errors = validateParticipantsStep(state.signer, state.participants);
    }     else if (step === "legal") errors = validateLegalStep(state);
    else if (step === "signature") errors = validateSignatureStep(state);
    if (Object.keys(errors).length > 0) {
      return { ok: false, errors, blockedAt: step };
    }
  }
  return { ok: true, errors: {} };
}
