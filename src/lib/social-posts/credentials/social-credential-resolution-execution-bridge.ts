import {
  SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION,
  type SocialCredentialRuntimeOrchestrationPlan,
  type SocialCredentialRuntimeOrchestratorProviderJob,
} from "./social-credential-runtime-orchestrator";
import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  mapProviderAccountRecordToReference,
  mapVaultRecordRowToCredentialReference,
  validateSocialCredentialPersistenceModel,
  type SocialCredentialPersistenceModel,
  type SocialCredentialProviderAccountRecord,
} from "./social-credential-repository";
import {
  SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS,
  requiredCredentialKindsForProvider,
  type SocialPlatformCredentialKind,
  type SocialPlatformCredentialProvider,
} from "../social-platform-credential-boundary";

export const SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BRIDGE_VERSION =
  "d15-w2-res-bridge-v1" as const;

export const SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BRIDGE_MODES = [
  "environment",
  "reference",
  "production",
] as const;

export const SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_PLAN_STATUSES = [
  "planned",
  "waiting",
  "blocked",
] as const;

export const SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_STEP_KINDS = [
  "provider_reference_selection",
  "credential_reference_lookup",
  "lifecycle_reference_lookup",
  "orchestration_readiness_review",
  "capability_summary_review",
  "audit_append_compatibility_review",
] as const;

export const SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BLOCKED_REASONS = [
  "plan_id_required",
  "timestamp_invalid",
  "persistence_model_invalid",
  "provider_unknown",
  "provider_account_missing",
  "provider_account_disabled",
  "provider_account_ambiguous",
  "credential_reference_missing",
  "lifecycle_reference_missing",
  "orchestration_plan_missing",
  "orchestration_provider_job_missing",
  "orchestration_blocked",
  "capability_summary_blocked",
  "audit_append_incompatible",
  "forbidden_execution_permission",
  "forbidden_network_flag",
  "serialization_invalid",
  "unsafe_resolution_contract",
] as const;

export type SocialCredentialResolutionExecutionBridgeMode =
  (typeof SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BRIDGE_MODES)[number];

export type SocialCredentialResolutionExecutionPlanStatus =
  (typeof SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_PLAN_STATUSES)[number];

export type SocialCredentialResolutionExecutionStepKind =
  (typeof SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_STEP_KINDS)[number];

export type SocialCredentialResolutionExecutionBlockedReason =
  (typeof SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BLOCKED_REASONS)[number];

export type SocialCredentialResolutionExecutionDiagnostic = Readonly<{
  code: SocialCredentialResolutionExecutionBlockedReason;
  path: string;
  message: string;
  severity: "block" | "error";
}>;

export type SocialCredentialProviderReferenceSelection = Readonly<{
  selectionId: string;
  provider: SocialPlatformCredentialProvider;
  providerAccountId: string;
  accountRefId: string;
  publicationTargetId: string;
  status: SocialCredentialProviderAccountRecord["status"];
  deterministic: true;
  referenceOnly: true;
  containsCredentials: false;
  grantsExecutionPermission: false;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
}>;

export type SocialCredentialKindReferenceSelection = Readonly<{
  selectionId: string;
  provider: SocialPlatformCredentialProvider;
  credentialKind: SocialPlatformCredentialKind;
  credentialRefId: string | null;
  vaultRecordId: string | null;
  accountRefId: string | null;
  resolved: boolean;
  deterministic: true;
  referenceOnly: true;
  containsCredentials: false;
  grantsExecutionPermission: false;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
}>;

export type SocialCredentialLifecycleReferenceSelection = Readonly<{
  selectionId: string;
  provider: SocialPlatformCredentialProvider;
  lifecycleStateId: string | null;
  credentialRefId: string | null;
  accountRefId: string | null;
  resolved: boolean;
  deterministic: true;
  referenceOnly: true;
  containsCredentials: false;
  grantsExecutionPermission: false;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
}>;

export type SocialCredentialResolutionExecutionStep = Readonly<{
  stepId: string;
  order: number;
  kind: SocialCredentialResolutionExecutionStepKind;
  label: string;
  description: string;
  status: "ready" | "waiting" | "blocked";
  blocksPlanning: boolean;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialResolutionOrchestrationReadiness = Readonly<{
  readinessId: string;
  provider: SocialPlatformCredentialProvider;
  orchestrationStatus: SocialCredentialRuntimeOrchestratorProviderJob["orchestrationStatus"] | null;
  fullyOrchestrated: boolean;
  resolutionFlowComplete: boolean;
  credentialReady: boolean;
  auditAppendCompatible: boolean;
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
}>;

export type SocialCredentialResolutionCapabilitySummary = Readonly<{
  summaryId: string;
  provider: SocialPlatformCredentialProvider;
  satisfiedCapabilityFlags: readonly string[];
  missingCapabilityFlags: readonly string[];
  credentialReferenceOnly: true;
  liveCredentialsBlocked: true;
  liveOAuthBlocked: true;
  encryptionBlocked: true;
  networkBlocked: true;
  executionBlocked: true;
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
}>;

export type SocialCredentialResolutionAuditCompatibility = Readonly<{
  compatibilityId: string;
  provider: SocialPlatformCredentialProvider;
  appendOnlyCompatible: boolean;
  appendAuditEventAvailable: boolean;
  preservesAppendOnlyHistory: boolean;
  auditEventCount: number;
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  mutatesNothing: true;
  grantsExecutionPermission: false;
}>;

export type SocialCredentialResolutionProviderExecutionPlan = Readonly<{
  providerPlanId: string;
  provider: SocialPlatformCredentialProvider;
  status: SocialCredentialResolutionExecutionPlanStatus;
  providerReference: SocialCredentialProviderReferenceSelection | null;
  credentialReferences: readonly SocialCredentialKindReferenceSelection[];
  lifecycleReference: SocialCredentialLifecycleReferenceSelection;
  orchestrationReadiness: SocialCredentialResolutionOrchestrationReadiness;
  capabilitySummary: SocialCredentialResolutionCapabilitySummary;
  auditCompatibility: SocialCredentialResolutionAuditCompatibility;
  executionSteps: readonly SocialCredentialResolutionExecutionStep[];
  blockingReasons: readonly string[];
  referenceCoverageComplete: boolean;
  planningComplete: boolean;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  mutatesNothing: true;
}>;

export type SocialCredentialResolutionExecutionPlan = Readonly<{
  bridgeVersion: typeof SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BRIDGE_VERSION;
  orchestratorVersion: typeof SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION;
  planId: string;
  createdAt: string;
  mode: Exclude<SocialCredentialResolutionExecutionBridgeMode, "environment">;
  providerPlans: readonly SocialCredentialResolutionProviderExecutionPlan[];
  diagnostics: readonly SocialCredentialResolutionExecutionDiagnostic[];
  blockedReasons: readonly string[];
  status: SocialCredentialResolutionExecutionPlanStatus;
  valid: boolean;
  summary: Readonly<{
    totalProviderCount: number;
    plannedProviderCount: number;
    waitingProviderCount: number;
    blockedProviderCount: number;
    referenceCoverageCompleteCount: number;
    planningCompleteCount: number;
    orchestrationAlignedCount: number;
    auditCompatibleCount: number;
    computedOnly: true;
    readOnly: true;
  }>;
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
  storesNoSecrets: true;
  replayCompatible: true;
}>;

export type SocialCredentialResolutionExecutionPlanInput = Readonly<{
  planId: string;
  createdAt: string;
  model?: SocialCredentialPersistenceModel;
  orchestrationPlan?: SocialCredentialRuntimeOrchestrationPlan | null;
  mode?: SocialCredentialResolutionExecutionBridgeMode;
}>;

const PROVIDER_SET = new Set<string>(SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS);

export function buildSocialCredentialResolutionExecutionPlan(
  input: SocialCredentialResolutionExecutionPlanInput,
): SocialCredentialResolutionExecutionPlan {
  const diagnostics: SocialCredentialResolutionExecutionDiagnostic[] = [];
  const mode = resolveBridgeMode(input.mode);
  const model = input.model ?? EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL;
  const persistenceValidation = validateSocialCredentialPersistenceModel(model);

  requireText(input.planId, "input.planId", "plan_id_required", diagnostics);
  if (!isValidTimestamp(input.createdAt)) {
    diagnostics.push(diagnostic(
      "timestamp_invalid",
      "input.createdAt",
      "Resolution execution plan requires a valid createdAt timestamp.",
      "error",
    ));
  }
  if (!persistenceValidation.ok) {
    diagnostics.push(diagnostic(
      "persistence_model_invalid",
      "input.model",
      "Credential persistence model failed validation for resolution planning.",
      "error",
    ));
  }

  if (input.orchestrationPlan === null) {
    diagnostics.push(diagnostic(
      "orchestration_plan_missing",
      "input.orchestrationPlan",
      "Orchestration plan is required for orchestration-aware resolution planning.",
      "error",
    ));
  } else if (
    input.orchestrationPlan &&
    input.orchestrationPlan.orchestratorVersion !== SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION
  ) {
    diagnostics.push(diagnostic(
      "orchestration_blocked",
      "input.orchestrationPlan.orchestratorVersion",
      "Orchestration plan version must match D15 Wave 1 orchestrator version.",
      "error",
    ));
  }

  const providerPlans = SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS.map((provider) =>
    buildProviderExecutionPlan(
      provider,
      model,
      input.orchestrationPlan ?? null,
      diagnostics,
    ),
  );

  const blockedReasons = collectPlanBlockedReasons(diagnostics, providerPlans);
  const status = resolvePlanStatus(providerPlans, diagnostics);
  const summary = summarizeProviderPlans(providerPlans);

  return deepFreeze({
    bridgeVersion: SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BRIDGE_VERSION,
    orchestratorVersion: SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION,
    planId: input.planId,
    createdAt: input.createdAt,
    mode,
    providerPlans,
    diagnostics,
    blockedReasons,
    status,
    valid: diagnostics.every((item) => item.severity !== "error"),
    summary,
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
    storesNoSecrets: true,
    replayCompatible: true,
  });
}

export function selectProviderReference(
  provider: SocialPlatformCredentialProvider,
  model: SocialCredentialPersistenceModel,
): Readonly<{
  selection: SocialCredentialProviderReferenceSelection | null;
  ambiguous: boolean;
  blockingReasons: readonly string[];
}> {
  if (!PROVIDER_SET.has(provider)) {
    return { selection: null, ambiguous: false, blockingReasons: ["provider_unknown"] };
  }

  const candidates = model.provider_accounts
    .filter((record) => record.provider === provider && record.status === "registered")
    .sort((left, right) => left.provider_account_id.localeCompare(right.provider_account_id));

  if (candidates.length === 0) {
    return { selection: null, ambiguous: false, blockingReasons: ["provider_account_missing"] };
  }

  const disabledCandidates = model.provider_accounts.filter(
    (record) => record.provider === provider && record.status === "disabled",
  );
  if (disabledCandidates.length > 0 && candidates.length === 0) {
    return { selection: null, ambiguous: false, blockingReasons: ["provider_account_disabled"] };
  }

  const selected = candidates[0];
  const reference = mapProviderAccountRecordToReference(selected);
  return {
    selection: deepFreeze({
      selectionId: `provider-reference-${provider}`,
      provider,
      providerAccountId: reference.providerAccountId,
      accountRefId: reference.accountRefId,
      publicationTargetId: reference.publicationTargetId,
      status: selected.status,
      deterministic: true as const,
      referenceOnly: true as const,
      containsCredentials: false as const,
      grantsExecutionPermission: false as const,
      computedOnly: true as const,
      readOnly: true as const,
      authoritative: false as const,
    }),
    ambiguous: candidates.length > 1,
    blockingReasons: candidates.length > 1 ? ["provider_account_ambiguous"] : [],
  };
}

export function lookupRepositoryReferences(
  provider: SocialPlatformCredentialProvider,
  model: SocialCredentialPersistenceModel,
  providerReference: SocialCredentialProviderReferenceSelection | null,
): Readonly<{
  credentialReferences: readonly SocialCredentialKindReferenceSelection[];
  lifecycleReference: SocialCredentialLifecycleReferenceSelection;
  auditEventCount: number;
  blockingReasons: readonly string[];
}> {
  const requiredKinds = requiredCredentialKindsForProvider(provider);
  const accountRefId = providerReference?.accountRefId ?? null;

  const vaultRecords = model.vault_records
    .filter((record) => record.provider === provider && record.lifecycle_phase === "active")
    .sort((left, right) => left.vault_record_id.localeCompare(right.vault_record_id));

  const credentialReferences = requiredKinds.map((kind) => {
    const matches = vaultRecords.filter(
      (record) =>
        record.credential_kind === kind &&
        (accountRefId === null || record.account_ref_id === accountRefId),
    );
    const selected = matches[0] ?? null;
    const reference = selected ? mapVaultRecordRowToCredentialReference(selected) : null;
    return deepFreeze({
      selectionId: `credential-reference-${provider}-${kind}`,
      provider,
      credentialKind: kind,
      credentialRefId: reference?.credentialRefId ?? null,
      vaultRecordId: selected?.vault_record_id ?? null,
      accountRefId: selected?.account_ref_id ?? accountRefId,
      resolved: Boolean(selected),
      deterministic: true as const,
      referenceOnly: true as const,
      containsCredentials: false as const,
      grantsExecutionPermission: false as const,
      computedOnly: true as const,
      readOnly: true as const,
      authoritative: false as const,
    });
  });

  const lifecycleCandidates = model.lifecycle_states
    .filter((record) => record.provider === provider)
    .sort((left, right) => left.lifecycle_state_id.localeCompare(right.lifecycle_state_id));
  const resolvedCredentialRefs = new Set(
    credentialReferences
      .map((selection) => selection.credentialRefId)
      .filter((value): value is string => Boolean(value)),
  );
  const lifecycleMatch =
    lifecycleCandidates.find((record) => resolvedCredentialRefs.has(record.credential_ref_id)) ??
    lifecycleCandidates[0] ??
    null;

  const lifecycleReference = deepFreeze({
    selectionId: `lifecycle-reference-${provider}`,
    provider,
    lifecycleStateId: lifecycleMatch?.lifecycle_state_id ?? null,
    credentialRefId: lifecycleMatch?.credential_ref_id ?? null,
    accountRefId: lifecycleMatch?.account_ref_id ?? accountRefId,
    resolved: Boolean(lifecycleMatch),
    deterministic: true as const,
    referenceOnly: true as const,
    containsCredentials: false as const,
    grantsExecutionPermission: false as const,
    computedOnly: true as const,
    readOnly: true as const,
    authoritative: false as const,
  });

  const auditEventCount = model.audit_events.filter((event) => {
    if (providerReference === null) return false;
    return (
      event.credential_ref_id &&
      resolvedCredentialRefs.has(event.credential_ref_id)
    );
  }).length;

  const blockingReasons = unique([
    ...(providerReference === null ? ["provider_account_missing"] : []),
    ...credentialReferences
      .filter((selection) => !selection.resolved)
      .map((selection) => `credential_reference_missing:${selection.credentialKind}`),
    ...(lifecycleReference.resolved ? [] : ["lifecycle_reference_missing"]),
  ]);

  return {
    credentialReferences,
    lifecycleReference,
    auditEventCount,
    blockingReasons,
  };
}

export function validateSocialCredentialResolutionExecutionPlan(
  plan: unknown,
): Readonly<{
  valid: boolean;
  diagnostics: readonly SocialCredentialResolutionExecutionDiagnostic[];
}> {
  const diagnostics: SocialCredentialResolutionExecutionDiagnostic[] = [];

  if (!isRecord(plan)) {
    return {
      valid: false,
      diagnostics: [
        diagnostic(
          "serialization_invalid",
          "plan",
          "Resolution execution plan must be an object.",
          "error",
        ),
      ],
    };
  }

  requireText(plan.planId, "plan.planId", "plan_id_required", diagnostics);
  if (!isValidTimestamp(plan.createdAt)) {
    diagnostics.push(diagnostic(
      "timestamp_invalid",
      "plan.createdAt",
      "Resolution execution plan requires a valid createdAt timestamp.",
      "error",
    ));
  }
  if (plan.grantsExecutionPermission !== false) {
    diagnostics.push(diagnostic(
      "forbidden_execution_permission",
      "plan.grantsExecutionPermission",
      "Resolution execution plan must not grant execution permission.",
      "block",
    ));
  }
  if (plan.usesNoNetwork !== true || plan.callsNoExternalApis !== true) {
    diagnostics.push(diagnostic(
      "forbidden_network_flag",
      "plan",
      "Resolution execution plan must forbid network and external API usage.",
      "block",
    ));
  }
  if (!Array.isArray(plan.providerPlans)) {
    diagnostics.push(diagnostic(
      "serialization_invalid",
      "plan.providerPlans",
      "Resolution provider plans must be an array.",
      "error",
    ));
  }

  return {
    valid: diagnostics.every((item) => item.severity !== "error"),
    diagnostics,
  };
}

export function serializeSocialCredentialResolutionExecutionPlan(
  plan: SocialCredentialResolutionExecutionPlan,
): string {
  return JSON.stringify(toStableValue(plan));
}

export function hydrateSocialCredentialResolutionExecutionPlan(
  serialized: string,
): Readonly<{
  ok: true;
  value: SocialCredentialResolutionExecutionPlan;
}> | Readonly<{
  ok: false;
  diagnostics: readonly SocialCredentialResolutionExecutionDiagnostic[];
}> {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const validation = validateSocialCredentialResolutionExecutionPlan(parsed);
    if (!validation.valid || !isRecord(parsed)) {
      return { ok: false, diagnostics: validation.diagnostics };
    }
    return { ok: true, value: deepFreeze(parsed as SocialCredentialResolutionExecutionPlan) };
  } catch {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "serialization_invalid",
          "serialized",
          "Resolution execution plan serialization must be valid JSON.",
          "error",
        ),
      ],
    };
  }
}

function buildProviderExecutionPlan(
  provider: SocialPlatformCredentialProvider,
  model: SocialCredentialPersistenceModel,
  orchestrationPlan: SocialCredentialRuntimeOrchestrationPlan | null,
  globalDiagnostics: SocialCredentialResolutionExecutionDiagnostic[],
): SocialCredentialResolutionProviderExecutionPlan {
  const providerJob =
    orchestrationPlan?.providerJobs.find((job) => job.provider === provider) ?? null;

  if (orchestrationPlan && !providerJob) {
    globalDiagnostics.push(diagnostic(
      "orchestration_provider_job_missing",
      `providerPlans.${provider}`,
      `Orchestration provider job is missing for ${provider}.`,
      "error",
    ));
  }

  const providerReferenceResult = selectProviderReference(provider, model);
  const repositoryLookup = lookupRepositoryReferences(
    provider,
    model,
    providerReferenceResult.selection,
  );

  const orchestrationReadiness = buildOrchestrationReadiness(provider, providerJob);
  const capabilitySummary = buildCapabilitySummary(provider, providerJob);
  const auditCompatibility = buildAuditCompatibility(provider, providerJob, repositoryLookup.auditEventCount);
  const executionSteps = buildExecutionSteps(
    providerReferenceResult,
    repositoryLookup,
    orchestrationReadiness,
    capabilitySummary,
    auditCompatibility,
  );

  const blockingReasons = unique([
    ...providerReferenceResult.blockingReasons,
    ...repositoryLookup.blockingReasons,
    ...orchestrationReadiness.blockingReasons.map((reason) => `orchestration_blocked:${reason}`),
    ...capabilitySummary.blockingReasons.map((reason) => `capability_summary_blocked:${reason}`),
    ...auditCompatibility.blockingReasons.map((reason) => `audit_append_incompatible:${reason}`),
    ...executionSteps
      .filter((step) => step.blocksPlanning)
      .map((step) => `step_blocked:${step.kind}`),
  ]);

  const referenceCoverageComplete =
    providerReferenceResult.selection !== null &&
    repositoryLookup.credentialReferences.every((selection) => selection.resolved) &&
    repositoryLookup.lifecycleReference.resolved;

  const planningComplete =
    referenceCoverageComplete &&
    orchestrationReadiness.fullyOrchestrated &&
    capabilitySummary.missingCapabilityFlags.length === 0 &&
    auditCompatibility.appendOnlyCompatible;

  const status = resolveProviderPlanStatus(blockingReasons, planningComplete, providerJob);

  return deepFreeze({
    providerPlanId: `resolution-provider-plan-${provider}`,
    provider,
    status,
    providerReference: providerReferenceResult.selection,
    credentialReferences: repositoryLookup.credentialReferences,
    lifecycleReference: repositoryLookup.lifecycleReference,
    orchestrationReadiness,
    capabilitySummary,
    auditCompatibility,
    executionSteps,
    blockingReasons,
    referenceCoverageComplete,
    planningComplete,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    mutatesNothing: true,
  });
}

function buildOrchestrationReadiness(
  provider: SocialPlatformCredentialProvider,
  providerJob: SocialCredentialRuntimeOrchestratorProviderJob | null,
): SocialCredentialResolutionOrchestrationReadiness {
  const blockingReasons = unique([
    ...(providerJob?.blockingReasons ?? ["orchestration_provider_job_missing"]),
    ...(providerJob?.orchestrationStatus === "blocked" ? ["orchestration_status_blocked"] : []),
  ]);

  return {
    readinessId: `orchestration-readiness-${provider}`,
    provider,
    orchestrationStatus: providerJob?.orchestrationStatus ?? null,
    fullyOrchestrated: providerJob?.fullyOrchestrated ?? false,
    resolutionFlowComplete: providerJob?.resolutionFlow.resolutionComplete ?? false,
    credentialReady: providerJob?.readinessAggregation.credentialReady ?? false,
    auditAppendCompatible: providerJob?.auditIntegration.appendOnlyCompatible ?? false,
    blockingReasons,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
  };
}

function buildCapabilitySummary(
  provider: SocialPlatformCredentialProvider,
  providerJob: SocialCredentialRuntimeOrchestratorProviderJob | null,
): SocialCredentialResolutionCapabilitySummary {
  const satisfiedCapabilityFlags = providerJob?.capabilityAggregation.satisfiedCapabilityFlags ?? [];
  const missingCapabilityFlags = providerJob?.capabilityAggregation.missingCapabilityFlags ?? [
    "orchestration_capability_projection_missing",
  ];
  const blockingReasons = unique([
    ...(providerJob?.capabilityAggregation.blockingReasons ?? ["capability_projection_missing"]),
    ...missingCapabilityFlags.map((flag) => `missing_capability:${flag}`),
  ]);

  return {
    summaryId: `capability-summary-${provider}`,
    provider,
    satisfiedCapabilityFlags,
    missingCapabilityFlags,
    credentialReferenceOnly: true,
    liveCredentialsBlocked: true,
    liveOAuthBlocked: true,
    encryptionBlocked: true,
    networkBlocked: true,
    executionBlocked: true,
    blockingReasons,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
  };
}

function buildAuditCompatibility(
  provider: SocialPlatformCredentialProvider,
  providerJob: SocialCredentialRuntimeOrchestratorProviderJob | null,
  auditEventCount: number,
): SocialCredentialResolutionAuditCompatibility {
  const appendOnlyCompatible = providerJob?.auditIntegration.appendOnlyCompatible ?? false;
  const appendAuditEventAvailable = providerJob?.auditIntegration.appendAuditEventAvailable ?? true;
  const preservesAppendOnlyHistory = providerJob?.auditIntegration.preservesAppendOnlyHistory ?? true;
  const blockingReasons = unique([
    ...(providerJob?.auditIntegration.blockingReasons ?? []),
    ...(appendOnlyCompatible ? [] : ["append_only_incompatible"]),
  ]);

  return {
    compatibilityId: `audit-compatibility-${provider}`,
    provider,
    appendOnlyCompatible,
    appendAuditEventAvailable,
    preservesAppendOnlyHistory,
    auditEventCount: providerJob?.auditIntegration.auditEventCount ?? auditEventCount,
    blockingReasons,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    mutatesNothing: true,
    grantsExecutionPermission: false,
  };
}

function buildExecutionSteps(
  providerReferenceResult: ReturnType<typeof selectProviderReference>,
  repositoryLookup: ReturnType<typeof lookupRepositoryReferences>,
  orchestrationReadiness: SocialCredentialResolutionOrchestrationReadiness,
  capabilitySummary: SocialCredentialResolutionCapabilitySummary,
  auditCompatibility: SocialCredentialResolutionAuditCompatibility,
): readonly SocialCredentialResolutionExecutionStep[] {
  const specs: readonly [
    SocialCredentialResolutionExecutionStepKind,
    string,
    string,
    boolean,
  ][] = [
    [
      "provider_reference_selection",
      "Provider reference selection",
      "Select deterministic provider account reference from repository records.",
      providerReferenceResult.selection === null,
    ],
    [
      "credential_reference_lookup",
      "Credential reference lookup",
      "Lookup required credential kind references from repository vault metadata.",
      repositoryLookup.credentialReferences.some((selection) => !selection.resolved),
    ],
    [
      "lifecycle_reference_lookup",
      "Lifecycle reference lookup",
      "Lookup lifecycle state reference linked to credential references.",
      !repositoryLookup.lifecycleReference.resolved,
    ],
    [
      "orchestration_readiness_review",
      "Orchestration readiness review",
      "Review D15 Wave 1 orchestration readiness without granting execution authority.",
      !orchestrationReadiness.fullyOrchestrated,
    ],
    [
      "capability_summary_review",
      "Capability summary review",
      "Review capability flags required for reference-only resolution planning.",
      capabilitySummary.missingCapabilityFlags.length > 0,
    ],
    [
      "audit_append_compatibility_review",
      "Audit append compatibility review",
      "Verify append-only audit compatibility for resolution planning.",
      !auditCompatibility.appendOnlyCompatible,
    ],
  ];

  return specs.map(([kind, label, description, blocked], index) => ({
    stepId: `resolution-step-${kind}`,
    order: index + 1,
    kind,
    label,
    description,
    status: blocked ? "blocked" : "ready",
    blocksPlanning: blocked,
    computedOnly: true as const,
    readOnly: true as const,
    authoritative: false as const,
    grantsExecutionPermission: false as const,
    executesNothing: true as const,
    publishesNothing: true as const,
  }));
}

function summarizeProviderPlans(
  providerPlans: readonly SocialCredentialResolutionProviderExecutionPlan[],
): SocialCredentialResolutionExecutionPlan["summary"] {
  return {
    totalProviderCount: providerPlans.length,
    plannedProviderCount: providerPlans.filter((plan) => plan.status === "planned").length,
    waitingProviderCount: providerPlans.filter((plan) => plan.status === "waiting").length,
    blockedProviderCount: providerPlans.filter((plan) => plan.status === "blocked").length,
    referenceCoverageCompleteCount: providerPlans.filter((plan) => plan.referenceCoverageComplete).length,
    planningCompleteCount: providerPlans.filter((plan) => plan.planningComplete).length,
    orchestrationAlignedCount: providerPlans.filter((plan) => plan.orchestrationReadiness.fullyOrchestrated).length,
    auditCompatibleCount: providerPlans.filter((plan) => plan.auditCompatibility.appendOnlyCompatible).length,
    computedOnly: true,
    readOnly: true,
  };
}

function collectPlanBlockedReasons(
  diagnostics: readonly SocialCredentialResolutionExecutionDiagnostic[],
  providerPlans: readonly SocialCredentialResolutionProviderExecutionPlan[],
): readonly string[] {
  const reasons = new Set<string>();
  for (const item of diagnostics) reasons.add(item.code);
  for (const plan of providerPlans) {
    for (const reason of plan.blockingReasons) reasons.add(reason);
  }
  return [...reasons];
}

function resolvePlanStatus(
  providerPlans: readonly SocialCredentialResolutionProviderExecutionPlan[],
  diagnostics: readonly SocialCredentialResolutionExecutionDiagnostic[],
): SocialCredentialResolutionExecutionPlanStatus {
  if (diagnostics.some((item) => item.severity === "error" || item.severity === "block")) {
    return "blocked";
  }
  if (providerPlans.some((plan) => plan.status === "blocked")) return "blocked";
  if (providerPlans.some((plan) => plan.status === "waiting")) return "waiting";
  return providerPlans.every((plan) => plan.planningComplete) ? "planned" : "waiting";
}

function resolveProviderPlanStatus(
  blockingReasons: readonly string[],
  planningComplete: boolean,
  providerJob: SocialCredentialRuntimeOrchestratorProviderJob | null,
): SocialCredentialResolutionExecutionPlanStatus {
  if (blockingReasons.some((reason) => !reason.includes("orchestration"))) {
    if (
      blockingReasons.some(
        (reason) =>
          reason.startsWith("provider_account") ||
          reason.startsWith("credential_reference") ||
          reason.startsWith("lifecycle_reference"),
      )
    ) {
      return "blocked";
    }
  }
  if (blockingReasons.length > 0 && !planningComplete) {
    return providerJob?.orchestrationStatus === "waiting" ? "waiting" : "blocked";
  }
  return planningComplete ? "planned" : "waiting";
}

function resolveBridgeMode(
  mode: SocialCredentialResolutionExecutionBridgeMode | undefined,
): Exclude<SocialCredentialResolutionExecutionBridgeMode, "environment"> {
  const requested = mode ?? "environment";
  if (requested === "production" || requested === "reference") return requested;
  if (process.env.NODE_ENV === "production") return "production";
  return "reference";
}

function diagnostic(
  code: SocialCredentialResolutionExecutionBlockedReason,
  path: string,
  message: string,
  severity: "block" | "error",
): SocialCredentialResolutionExecutionDiagnostic {
  return { code, path, message, severity };
}

function requireText(
  value: unknown,
  path: string,
  code: SocialCredentialResolutionExecutionBlockedReason,
  diagnostics: SocialCredentialResolutionExecutionDiagnostic[],
): void {
  if (typeof value === "string" && value.trim().length > 0) return;
  diagnostics.push(diagnostic(code, path, "Required resolution execution text field is missing.", "error"));
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
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
