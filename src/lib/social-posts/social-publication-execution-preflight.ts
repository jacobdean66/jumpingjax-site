import type {
  SocialPublicationExecutionIntentRecord,
  SocialPublicationExecutionResultRecord,
} from "./social-publication-execution-repository";

export const SOCIAL_PUBLICATION_EXECUTION_PREFLIGHT_DIAGNOSTIC_CODES = [
  "missing_owner_approval_reference",
  "missing_publication_target_reference",
  "missing_ledger_evidence",
  "missing_publisher_request_reference",
  "missing_scheduler_intent_reference",
  "missing_manifest_reference",
  "owner_authority_missing",
  "publisher_authority_missing",
  "preflight_state_blocked",
  "result_state_blocked",
  "unsafe_execution_contract",
] as const;

export type SocialPublicationExecutionPreflightDiagnosticCode =
  (typeof SOCIAL_PUBLICATION_EXECUTION_PREFLIGHT_DIAGNOSTIC_CODES)[number];

export type SocialPublicationExecutionPreflightDiagnosticCategory =
  | "missing_reference"
  | "missing_authority"
  | "blocked_state"
  | "unsafe";

export type SocialPublicationExecutionPreflightDiagnostic = Readonly<{
  code: SocialPublicationExecutionPreflightDiagnosticCode;
  category: SocialPublicationExecutionPreflightDiagnosticCategory;
  path: string;
  message: string;
  severity: "block";
}>;

export type SocialPublicationExecutionPreflightReferenceSummary = Readonly<{
  ownerApprovalReferencePresent: boolean;
  publicationTargetReferencePresent: boolean;
  ledgerEvidencePresent: boolean;
  publisherRequestReferencePresent: boolean;
  schedulerIntentReferencePresent: boolean;
  manifestReferencePresent: boolean;
}>;

export type SocialPublicationExecutionPreflightAuthoritySummary = Readonly<{
  ownerAuthorityPresent: boolean;
  publisherAuthorityPresent: boolean;
  missingAuthority: readonly string[];
}>;

export type SocialPublicationExecutionPreflightEvidenceSummary = Readonly<{
  intentEvidencePresent: boolean;
  resultEvidencePresent: boolean;
  ledgerEvidencePresent: boolean;
  preflightEvidencePresent: boolean;
}>;

export type SocialPublicationExecutionPreflightEvaluation = Readonly<{
  executionJobId: string;
  executionIntentId: string;
  executionResultId: string | null;
  status: "pass" | "block";
  diagnostics: readonly SocialPublicationExecutionPreflightDiagnostic[];
  missingReferences: readonly string[];
  blockedStates: readonly string[];
  references: SocialPublicationExecutionPreflightReferenceSummary;
  authority: SocialPublicationExecutionPreflightAuthoritySummary;
  evidence: SocialPublicationExecutionPreflightEvidenceSummary;
  couldRunLater: boolean;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  mutatesNothing: true;
}>;

export function evaluateSocialPublicationExecutionPreflight(
  intent: SocialPublicationExecutionIntentRecord,
  result: SocialPublicationExecutionResultRecord | null = null,
): SocialPublicationExecutionPreflightEvaluation {
  const diagnostics: SocialPublicationExecutionPreflightDiagnostic[] = [];
  const missingReferences: string[] = [];
  const blockedStates: string[] = [];

  requireReference(
    intent.scope.owner_approval_id,
    "owner_approval",
    "missing_owner_approval_reference",
    "intent.scope.owner_approval_id",
    "Execution preflight requires an owner approval reference.",
    diagnostics,
    missingReferences,
  );
  requireReference(
    intent.scope.publication_target_id,
    "publication_target",
    "missing_publication_target_reference",
    "intent.scope.publication_target_id",
    "Execution preflight requires a publication target reference.",
    diagnostics,
    missingReferences,
  );
  requireReference(
    intent.scope.ledger_entry_id,
    "ledger_evidence",
    "missing_ledger_evidence",
    "intent.scope.ledger_entry_id",
    "Execution preflight requires publication ledger evidence.",
    diagnostics,
    missingReferences,
  );
  requireReference(
    intent.scope.publisher_request_id,
    "publisher_request",
    "missing_publisher_request_reference",
    "intent.scope.publisher_request_id",
    "Execution preflight requires a Publisher request reference.",
    diagnostics,
    missingReferences,
  );
  requireReference(
    intent.scope.schedule_id,
    "scheduler_intent",
    "missing_scheduler_intent_reference",
    "intent.scope.schedule_id",
    "Execution preflight requires a Scheduler intent reference.",
    diagnostics,
    missingReferences,
  );
  requireReference(
    intent.scope.publication_manifest_id,
    "publication_manifest",
    "missing_manifest_reference",
    "intent.scope.publication_manifest_id",
    "Execution preflight requires a Publication Manifest reference.",
    diagnostics,
    missingReferences,
  );

  if (!intent.owner_approval_satisfied) {
    diagnostics.push(blockDiagnostic(
      "owner_authority_missing",
      "missing_authority",
      "intent.owner_approval_satisfied",
      "Execution preflight requires owner approval authority evidence.",
    ));
  }
  if (!intent.publisher_authority_satisfied) {
    diagnostics.push(blockDiagnostic(
      "publisher_authority_missing",
      "missing_authority",
      "intent.publisher_authority_satisfied",
      "Execution preflight requires Publisher authority evidence.",
    ));
  }

  if (
    intent.preflight_status === "blocked" ||
    intent.preflight_status === "failed" ||
    intent.preflight_block_reasons.length > 0
  ) {
    blockedStates.push("preflight");
    diagnostics.push(blockDiagnostic(
      "preflight_state_blocked",
      "blocked_state",
      "intent.preflight_status",
      "Execution preflight is blocked by an existing preflight state.",
    ));
  }

  if (
    result &&
    (result.result_status === "blocked" ||
      result.result_status === "failed" ||
      result.block_reasons.length > 0)
  ) {
    blockedStates.push("result");
    diagnostics.push(blockDiagnostic(
      "result_state_blocked",
      "blocked_state",
      "result.result_status",
      "Execution preflight is blocked by an existing result state.",
    ));
  }

  if (!intentRecordIsSafe(intent) || (result && !resultRecordIsSafe(result))) {
    diagnostics.push(blockDiagnostic(
      "unsafe_execution_contract",
      "unsafe",
      "execution.contract",
      "Execution preflight requires non-executing, read-only contract invariants.",
    ));
  }

  const authorityMissing = diagnostics
    .filter((diagnostic) => diagnostic.category === "missing_authority")
    .map((diagnostic) =>
      diagnostic.code === "owner_authority_missing"
        ? "owner_approval"
        : "publisher_authority",
    );
  const unsafe = diagnostics.some((diagnostic) => diagnostic.category === "unsafe");
  const couldRunLater =
    !unsafe &&
    diagnostics.every((diagnostic) =>
      diagnostic.category === "missing_reference" ||
      diagnostic.category === "missing_authority" ||
      diagnostic.category === "blocked_state",
    );

  return deepFreeze({
    executionJobId: intent.execution_job_id,
    executionIntentId: intent.execution_intent_id,
    executionResultId: result?.execution_result_id ?? null,
    status: diagnostics.length === 0 ? "pass" : "block",
    diagnostics,
    missingReferences,
    blockedStates,
    references: {
      ownerApprovalReferencePresent: hasText(intent.scope.owner_approval_id),
      publicationTargetReferencePresent: hasText(intent.scope.publication_target_id),
      ledgerEvidencePresent: hasText(intent.scope.ledger_entry_id),
      publisherRequestReferencePresent: hasText(intent.scope.publisher_request_id),
      schedulerIntentReferencePresent: hasText(intent.scope.schedule_id),
      manifestReferencePresent: hasText(intent.scope.publication_manifest_id),
    },
    authority: {
      ownerAuthorityPresent: intent.owner_approval_satisfied,
      publisherAuthorityPresent: intent.publisher_authority_satisfied,
      missingAuthority: authorityMissing,
    },
    evidence: {
      intentEvidencePresent: hasText(intent.evidence_id),
      resultEvidencePresent: hasText(result?.evidence_id ?? null),
      ledgerEvidencePresent: hasText(intent.scope.ledger_entry_id),
      preflightEvidencePresent: hasText(intent.preflight_id),
    },
    couldRunLater,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    mutatesNothing: true,
  });
}

function requireReference(
  value: string | null,
  label: string,
  code: Extract<
    SocialPublicationExecutionPreflightDiagnosticCode,
    | "missing_owner_approval_reference"
    | "missing_publication_target_reference"
    | "missing_ledger_evidence"
    | "missing_publisher_request_reference"
    | "missing_scheduler_intent_reference"
    | "missing_manifest_reference"
  >,
  path: string,
  message: string,
  diagnostics: SocialPublicationExecutionPreflightDiagnostic[],
  missingReferences: string[],
): void {
  if (hasText(value)) return;
  missingReferences.push(label);
  diagnostics.push(blockDiagnostic(code, "missing_reference", path, message));
}

function blockDiagnostic(
  code: SocialPublicationExecutionPreflightDiagnosticCode,
  category: SocialPublicationExecutionPreflightDiagnosticCategory,
  path: string,
  message: string,
): SocialPublicationExecutionPreflightDiagnostic {
  return { code, category, path, message, severity: "block" };
}

function intentRecordIsSafe(record: SocialPublicationExecutionIntentRecord): boolean {
  return (
    record.contract_only === true &&
    record.model_authority_only === true &&
    record.references_only === true &&
    record.executes_nothing === true &&
    record.publishes_nothing === true &&
    record.calls_no_external_apis === true &&
    record.uses_no_sdks === true &&
    record.uses_no_network === true &&
    record.starts_no_workers === true &&
    record.starts_no_timers === true &&
    record.creates_no_queues === true &&
    record.exposes_no_api_routes === true &&
    record.exposes_no_admin_ui === true &&
    record.mutates_no_sql === true &&
    record.mutates_no_storage === true &&
    record.mutates_no_lower_layers === true &&
    record.records_no_metrics === true &&
    record.performs_no_learning === true &&
    record.grants_execution_permission === false
  );
}

function resultRecordIsSafe(record: SocialPublicationExecutionResultRecord): boolean {
  return (
    record.contract_only === true &&
    record.model_authority_only === true &&
    record.references_only === true &&
    record.executes_nothing === true &&
    record.publishes_nothing === true &&
    record.calls_no_external_apis === true &&
    record.uses_no_sdks === true &&
    record.uses_no_network === true &&
    record.persists_nothing === true &&
    record.mutates_no_lower_layers === true &&
    record.current_execution_status_authority === false &&
    record.records_no_metrics === true &&
    record.performs_no_learning === true &&
    record.grants_execution_permission === false
  );
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }

  return Object.freeze(value);
}
