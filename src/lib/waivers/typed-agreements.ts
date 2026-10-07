import { ageInCompletedYearsOnDate, isYmd } from "../open-play/pricing";
import type { ParticipantInput } from "./validation";

export type TypedAgreement = {
  participantTempId: string;
  firstName: string;
  lastName: string;
  acknowledgedRisk: boolean;
  acknowledgedTerms: boolean;
  electronicSignature: boolean;
  guardianAuthority: boolean;
  photoConsent: boolean;
};

export const ELECTRONIC_SIGNATURE_NOTICE =
  "By typing my first and last name, I agree to this waiver and intend to sign it electronically.";
export const AGREEMENT_STATEMENTS = {
  acknowledgedRisk:
    "I have read the risks and safety responsibilities in this waiver.",
  acknowledgedTerms:
    "I have read and agree to the waiver, including its release of legal claims to the extent permitted by law.",
  electronicSignature:
    "I am the adult named above. I personally entered my name and agree to sign electronically.",
  guardianAuthority:
    "I am the parent or legal guardian of each child listed under my signature and agree on their behalf.",
  photoConsent:
    "Optional: I permit promotional use of photographs of me and my listed children.",
} as const;

/** Preserve punctuation/accents; only casing, Unicode composition and spacing vary. */
export function normalizeSigningName(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("en-US");
}

export function signatureMatchesName(
  signature: Pick<TypedAgreement, "firstName" | "lastName">,
  adult: Pick<ParticipantInput, "firstName" | "lastName">,
): boolean {
  return (
    normalizeSigningName(signature.firstName) ===
      normalizeSigningName(adult.firstName) &&
    normalizeSigningName(signature.lastName) ===
      normalizeSigningName(adult.lastName)
  );
}

export function emptyTypedAgreement(participantTempId: string): TypedAgreement {
  return {
    participantTempId,
    firstName: "",
    lastName: "",
    acknowledgedRisk: false,
    acknowledgedTerms: false,
    electronicSignature: false,
    guardianAuthority: false,
    photoConsent: false,
  };
}

export function validateTypedAgreements(
  participants: ParticipantInput[],
  agreements: TypedAgreement[],
  todayYmd: string,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const adults = participants.filter((p) => p.role !== "child");
  const adultIds = new Set(adults.map((p) => p.tempId));
  if (
    agreements.length !== adults.length ||
    new Set(agreements.map((a) => a.participantTempId)).size !==
      adults.length ||
    agreements.some((a) => !adultIds.has(a.participantTempId))
  ) {
    errors.agreements =
      "Every adult must sign once in their own signing section.";
  }
  for (const adult of adults) {
    const prefix = `agreements.${adult.tempId}`;
    const name = `${adult.firstName} ${adult.lastName}`.trim();
    if (
      !isYmd(adult.dob) ||
      adult.dob > todayYmd ||
      ageInCompletedYearsOnDate(adult.dob, todayYmd) < 18
    ) {
      errors[`${prefix}.age`] =
        `${name || "Each signing adult"} must be at least 18 years old.`;
    }
    const agreement = agreements.find(
      (a) => a.participantTempId === adult.tempId,
    );
    if (!agreement) {
      errors[prefix] = `${name} must complete their own signature.`;
      continue;
    }
    if (
      !agreement.firstName.trim() ||
      !agreement.lastName.trim() ||
      agreement.firstName.trim().length > 80 ||
      agreement.lastName.trim().length > 80 ||
      !signatureMatchesName(agreement, adult)
    ) {
      errors[`${prefix}.name`] =
        `The signed first and last name must match ${name} on this waiver.`;
    }
    if (
      !agreement.acknowledgedRisk ||
      !agreement.acknowledgedTerms ||
      !agreement.electronicSignature
    ) {
      errors[`${prefix}.consent`] =
        `${name} must personally confirm the risks, waiver terms and electronic signature.`;
    }
    if (
      participants.some(
        (p) => p.role === "child" && p.guardianTempId === adult.tempId,
      ) &&
      !agreement.guardianAuthority
    ) {
      errors[`${prefix}.guardian`] =
        `${name} must confirm they are the parent or legal guardian of their listed children.`;
    }
  }
  return errors;
}
