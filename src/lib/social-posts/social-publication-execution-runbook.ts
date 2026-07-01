export const SOCIAL_PUBLICATION_EXECUTION_RUNBOOK_STEP_KINDS = [
  "verify_preflight_pass",
  "verify_planner_ready",
  "verify_adapter_available",
  "verify_dry_run_capable",
  "verify_owner_authority",
  "verify_publisher_authority",
  "manual_operator_review",
  "manual_channel_confirmation",
  "manual_content_verification",
  "audit_evidence_capture",
] as const;

export const SOCIAL_PUBLICATION_EXECUTION_RUNBOOK_STATUSES = [
  "ready",
  "blocked",
] as const;

export const SOCIAL_PUBLICATION_EXECUTION_RUNBOOK_BLOCKED_REASONS = [
  "runbook_id_required",
  "execution_job_id_required",
  "execution_intent_id_required",
  "timestamp_invalid",
  "step_id_required",
  "step_kind_unknown",
  "step_order_invalid",
  "step_order_duplicate",
  "checklist_item_id_required",
  "checklist_item_label_required",
  "manual_confirmation_id_required",
  "manual_confirmation_label_required",
  "prerequisite_label_required",
  "rollback_note_required",
  "audit_expectation_required",
  "forbidden_automation_flag",
  "forbidden_execution_permission",
  "forbidden_network_flag",
  "serialization_invalid",
  "unsafe_runbook_contract",
] as const;

export type SocialPublicationExecutionRunbookStepKind =
  (typeof SOCIAL_PUBLICATION_EXECUTION_RUNBOOK_STEP_KINDS)[number];

export type SocialPublicationExecutionRunbookStatus =
  (typeof SOCIAL_PUBLICATION_EXECUTION_RUNBOOK_STATUSES)[number];

export type SocialPublicationExecutionRunbookBlockedReason =
  (typeof SOCIAL_PUBLICATION_EXECUTION_RUNBOOK_BLOCKED_REASONS)[number];

export type SocialPublicationExecutionRunbookDiagnostic = Readonly<{
  code: SocialPublicationExecutionRunbookBlockedReason;
  path: string;
  message: string;
  severity: "block" | "error";
}>;

export type SocialPublicationExecutionRunbookStep = Readonly<{
  stepId: string;
  order: number;
  kind: SocialPublicationExecutionRunbookStepKind;
  label: string;
  description: string;
  required: boolean;
  satisfied: boolean;
  blocksRunbook: boolean;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPublicationExecutionRunbookChecklistItem = Readonly<{
  itemId: string;
  label: string;
  category: "authority" | "preflight" | "adapter" | "manual" | "audit";
  required: boolean;
  satisfied: boolean;
  computedOnly: true;
  readOnly: true;
}>;

export type SocialPublicationExecutionRunbookManualConfirmation = Readonly<{
  confirmationId: string;
  label: string;
  description: string;
  requiredBeforeExecution: true;
  operatorMustConfirm: true;
  automatedConfirmationForbidden: true;
  computedOnly: true;
  readOnly: true;
  grantsExecutionPermission: false;
}>;

export type SocialPublicationExecutionRunbookAdapterPrerequisite = Readonly<{
  prerequisiteId: string;
  label: string;
  present: boolean;
  required: true;
  computedOnly: true;
  readOnly: true;
}>;

export type SocialPublicationExecutionRunbookPreflightPrerequisite = Readonly<{
  prerequisiteId: string;
  label: string;
  present: boolean;
  required: true;
  computedOnly: true;
  readOnly: true;
}>;

export type SocialPublicationExecutionRunbookRollbackNote = Readonly<{
  noteId: string;
  label: string;
  guidance: string;
  referenceOnly: true;
  executesNothing: true;
  mutatesNothing: true;
}>;

export type SocialPublicationExecutionRunbookAuditExpectation = Readonly<{
  expectationId: string;
  label: string;
  description: string;
  required: true;
  referenceOnly: true;
  computedOnly: true;
  readOnly: true;
}>;

export type SocialPublicationExecutionRunbook = Readonly<{
  runbookId: string;
  executionJobId: string;
  executionIntentId: string;
  executionResultId: string | null;
  status: SocialPublicationExecutionRunbookStatus;
  createdAt: string;
  steps: readonly SocialPublicationExecutionRunbookStep[];
  operatorChecklist: readonly SocialPublicationExecutionRunbookChecklistItem[];
  manualConfirmations: readonly SocialPublicationExecutionRunbookManualConfirmation[];
  adapterPrerequisites: readonly SocialPublicationExecutionRunbookAdapterPrerequisite[];
  preflightPrerequisites: readonly SocialPublicationExecutionRunbookPreflightPrerequisite[];
  rollbackNotes: readonly SocialPublicationExecutionRunbookRollbackNote[];
  auditExpectations: readonly SocialPublicationExecutionRunbookAuditExpectation[];
  blockedReasons: readonly string[];
  diagnostics: readonly SocialPublicationExecutionRunbookDiagnostic[];
  humanVerificationRequired: true;
  automationForbidden: true;
  contractOnly: true;
  modelAuthorityOnly: true;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  mutatesNothing: true;
  callsNoExternalApis: true;
  usesNoNetwork: true;
  usesNoOAuth: true;
  usesNoCredentials: true;
  startsNoWorkers: true;
  createsNoQueues: true;
}>;

export type SocialPublicationExecutionRunbookInput = Readonly<{
  runbookId: string;
  executionJobId: string;
  executionIntentId: string;
  executionResultId?: string | null;
  createdAt: string;
  steps: readonly SocialPublicationExecutionRunbookStep[];
  operatorChecklist: readonly SocialPublicationExecutionRunbookChecklistItem[];
  manualConfirmations: readonly SocialPublicationExecutionRunbookManualConfirmation[];
  adapterPrerequisites: readonly SocialPublicationExecutionRunbookAdapterPrerequisite[];
  preflightPrerequisites: readonly SocialPublicationExecutionRunbookPreflightPrerequisite[];
  rollbackNotes: readonly SocialPublicationExecutionRunbookRollbackNote[];
  auditExpectations: readonly SocialPublicationExecutionRunbookAuditExpectation[];
}>;

const STEP_KIND_SET = new Set<string>(SOCIAL_PUBLICATION_EXECUTION_RUNBOOK_STEP_KINDS);

export function isSocialPublicationExecutionRunbookStepKind(
  value: unknown,
): value is SocialPublicationExecutionRunbookStepKind {
  return typeof value === "string" && STEP_KIND_SET.has(value);
}

export function buildSocialPublicationExecutionRunbook(
  input: SocialPublicationExecutionRunbookInput,
): SocialPublicationExecutionRunbook {
  const validation = validateSocialPublicationExecutionRunbookInput(input);
  const forbidden = detectForbiddenRunbookState(input);
  const diagnostics = [...validation.diagnostics, ...forbidden.diagnostics];
  const blockedReasons = collectBlockedReasons(input, validation, forbidden);

  const status: SocialPublicationExecutionRunbookStatus =
    diagnostics.length === 0 && blockedReasons.length === 0 ? "ready" : "blocked";

  return deepFreeze({
    runbookId: input.runbookId,
    executionJobId: input.executionJobId,
    executionIntentId: input.executionIntentId,
    executionResultId: input.executionResultId ?? null,
    status,
    createdAt: input.createdAt,
    steps: input.steps,
    operatorChecklist: input.operatorChecklist,
    manualConfirmations: input.manualConfirmations,
    adapterPrerequisites: input.adapterPrerequisites,
    preflightPrerequisites: input.preflightPrerequisites,
    rollbackNotes: input.rollbackNotes,
    auditExpectations: input.auditExpectations,
    blockedReasons,
    diagnostics,
    humanVerificationRequired: true,
    automationForbidden: true,
    contractOnly: true,
    modelAuthorityOnly: true,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    mutatesNothing: true,
    callsNoExternalApis: true,
    usesNoNetwork: true,
    usesNoOAuth: true,
    usesNoCredentials: true,
    startsNoWorkers: true,
    createsNoQueues: true,
  });
}

export function validateSocialPublicationExecutionRunbook(
  runbook: unknown,
): Readonly<{
  valid: boolean;
  diagnostics: readonly SocialPublicationExecutionRunbookDiagnostic[];
}> {
  if (!isRecord(runbook)) {
    return {
      valid: false,
      diagnostics: [
        blockDiagnostic(
          "serialization_invalid",
          "runbook",
          "Execution runbook must be an object.",
          "error",
        ),
      ],
    };
  }

  const diagnostics: SocialPublicationExecutionRunbookDiagnostic[] = [];
  requireText(runbook.runbookId, "runbook.runbookId", "runbook_id_required", diagnostics);
  requireText(runbook.executionJobId, "runbook.executionJobId", "execution_job_id_required", diagnostics);
  requireText(runbook.executionIntentId, "runbook.executionIntentId", "execution_intent_id_required", diagnostics);
  if (!isValidTimestamp(runbook.createdAt)) {
    diagnostics.push(blockDiagnostic(
      "timestamp_invalid",
      "runbook.createdAt",
      "Execution runbook requires a valid createdAt timestamp.",
      "error",
    ));
  }

  validateSteps(runbook.steps, "runbook.steps", diagnostics);
  validateChecklist(runbook.operatorChecklist, "runbook.operatorChecklist", diagnostics);
  validateManualConfirmations(runbook.manualConfirmations, "runbook.manualConfirmations", diagnostics);
  validateAdapterPrerequisites(runbook.adapterPrerequisites, "runbook.adapterPrerequisites", diagnostics);
  validatePreflightPrerequisites(runbook.preflightPrerequisites, "runbook.preflightPrerequisites", diagnostics);
  validateRollbackNotes(runbook.rollbackNotes, "runbook.rollbackNotes", diagnostics);
  validateAuditExpectations(runbook.auditExpectations, "runbook.auditExpectations", diagnostics);

  if (runbook.grantsExecutionPermission !== false) {
    diagnostics.push(blockDiagnostic(
      "forbidden_execution_permission",
      "runbook.grantsExecutionPermission",
      "Execution runbook must not grant execution permission.",
      "block",
    ));
  }
  if (runbook.automationForbidden !== true) {
    diagnostics.push(blockDiagnostic(
      "forbidden_automation_flag",
      "runbook.automationForbidden",
      "Execution runbook must forbid automation.",
      "block",
    ));
  }
  if (
    runbook.executesNothing !== true ||
    runbook.publishesNothing !== true ||
    runbook.usesNoNetwork !== true ||
    runbook.usesNoOAuth !== true ||
    runbook.usesNoCredentials !== true
  ) {
    diagnostics.push(blockDiagnostic(
      "unsafe_runbook_contract",
      "runbook",
      "Execution runbook contract invariants failed.",
      "block",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function detectForbiddenRunbookState(
  input: SocialPublicationExecutionRunbookInput | SocialPublicationExecutionRunbook,
): Readonly<{
  forbidden: boolean;
  diagnostics: readonly SocialPublicationExecutionRunbookDiagnostic[];
}> {
  const diagnostics: SocialPublicationExecutionRunbookDiagnostic[] = [];
  const candidate = input as Readonly<Record<string, unknown>>;

  if (candidate.grantsExecutionPermission === true) {
    diagnostics.push(blockDiagnostic(
      "forbidden_execution_permission",
      "runbook.grantsExecutionPermission",
      "Execution runbook must not grant execution permission.",
      "block",
    ));
  }
  if (candidate.automationForbidden === false) {
    diagnostics.push(blockDiagnostic(
      "forbidden_automation_flag",
      "runbook.automationForbidden",
      "Execution runbook must forbid automation.",
      "block",
    ));
  }
  if (candidate.usesNoNetwork === false || candidate.callsNoExternalApis === false) {
    diagnostics.push(blockDiagnostic(
      "forbidden_network_flag",
      "runbook",
      "Execution runbook must forbid network and external API usage.",
      "block",
    ));
  }

  for (const confirmation of input.manualConfirmations) {
    if (confirmation.automatedConfirmationForbidden !== true) {
      diagnostics.push(blockDiagnostic(
        "forbidden_automation_flag",
        `runbook.manualConfirmations.${confirmation.confirmationId}`,
        "Manual confirmations must forbid automated confirmation.",
        "block",
      ));
    }
  }

  return {
    forbidden: diagnostics.length > 0,
    diagnostics,
  };
}

export function serializeSocialPublicationExecutionRunbook(
  runbook: SocialPublicationExecutionRunbook,
): string {
  return JSON.stringify(toStableValue(runbook));
}

export function hydrateSocialPublicationExecutionRunbook(
  serialized: string,
): Readonly<{
  ok: true;
  value: SocialPublicationExecutionRunbook;
}> | Readonly<{
  ok: false;
  diagnostics: readonly SocialPublicationExecutionRunbookDiagnostic[];
}> {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const validation = validateSocialPublicationExecutionRunbook(parsed);
    if (!validation.valid || !isRecord(parsed)) {
      return { ok: false, diagnostics: validation.diagnostics };
    }
    return { ok: true, value: deepFreeze(parsed as SocialPublicationExecutionRunbook) };
  } catch {
    return {
      ok: false,
      diagnostics: [
        blockDiagnostic(
          "serialization_invalid",
          "serialized",
          "Execution runbook serialization must be valid JSON.",
          "error",
        ),
      ],
    };
  }
}

function validateSocialPublicationExecutionRunbookInput(
  input: SocialPublicationExecutionRunbookInput,
): Readonly<{
  diagnostics: readonly SocialPublicationExecutionRunbookDiagnostic[];
}> {
  const diagnostics: SocialPublicationExecutionRunbookDiagnostic[] = [];
  requireText(input.runbookId, "input.runbookId", "runbook_id_required", diagnostics);
  requireText(input.executionJobId, "input.executionJobId", "execution_job_id_required", diagnostics);
  requireText(input.executionIntentId, "input.executionIntentId", "execution_intent_id_required", diagnostics);
  if (!isValidTimestamp(input.createdAt)) {
    diagnostics.push(blockDiagnostic(
      "timestamp_invalid",
      "input.createdAt",
      "Execution runbook requires a valid createdAt timestamp.",
      "error",
    ));
  }
  validateSteps(input.steps, "input.steps", diagnostics);
  validateChecklist(input.operatorChecklist, "input.operatorChecklist", diagnostics);
  validateManualConfirmations(input.manualConfirmations, "input.manualConfirmations", diagnostics);
  validateAdapterPrerequisites(input.adapterPrerequisites, "input.adapterPrerequisites", diagnostics);
  validatePreflightPrerequisites(input.preflightPrerequisites, "input.preflightPrerequisites", diagnostics);
  validateRollbackNotes(input.rollbackNotes, "input.rollbackNotes", diagnostics);
  validateAuditExpectations(input.auditExpectations, "input.auditExpectations", diagnostics);
  return { diagnostics };
}

function collectBlockedReasons(
  input: SocialPublicationExecutionRunbookInput,
  validation: Readonly<{ diagnostics: readonly SocialPublicationExecutionRunbookDiagnostic[] }>,
  forbidden: Readonly<{ diagnostics: readonly SocialPublicationExecutionRunbookDiagnostic[] }>,
): readonly string[] {
  const reasons = new Set<string>();
  for (const diagnostic of [...validation.diagnostics, ...forbidden.diagnostics]) {
    reasons.add(diagnostic.code);
  }

  for (const step of input.steps) {
    if (step.required && !step.satisfied && step.blocksRunbook) {
      reasons.add(`step_unsatisfied:${step.kind}`);
    }
  }
  for (const item of input.operatorChecklist) {
    if (
      item.required &&
      !item.satisfied &&
      item.category !== "manual" &&
      item.category !== "audit"
    ) {
      reasons.add(`checklist_incomplete:${item.itemId}`);
    }
  }
  for (const prerequisite of input.adapterPrerequisites) {
    if (prerequisite.required && !prerequisite.present) {
      reasons.add(`adapter_prerequisite_missing:${prerequisite.prerequisiteId}`);
    }
  }
  for (const prerequisite of input.preflightPrerequisites) {
    if (prerequisite.required && !prerequisite.present) {
      reasons.add(`preflight_prerequisite_missing:${prerequisite.prerequisiteId}`);
    }
  }

  return [...reasons];
}

function validateSteps(
  steps: unknown,
  path: string,
  diagnostics: SocialPublicationExecutionRunbookDiagnostic[],
): void {
  if (!Array.isArray(steps)) {
    diagnostics.push(blockDiagnostic("serialization_invalid", path, "Runbook steps must be an array.", "error"));
    return;
  }

  const orders = new Set<number>();
  steps.forEach((step, index) => {
    const stepPath = `${path}.${index}`;
    if (!isRecord(step)) {
      diagnostics.push(blockDiagnostic("serialization_invalid", stepPath, "Runbook step must be an object.", "error"));
      return;
    }
    requireText(step.stepId, `${stepPath}.stepId`, "step_id_required", diagnostics);
    if (typeof step.order !== "number" || !Number.isInteger(step.order) || step.order < 1) {
      diagnostics.push(blockDiagnostic("step_order_invalid", `${stepPath}.order`, "Runbook step order must be a positive integer.", "error"));
    } else if (orders.has(step.order)) {
      diagnostics.push(blockDiagnostic("step_order_duplicate", `${stepPath}.order`, "Runbook step order must be unique.", "error"));
    } else {
      orders.add(step.order);
    }
    if (!isSocialPublicationExecutionRunbookStepKind(step.kind)) {
      diagnostics.push(blockDiagnostic("step_kind_unknown", `${stepPath}.kind`, "Runbook step kind is not supported.", "error"));
    }
    if (step.grantsExecutionPermission !== false) {
      diagnostics.push(blockDiagnostic("forbidden_execution_permission", stepPath, "Runbook step must not grant execution permission.", "block"));
    }
  });
}

function validateChecklist(
  checklist: unknown,
  path: string,
  diagnostics: SocialPublicationExecutionRunbookDiagnostic[],
): void {
  if (!Array.isArray(checklist)) {
    diagnostics.push(blockDiagnostic("serialization_invalid", path, "Operator checklist must be an array.", "error"));
    return;
  }
  checklist.forEach((item, index) => {
    const itemPath = `${path}.${index}`;
    if (!isRecord(item)) {
      diagnostics.push(blockDiagnostic("serialization_invalid", itemPath, "Checklist item must be an object.", "error"));
      return;
    }
    requireText(item.itemId, `${itemPath}.itemId`, "checklist_item_id_required", diagnostics);
    requireText(item.label, `${itemPath}.label`, "checklist_item_label_required", diagnostics);
  });
}

function validateManualConfirmations(
  confirmations: unknown,
  path: string,
  diagnostics: SocialPublicationExecutionRunbookDiagnostic[],
): void {
  if (!Array.isArray(confirmations)) {
    diagnostics.push(blockDiagnostic("serialization_invalid", path, "Manual confirmations must be an array.", "error"));
    return;
  }
  confirmations.forEach((confirmation, index) => {
    const confirmationPath = `${path}.${index}`;
    if (!isRecord(confirmation)) {
      diagnostics.push(blockDiagnostic("serialization_invalid", confirmationPath, "Manual confirmation must be an object.", "error"));
      return;
    }
    requireText(confirmation.confirmationId, `${confirmationPath}.confirmationId`, "manual_confirmation_id_required", diagnostics);
    requireText(confirmation.label, `${confirmationPath}.label`, "manual_confirmation_label_required", diagnostics);
    if (confirmation.requiredBeforeExecution !== true || confirmation.operatorMustConfirm !== true) {
      diagnostics.push(blockDiagnostic("forbidden_automation_flag", confirmationPath, "Manual confirmation must require operator confirmation.", "block"));
    }
  });
}

function validateAdapterPrerequisites(
  prerequisites: unknown,
  path: string,
  diagnostics: SocialPublicationExecutionRunbookDiagnostic[],
): void {
  if (!Array.isArray(prerequisites)) {
    diagnostics.push(blockDiagnostic("serialization_invalid", path, "Adapter prerequisites must be an array.", "error"));
    return;
  }
  prerequisites.forEach((prerequisite, index) => {
    const prerequisitePath = `${path}.${index}`;
    if (!isRecord(prerequisite)) {
      diagnostics.push(blockDiagnostic("serialization_invalid", prerequisitePath, "Adapter prerequisite must be an object.", "error"));
      return;
    }
    requireText(prerequisite.prerequisiteId, `${prerequisitePath}.prerequisiteId`, "prerequisite_label_required", diagnostics);
    requireText(prerequisite.label, `${prerequisitePath}.label`, "prerequisite_label_required", diagnostics);
  });
}

function validatePreflightPrerequisites(
  prerequisites: unknown,
  path: string,
  diagnostics: SocialPublicationExecutionRunbookDiagnostic[],
): void {
  if (!Array.isArray(prerequisites)) {
    diagnostics.push(blockDiagnostic("serialization_invalid", path, "Preflight prerequisites must be an array.", "error"));
    return;
  }
  prerequisites.forEach((prerequisite, index) => {
    const prerequisitePath = `${path}.${index}`;
    if (!isRecord(prerequisite)) {
      diagnostics.push(blockDiagnostic("serialization_invalid", prerequisitePath, "Preflight prerequisite must be an object.", "error"));
      return;
    }
    requireText(prerequisite.prerequisiteId, `${prerequisitePath}.prerequisiteId`, "prerequisite_label_required", diagnostics);
    requireText(prerequisite.label, `${prerequisitePath}.label`, "prerequisite_label_required", diagnostics);
  });
}

function validateRollbackNotes(
  notes: unknown,
  path: string,
  diagnostics: SocialPublicationExecutionRunbookDiagnostic[],
): void {
  if (!Array.isArray(notes)) {
    diagnostics.push(blockDiagnostic("serialization_invalid", path, "Rollback notes must be an array.", "error"));
    return;
  }
  notes.forEach((note, index) => {
    const notePath = `${path}.${index}`;
    if (!isRecord(note)) {
      diagnostics.push(blockDiagnostic("serialization_invalid", notePath, "Rollback note must be an object.", "error"));
      return;
    }
    requireText(note.noteId, `${notePath}.noteId`, "rollback_note_required", diagnostics);
    requireText(note.label, `${notePath}.label`, "rollback_note_required", diagnostics);
    requireText(note.guidance, `${notePath}.guidance`, "rollback_note_required", diagnostics);
  });
}

function validateAuditExpectations(
  expectations: unknown,
  path: string,
  diagnostics: SocialPublicationExecutionRunbookDiagnostic[],
): void {
  if (!Array.isArray(expectations)) {
    diagnostics.push(blockDiagnostic("serialization_invalid", path, "Audit expectations must be an array.", "error"));
    return;
  }
  expectations.forEach((expectation, index) => {
    const expectationPath = `${path}.${index}`;
    if (!isRecord(expectation)) {
      diagnostics.push(blockDiagnostic("serialization_invalid", expectationPath, "Audit expectation must be an object.", "error"));
      return;
    }
    requireText(expectation.expectationId, `${expectationPath}.expectationId`, "audit_expectation_required", diagnostics);
    requireText(expectation.label, `${expectationPath}.label`, "audit_expectation_required", diagnostics);
    requireText(expectation.description, `${expectationPath}.description`, "audit_expectation_required", diagnostics);
  });
}

function requireText(
  value: unknown,
  path: string,
  code: SocialPublicationExecutionRunbookBlockedReason,
  diagnostics: SocialPublicationExecutionRunbookDiagnostic[],
): void {
  if (hasText(value)) return;
  diagnostics.push(blockDiagnostic(code, path, "Required runbook text field is missing.", "error"));
}

function blockDiagnostic(
  code: SocialPublicationExecutionRunbookBlockedReason,
  path: string,
  message: string,
  severity: "block" | "error",
): SocialPublicationExecutionRunbookDiagnostic {
  return { code, path, message, severity };
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidTimestamp(value: unknown): value is string {
  return hasText(value) && Number.isFinite(Date.parse(value));
}

type UnknownRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toStableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toStableValue);
  if (!isRecord(value)) return value;
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((output, key) => {
      output[key] = toStableValue(value[key]);
      return output;
    }, {});
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return Object.freeze(value);
}
