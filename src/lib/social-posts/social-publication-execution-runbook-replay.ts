import {
  buildSocialPublicationExecutionRunbook,
  type SocialPublicationExecutionRunbook,
  type SocialPublicationExecutionRunbookAdapterPrerequisite,
  type SocialPublicationExecutionRunbookAuditExpectation,
  type SocialPublicationExecutionRunbookChecklistItem,
  type SocialPublicationExecutionRunbookManualConfirmation,
  type SocialPublicationExecutionRunbookPreflightPrerequisite,
  type SocialPublicationExecutionRunbookRollbackNote,
  type SocialPublicationExecutionRunbookStep,
  type SocialPublicationExecutionRunbookStepKind,
} from "./social-publication-execution-runbook";
import {
  replaySocialPublicationExecutionAdapters,
  type SocialPublicationExecutionAdapterChannelHint,
  type SocialPublicationExecutionAdapterJobProjection,
} from "./social-publication-execution-adapter-replay";
import { replaySocialPublicationExecutionPreflight } from "./social-publication-execution-preflight-replay";
import type { SocialPublicationExecutionPreflightJobProjection } from "./social-publication-execution-preflight-replay";
import type { SocialPublicationExecutionPlanStep } from "./social-publication-execution-planner";
import { replaySocialPublicationExecutionPlanner } from "./social-publication-execution-planner-replay";
import type { SocialPublicationExecutionPersistenceModel } from "./social-publication-execution-repository";

export const SOCIAL_PUBLICATION_EXECUTION_RUNBOOK_REPLAY_DIAGNOSTIC_CODES = [
  "preflight_replay_error",
  "planner_replay_error",
  "adapter_replay_error",
  "runbook_validation_error",
] as const;

export type SocialPublicationExecutionRunbookReplayDiagnosticCode =
  (typeof SOCIAL_PUBLICATION_EXECUTION_RUNBOOK_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPublicationExecutionRunbookReplayDiagnostic = Readonly<{
  code: SocialPublicationExecutionRunbookReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPublicationExecutionRunbookJobProjection = Readonly<{
  executionJobId: string;
  executionIntentId: string;
  executionResultId: string | null;
  runbookStatus: SocialPublicationExecutionRunbook["status"];
  runbook: SocialPublicationExecutionRunbook;
  missingChecklistItems: readonly string[];
  missingAdapterPrerequisites: readonly string[];
  missingAuthorityEvidence: readonly string[];
  manualConfirmationRequirements: readonly SocialPublicationExecutionRunbookManualConfirmation[];
  blockedReasons: readonly string[];
  humanVerificationRequired: true;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPublicationExecutionRunbookReadModel = Readonly<{
  readyRunbooks: readonly SocialPublicationExecutionRunbookJobProjection[];
  blockedRunbooks: readonly SocialPublicationExecutionRunbookJobProjection[];
  missingChecklistRunbooks: readonly SocialPublicationExecutionRunbookJobProjection[];
  missingAdapterPrerequisiteRunbooks: readonly SocialPublicationExecutionRunbookJobProjection[];
  missingAuthorityRunbooks: readonly SocialPublicationExecutionRunbookJobProjection[];
  manualConfirmationRunbooks: readonly SocialPublicationExecutionRunbookJobProjection[];
  diagnostics: readonly SocialPublicationExecutionRunbookReplayDiagnostic[];
  summary: Readonly<{
    totalRunbookCount: number;
    readyRunbookCount: number;
    blockedRunbookCount: number;
    missingChecklistRunbookCount: number;
    missingAdapterPrerequisiteRunbookCount: number;
    missingAuthorityRunbookCount: number;
    manualConfirmationRunbookCount: number;
    diagnosticCount: number;
    errorCount: number;
    computedOnly: true;
    readOnly: true;
    authoritative: false;
    grantsExecutionPermission: false;
    executesNothing: true;
    publishesNothing: true;
  }>;
  replayIntegrity: Readonly<{
    valid: boolean;
    deterministic: true;
    source: "publication_execution_runbook_replay";
    computedOnly: true;
    authoritative: false;
  }>;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPublicationExecutionRunbookReplayResult = Readonly<{
  ok: true;
  value: SocialPublicationExecutionRunbookReadModel;
}>;

export function replaySocialPublicationExecutionRunbooks(
  model: SocialPublicationExecutionPersistenceModel,
  input: Readonly<{
    channelHints?: readonly SocialPublicationExecutionAdapterChannelHint[];
    now?: string;
  }> = {},
): SocialPublicationExecutionRunbookReplayResult {
  const diagnostics: SocialPublicationExecutionRunbookReplayDiagnostic[] = [];
  const now = input.now ?? "2026-07-01T00:00:00.000Z";

  const preflightReplay = replaySocialPublicationExecutionPreflight(model).value;
  for (const diagnostic of preflightReplay.diagnostics) {
    diagnostics.push({
      code: "preflight_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: diagnostic.severity,
    });
  }

  const plannerReplay = replaySocialPublicationExecutionPlanner(model, now).value;
  for (const diagnostic of plannerReplay.diagnostics) {
    diagnostics.push({
      code: "planner_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: diagnostic.severity,
    });
  }

  const adapterReplay = replaySocialPublicationExecutionAdapters(model, {
    channelHints: input.channelHints,
  }).value;
  for (const diagnostic of adapterReplay.diagnostics) {
    diagnostics.push({
      code: "adapter_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: diagnostic.severity,
    });
  }

  const preflightByIntent = new Map(
    [
      ...preflightReplay.preflightPassJobs,
      ...preflightReplay.preflightBlockedJobs,
    ].map((job) => [job.executionIntentId, job]),
  );
  const adapterByJob = new Map(
    [
      ...adapterReplay.adapterReadyJobs,
      ...adapterReplay.adapterBlockedJobs,
      ...adapterReplay.dryRunCapableJobs,
      ...adapterReplay.unsupportedChannelJobs,
    ].map((job) => [job.executionJobId, job]),
  );
  const plannerByJob = new Map(
    plannerReplay.executionOrder.map((step) => [step.executionJobId, step]),
  );

  const projections = model.intents.map((intent, index) => {
    const preflightJob = preflightByIntent.get(intent.execution_intent_id);
    const adapterJob = adapterByJob.get(intent.execution_job_id);
    const plannerStep = plannerByJob.get(intent.execution_job_id);
    const runbook = buildRunbookForJob(
      intent.execution_job_id,
      intent.execution_intent_id,
      preflightJob,
      plannerStep,
      adapterJob,
      now,
      index,
    );

    if (runbook.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      diagnostics.push({
        code: "runbook_validation_error",
        path: `intents.${index}`,
        message: "Execution runbook validation failed for job projection.",
        severity: "error",
      });
    }

    return projectRunbookJob(runbook, preflightJob, adapterJob);
  });

  const readyRunbooks = projections.filter((job) => job.runbookStatus === "ready");
  const blockedRunbooks = projections.filter((job) => job.runbookStatus === "blocked");
  const missingChecklistRunbooks = projections.filter(
    (job) => job.missingChecklistItems.length > 0,
  );
  const missingAdapterPrerequisiteRunbooks = projections.filter(
    (job) => job.missingAdapterPrerequisites.length > 0,
  );
  const missingAuthorityRunbooks = projections.filter(
    (job) => job.missingAuthorityEvidence.length > 0,
  );
  const manualConfirmationRunbooks = projections.filter(
    (job) => job.manualConfirmationRequirements.length > 0,
  );
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;

  return {
    ok: true,
    value: deepFreeze({
      readyRunbooks,
      blockedRunbooks,
      missingChecklistRunbooks,
      missingAdapterPrerequisiteRunbooks,
      missingAuthorityRunbooks,
      manualConfirmationRunbooks,
      diagnostics,
      summary: {
        totalRunbookCount: projections.length,
        readyRunbookCount: readyRunbooks.length,
        blockedRunbookCount: blockedRunbooks.length,
        missingChecklistRunbookCount: missingChecklistRunbooks.length,
        missingAdapterPrerequisiteRunbookCount: missingAdapterPrerequisiteRunbooks.length,
        missingAuthorityRunbookCount: missingAuthorityRunbooks.length,
        manualConfirmationRunbookCount: manualConfirmationRunbooks.length,
        diagnosticCount: diagnostics.length,
        errorCount,
        computedOnly: true,
        readOnly: true,
        authoritative: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
      replayIntegrity: {
        valid: errorCount === 0,
        deterministic: true,
        source: "publication_execution_runbook_replay",
        computedOnly: true,
        authoritative: false,
      },
      computedOnly: true,
      readOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    }),
  };
}

function buildRunbookForJob(
  executionJobId: string,
  executionIntentId: string,
  preflightJob: SocialPublicationExecutionPreflightJobProjection | undefined,
  plannerStep: SocialPublicationExecutionPlanStep | undefined,
  adapterJob: SocialPublicationExecutionAdapterJobProjection | undefined,
  createdAt: string,
  index: number,
): SocialPublicationExecutionRunbook {
  const preflightPassed = preflightJob?.preflightStatus === "pass";
  const plannerReady = plannerStep?.status === "ready";
  const adapterAvailable = adapterJob?.adapterAvailable ?? false;
  const dryRunCapable = adapterJob?.dryRunCapable ?? false;
  const ownerAuthorityPresent = preflightJob?.authorityPresent.owner ?? false;
  const publisherAuthorityPresent = preflightJob?.authorityPresent.publisher ?? false;

  const steps = buildRunbookSteps(
    preflightPassed,
    plannerReady,
    adapterAvailable,
    dryRunCapable,
    ownerAuthorityPresent,
    publisherAuthorityPresent,
  );
  const operatorChecklist = buildOperatorChecklist(
    preflightPassed,
    plannerReady,
    adapterAvailable,
    dryRunCapable,
    ownerAuthorityPresent,
    publisherAuthorityPresent,
  );
  const manualConfirmations = buildManualConfirmations();
  const adapterPrerequisites = buildAdapterPrerequisites(adapterJob);
  const preflightPrerequisites = buildPreflightPrerequisites(preflightJob);
  const rollbackNotes = buildRollbackNotes(executionJobId);
  const auditExpectations = buildAuditExpectations();

  return buildSocialPublicationExecutionRunbook({
    runbookId: `runbook-${executionJobId}`,
    executionJobId,
    executionIntentId,
    executionResultId: preflightJob?.executionResultId ?? null,
    createdAt,
    steps,
    operatorChecklist,
    manualConfirmations,
    adapterPrerequisites,
    preflightPrerequisites,
    rollbackNotes,
    auditExpectations: auditExpectations.map((expectation, expectationIndex) => ({
      ...expectation,
      expectationId: `${expectation.expectationId}-${index}-${expectationIndex}`,
    })),
  });
}

function buildRunbookSteps(
  preflightPassed: boolean,
  plannerReady: boolean,
  adapterAvailable: boolean,
  dryRunCapable: boolean,
  ownerAuthorityPresent: boolean,
  publisherAuthorityPresent: boolean,
): readonly SocialPublicationExecutionRunbookStep[] {
  const stepSpecs: readonly [SocialPublicationExecutionRunbookStepKind, string, string, boolean][] = [
    ["verify_preflight_pass", "Verify preflight pass", "Confirm preflight diagnostics pass for this job.", preflightPassed],
    ["verify_planner_ready", "Verify planner ready", "Confirm planner marks this job as ready.", plannerReady],
    ["verify_adapter_available", "Verify adapter available", "Confirm a reference adapter contract exists for the channel.", adapterAvailable],
    ["verify_dry_run_capable", "Verify dry-run capable", "Confirm the adapter supports dry-run simulation only.", dryRunCapable],
    ["verify_owner_authority", "Verify owner authority", "Confirm owner approval authority evidence is present.", ownerAuthorityPresent],
    ["verify_publisher_authority", "Verify publisher authority", "Confirm publisher authority evidence is present.", publisherAuthorityPresent],
    ["manual_operator_review", "Manual operator review", "Human operator must review readiness before any future execution.", false],
    ["manual_channel_confirmation", "Manual channel confirmation", "Human operator must confirm the publication target channel.", false],
    ["manual_content_verification", "Manual content verification", "Human operator must verify post content matches approved manifest.", false],
    ["audit_evidence_capture", "Audit evidence capture", "Confirm audit evidence expectations are understood.", true],
  ];

  return stepSpecs.map(([kind, label, description, satisfied], index) => ({
    stepId: `step-${kind}`,
    order: index + 1,
    kind,
    label,
    description,
    required: true,
    satisfied,
    blocksRunbook: kind.startsWith("verify_") && !satisfied,
    computedOnly: true as const,
    readOnly: true as const,
    authoritative: false as const,
    grantsExecutionPermission: false as const,
    executesNothing: true as const,
    publishesNothing: true as const,
  }));
}

function buildOperatorChecklist(
  preflightPassed: boolean,
  plannerReady: boolean,
  adapterAvailable: boolean,
  dryRunCapable: boolean,
  ownerAuthorityPresent: boolean,
  publisherAuthorityPresent: boolean,
): readonly SocialPublicationExecutionRunbookChecklistItem[] {
  return [
    checklistItem("preflight-pass", "Preflight pass confirmed", "preflight", preflightPassed),
    checklistItem("planner-ready", "Planner ready confirmed", "preflight", plannerReady),
    checklistItem("adapter-available", "Adapter contract available", "adapter", adapterAvailable),
    checklistItem("dry-run-capable", "Dry-run capability confirmed", "adapter", dryRunCapable),
    checklistItem("owner-authority", "Owner approval authority present", "authority", ownerAuthorityPresent),
    checklistItem("publisher-authority", "Publisher authority present", "authority", publisherAuthorityPresent),
    checklistItem("manual-review", "Operator reviewed runbook", "manual", false),
    checklistItem("rollback-understood", "Rollback guidance understood", "audit", false),
  ];
}

function buildManualConfirmations(): readonly SocialPublicationExecutionRunbookManualConfirmation[] {
  return [
    {
      confirmationId: "operator-readiness-review",
      label: "Operator readiness review",
      description: "A human operator must review all runbook steps and checklist items before any future execution attempt.",
      requiredBeforeExecution: true,
      operatorMustConfirm: true,
      automatedConfirmationForbidden: true,
      computedOnly: true,
      readOnly: true,
      grantsExecutionPermission: false,
    },
    {
      confirmationId: "no-automation-approval",
      label: "No automation approval",
      description: "Confirm that this runbook does not approve, trigger, or automate execution.",
      requiredBeforeExecution: true,
      operatorMustConfirm: true,
      automatedConfirmationForbidden: true,
      computedOnly: true,
      readOnly: true,
      grantsExecutionPermission: false,
    },
  ];
}

function buildAdapterPrerequisites(
  adapterJob: SocialPublicationExecutionAdapterJobProjection | undefined,
): readonly SocialPublicationExecutionRunbookAdapterPrerequisite[] {
  const specs: readonly [string, string, boolean][] = [
    ["adapter-contract", "Reference adapter contract available", adapterJob?.adapterAvailable ?? false],
    ["dry-run-support", "Dry-run support enabled", adapterJob?.dryRunCapable ?? false],
    ["channel-resolved", "Publication channel resolved", Boolean(adapterJob && !adapterJob.blockingReasons.includes("channel_unresolved"))],
    ["unsupported-channel-absent", "Channel type supported", !(adapterJob?.unsupportedChannel ?? false)],
    ["adapter-not-blocked", "Adapter diagnostics not blocked", !(adapterJob?.adapterBlocked ?? true)],
  ];

  return specs.map(([prerequisiteId, label, present]) => ({
    prerequisiteId,
    label,
    present,
    required: true as const,
    computedOnly: true as const,
    readOnly: true as const,
  }));
}

function buildPreflightPrerequisites(
  preflightJob: SocialPublicationExecutionPreflightJobProjection | undefined,
): readonly SocialPublicationExecutionRunbookPreflightPrerequisite[] {
  const missingReferences = preflightJob?.missingReferences ?? [
    "owner_approval",
    "publication_target",
    "ledger_evidence",
    "publisher_request",
    "scheduler_intent",
    "publication_manifest",
  ];
  const requiredReferences = [
    "owner_approval",
    "publication_target",
    "ledger_evidence",
    "publisher_request",
    "scheduler_intent",
    "publication_manifest",
  ] as const;

  return requiredReferences.map((reference) => ({
    prerequisiteId: `preflight-${reference}`,
    label: `Preflight reference present: ${reference}`,
    present: !missingReferences.includes(reference),
    required: true as const,
    computedOnly: true as const,
    readOnly: true as const,
  }));
}

function buildRollbackNotes(executionJobId: string): readonly SocialPublicationExecutionRunbookRollbackNote[] {
  return [
    {
      noteId: `rollback-${executionJobId}-no-execution`,
      label: "No execution occurred",
      guidance: "This runbook is simulated only. No platform action has occurred and no rollback is required because nothing executed.",
      referenceOnly: true,
      executesNothing: true,
      mutatesNothing: true,
    },
    {
      noteId: `rollback-${executionJobId}-future-guidance`,
      label: "Future rollback guidance",
      guidance: "If real execution is implemented later, rollback must remain manual, auditable, and operator-driven with no automatic retries.",
      referenceOnly: true,
      executesNothing: true,
      mutatesNothing: true,
    },
  ];
}

function buildAuditExpectations(): readonly SocialPublicationExecutionRunbookAuditExpectation[] {
  return [
    {
      expectationId: "audit-authority-chain",
      label: "Authority chain auditable",
      description: "Owner approval and publisher authority references must remain traceable before any future execution.",
      required: true,
      referenceOnly: true,
      computedOnly: true,
      readOnly: true,
    },
    {
      expectationId: "audit-preflight-evidence",
      label: "Preflight evidence auditable",
      description: "Preflight pass/block diagnostics and reference evidence must remain inspectable.",
      required: true,
      referenceOnly: true,
      computedOnly: true,
      readOnly: true,
    },
    {
      expectationId: "audit-adapter-contract",
      label: "Adapter contract auditable",
      description: "Adapter contract selection, dry-run capability, and blocking reasons must remain visible.",
      required: true,
      referenceOnly: true,
      computedOnly: true,
      readOnly: true,
    },
  ];
}

function projectRunbookJob(
  runbook: SocialPublicationExecutionRunbook,
  preflightJob: SocialPublicationExecutionPreflightJobProjection | undefined,
  adapterJob: SocialPublicationExecutionAdapterJobProjection | undefined,
): SocialPublicationExecutionRunbookJobProjection {
  const missingChecklistItems = runbook.operatorChecklist
    .filter((item) => !item.satisfied)
    .map((item) => item.itemId);
  const missingAdapterPrerequisites = runbook.adapterPrerequisites
    .filter((prerequisite) => prerequisite.required && !prerequisite.present)
    .map((prerequisite) => prerequisite.prerequisiteId);
  const missingAuthorityEvidence = [
    ...(preflightJob?.missingAuthority ?? []),
    ...(adapterJob?.preflightRequirementsMissing.filter((item) =>
      item.includes("authority") || item.includes("approval"),
    ) ?? []),
  ];

  return {
    executionJobId: runbook.executionJobId,
    executionIntentId: runbook.executionIntentId,
    executionResultId: runbook.executionResultId,
    runbookStatus: runbook.status,
    runbook,
    missingChecklistItems,
    missingAdapterPrerequisites,
    missingAuthorityEvidence: unique(missingAuthorityEvidence),
    manualConfirmationRequirements: runbook.manualConfirmations,
    blockedReasons: runbook.blockedReasons,
    humanVerificationRequired: true,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function checklistItem(
  itemId: string,
  label: string,
  category: SocialPublicationExecutionRunbookChecklistItem["category"],
  satisfied: boolean,
): SocialPublicationExecutionRunbookChecklistItem {
  return {
    itemId,
    label,
    category,
    required: true,
    satisfied,
    computedOnly: true,
    readOnly: true,
  };
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return Object.freeze(value);
}
