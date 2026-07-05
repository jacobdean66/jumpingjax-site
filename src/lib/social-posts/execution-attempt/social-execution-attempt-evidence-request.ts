import {
  SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_KINDS,
  SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION,
  type SocialExecutionAttemptEvidenceKind,
} from "./social-execution-attempt-evidence-domain";
import {
  SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_KINDS,
  type SocialExecutionAttemptStateTransitionKind,
} from "./social-execution-attempt-state-transition-domain";

export const SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_REQUEST_VERSION =
  SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION;

export const SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_KINDS = [
  "operator_note",
  "correlation_evidence",
  "lifecycle_alignment_evidence",
  "authorization_linkage_evidence",
  "state_transition_evidence",
] as const satisfies readonly SocialExecutionAttemptEvidenceKind[];

export const SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_TRANSITION_KINDS = [
  "evidence_aligned",
] as const satisfies readonly SocialExecutionAttemptStateTransitionKind[];

export const SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_REQUEST_ERROR_CODES = [
  "attempt_id_required",
  "attempt_id_invalid",
  "owner_approval_id_required",
  "owner_approval_id_invalid",
  "evidence_kind_required",
  "evidence_kind_invalid",
  "sanitized_summary_required",
  "sanitized_summary_invalid",
  "transition_kind_invalid",
] as const;

export type SocialExecutionAttemptEvidenceRequestErrorCode =
  (typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_REQUEST_ERROR_CODES)[number];

export type SocialExecutionAttemptEvidenceRequestValidationResult = Readonly<
  | {
      ok: true;
      attemptId: string;
      ownerApprovalId: string;
      evidenceKind: (typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_KINDS)[number];
      sanitizedSummary: string;
      transitionKind: (typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_TRANSITION_KINDS)[number] | null;
      requestVersion: typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_REQUEST_VERSION;
    }
  | {
      ok: false;
      code: SocialExecutionAttemptEvidenceRequestErrorCode;
      message: string;
    }
>;

const ATTEMPT_ID_PATTERN = /^exec-attempt:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const REFERENCE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const MAX_SUMMARY_LENGTH = 500;

export function validateExecutionAttemptEvidenceAppendRequest(input: {
  attemptId: unknown;
  ownerApprovalId: unknown;
  evidenceKind: unknown;
  sanitizedSummary: unknown;
  transitionKind?: unknown;
}): SocialExecutionAttemptEvidenceRequestValidationResult {
  const attemptId = normalizeOptionalString(input.attemptId);
  if (!attemptId) {
    return {
      ok: false,
      code: "attempt_id_required",
      message: "attempt_id is required for execution attempt evidence append.",
    };
  }
  if (!ATTEMPT_ID_PATTERN.test(attemptId)) {
    return {
      ok: false,
      code: "attempt_id_invalid",
      message: "attempt_id format is invalid for execution attempt evidence append.",
    };
  }

  const ownerApprovalId = normalizeOptionalString(input.ownerApprovalId);
  if (!ownerApprovalId) {
    return {
      ok: false,
      code: "owner_approval_id_required",
      message: "owner_approval_id is required for execution attempt evidence append.",
    };
  }
  if (!REFERENCE_ID_PATTERN.test(ownerApprovalId)) {
    return {
      ok: false,
      code: "owner_approval_id_invalid",
      message: "owner_approval_id format is invalid for execution attempt evidence append.",
    };
  }

  const evidenceKind = normalizeOptionalString(input.evidenceKind);
  if (!evidenceKind) {
    return {
      ok: false,
      code: "evidence_kind_required",
      message: "evidence_kind is required for execution attempt evidence append.",
    };
  }
  if (
    !SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_KINDS.includes(
      evidenceKind as (typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_KINDS)[number],
    )
  ) {
    return {
      ok: false,
      code: "evidence_kind_invalid",
      message: "evidence_kind is not allowed for owner-gated evidence append.",
    };
  }

  const sanitizedSummary = normalizeOptionalString(input.sanitizedSummary);
  if (!sanitizedSummary) {
    return {
      ok: false,
      code: "sanitized_summary_required",
      message: "sanitized_summary is required for execution attempt evidence append.",
    };
  }
  if (
    sanitizedSummary.length > MAX_SUMMARY_LENGTH ||
    containsForbiddenSummaryContent(sanitizedSummary)
  ) {
    return {
      ok: false,
      code: "sanitized_summary_invalid",
      message: "sanitized_summary must remain short, metadata-only, and secret-free.",
    };
  }

  const transitionKindRaw = normalizeOptionalString(input.transitionKind);
  let transitionKind: (typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_TRANSITION_KINDS)[number] | null =
    null;
  if (transitionKindRaw) {
    if (
      !SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_TRANSITION_KINDS.includes(
        transitionKindRaw as (typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_TRANSITION_KINDS)[number],
      )
    ) {
      return {
        ok: false,
        code: "transition_kind_invalid",
        message: "transition_kind is not allowed for owner-gated evidence append.",
      };
    }
    transitionKind =
      transitionKindRaw as (typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_TRANSITION_KINDS)[number];
  }

  if (
    transitionKind === "evidence_aligned" &&
    evidenceKind !== "lifecycle_alignment_evidence" &&
    evidenceKind !== "state_transition_evidence"
  ) {
    return {
      ok: false,
      code: "transition_kind_invalid",
      message: "evidence_aligned transitions require lifecycle or state transition evidence kinds.",
    };
  }

  if (!SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_KINDS.includes(evidenceKind as SocialExecutionAttemptEvidenceKind)) {
    return {
      ok: false,
      code: "evidence_kind_invalid",
      message: "evidence_kind is not recognized.",
    };
  }

  if (
    !SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_KINDS.includes(
      transitionKind as SocialExecutionAttemptStateTransitionKind,
    ) &&
    transitionKind !== null
  ) {
    return {
      ok: false,
      code: "transition_kind_invalid",
      message: "transition_kind is not recognized.",
    };
  }

  return {
    ok: true,
    attemptId,
    ownerApprovalId,
    evidenceKind: evidenceKind as (typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_KINDS)[number],
    sanitizedSummary,
    transitionKind,
    requestVersion: SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_REQUEST_VERSION,
  };
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function containsForbiddenSummaryContent(summary: string): boolean {
  const lowered = summary.toLowerCase();
  return (
    lowered.includes("access_token") ||
    lowered.includes("refresh_token") ||
    lowered.includes("bearer ") ||
    lowered.includes("client_secret")
  );
}
