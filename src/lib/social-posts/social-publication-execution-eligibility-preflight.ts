import type { SocialCredentialResolutionExecutionProviderProjection } from "./credentials/social-credential-resolution-execution-bridge-replay";
import type { SocialCredentialRuntimeOrchestratorProviderProjection } from "./credentials/social-credential-runtime-orchestrator-replay";
import type { SocialCredentialProviderReadinessProjection } from "./credentials/social-credential-readiness-replay";
import type { SocialCredentialPersistenceModel } from "./credentials/social-credential-repository";
import {
  SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS,
  type SocialPlatformCredentialProvider,
} from "./social-platform-credential-boundary";
import {
  evaluateSocialPublicationExecutionPreflight,
  type SocialPublicationExecutionPreflightEvaluation,
} from "./social-publication-execution-preflight";
import type {
  SocialPublicationExecutionIntentRecord,
  SocialPublicationExecutionResultRecord,
} from "./social-publication-execution-repository";
import {
  evaluateExecutionAuthorizationPreflightForIntent,
  type SocialExecutionAuthorizationPreflightSummary,
} from "./execution-authorization/social-execution-authorization-preflight";
import {
  evaluateTokenLifecyclePreflightForPublicationTarget,
  type SocialOAuthTokenLifecyclePreflightSummary,
} from "./oauth/social-oauth-token-lifecycle-preflight";
import type { SocialExecutionAuthorizationPersistenceSnapshot } from "./execution-authorization/social-execution-authorization-store";
import { EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT } from "./execution-authorization/social-execution-authorization-store";

export const SOCIAL_PUBLICATION_EXECUTION_ELIGIBILITY_PREFLIGHT_VERSION =
  "d15-w3-v1" as const;

export const SOCIAL_PUBLICATION_EXECUTION_ELIGIBILITY_BLOCKED_REASON_CATEGORIES = [
  "d10_preflight",
  "credential_readiness",
  "orchestration_readiness",
  "provider_capability",
  "provider_resolution",
  "token_lifecycle",
  "execution_authorization",
  "audit_compatibility",
  "unsafe",
] as const;

export type SocialPublicationExecutionEligibilityBlockedReasonCategory =
  (typeof SOCIAL_PUBLICATION_EXECUTION_ELIGIBILITY_BLOCKED_REASON_CATEGORIES)[number];

export type SocialPublicationExecutionEligibilityBlockedReason = Readonly<{
  category: SocialPublicationExecutionEligibilityBlockedReasonCategory;
  code: string;
  path: string;
  message: string;
  severity: "block";
}>;

export type SocialPublicationExecutionCredentialReadinessSummary = Readonly<{
  provider: SocialPlatformCredentialProvider | null;
  credentialReady: boolean;
  credentialBlocked: boolean;
  missingCredentialKinds: readonly string[];
  blockingReasons: readonly string[];
}>;

export type SocialPublicationExecutionOrchestrationReadinessSummary = Readonly<{
  provider: SocialPlatformCredentialProvider | null;
  orchestrationStatus: "orchestrated" | "waiting" | "blocked" | "missing";
  fullyOrchestrated: boolean;
  readinessReady: boolean;
  resolutionComplete: boolean;
  orchestrationAligned: boolean;
  blockingReasons: readonly string[];
}>;

export type SocialPublicationExecutionProviderCapabilitySummary = Readonly<{
  provider: SocialPlatformCredentialProvider | null;
  capabilityReady: boolean;
  referenceCoverageComplete: boolean;
  planningComplete: boolean;
  satisfiedCapabilityFlags: readonly string[];
  missingCapabilityFlags: readonly string[];
  blockingReasons: readonly string[];
}>;

export type SocialPublicationExecutionTokenLifecycleReadinessSummary = Readonly<{
  provider: SocialPlatformCredentialProvider | null;
  tokenLifecycleReady: boolean;
  expiryState: SocialOAuthTokenLifecyclePreflightSummary["expiryState"] | null;
  preflightBlockingCodes: readonly string[];
  blockingReasons: readonly string[];
}>;

export type SocialPublicationExecutionAuthorizationReadinessSummary = Readonly<{
  authorizationReady: boolean;
  derivedAuthorizationState: SocialExecutionAuthorizationPreflightSummary["derivedAuthorizationState"] | null;
  derivedIntentState: SocialExecutionAuthorizationPreflightSummary["derivedIntentState"] | null;
  derivedSessionStatus: SocialExecutionAuthorizationPreflightSummary["derivedSessionStatus"] | null;
  correlationId: string | null;
  preflightBlockingCodes: readonly string[];
  blockingReasons: readonly string[];
}>;

export type SocialPublicationExecutionEligibilityReadinessSummaries = Readonly<{
  credential: SocialPublicationExecutionCredentialReadinessSummary;
  orchestration: SocialPublicationExecutionOrchestrationReadinessSummary;
  providerCapability: SocialPublicationExecutionProviderCapabilitySummary;
  tokenLifecycle: SocialPublicationExecutionTokenLifecycleReadinessSummary;
  executionAuthorization: SocialPublicationExecutionAuthorizationReadinessSummary;
  auditAppendCompatible: boolean;
}>;

export type SocialPublicationExecutionEligibilityEvaluation = Readonly<{
  preflightVersion: typeof SOCIAL_PUBLICATION_EXECUTION_ELIGIBILITY_PREFLIGHT_VERSION;
  executionJobId: string;
  executionIntentId: string;
  executionResultId: string | null;
  publicationTargetId: string | null;
  resolvedProviders: readonly SocialPlatformCredentialProvider[];
  status: "pass" | "block";
  d10Preflight: SocialPublicationExecutionPreflightEvaluation;
  blockingReasons: readonly SocialPublicationExecutionEligibilityBlockedReason[];
  aggregatedBlockingCodes: readonly string[];
  readiness: SocialPublicationExecutionEligibilityReadinessSummaries;
  couldRunLater: boolean;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  mutatesNothing: true;
}>;

export type SocialPublicationExecutionEligibilityProviderContext = Readonly<{
  credentialReadiness: SocialCredentialProviderReadinessProjection | null;
  orchestratorProvider: SocialCredentialRuntimeOrchestratorProviderProjection | null;
  resolutionProvider: SocialCredentialResolutionExecutionProviderProjection | null;
}>;

export type SocialPublicationExecutionEligibilityPreflightContext = Readonly<{
  credentialModel: SocialCredentialPersistenceModel;
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot;
  providerContexts: Readonly<
    Partial<Record<SocialPlatformCredentialProvider, SocialPublicationExecutionEligibilityProviderContext>>
  >;
}>;

export function resolveProvidersForPublicationTarget(
  publicationTargetId: string | null,
  credentialModel: SocialCredentialPersistenceModel,
): Readonly<{
  providers: readonly SocialPlatformCredentialProvider[];
  unresolved: boolean;
}> {
  if (!hasText(publicationTargetId)) {
    return { providers: [], unresolved: true };
  }

  const providers = SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS.filter((provider) =>
    credentialModel.provider_accounts.some(
      (account) =>
        account.provider === provider &&
        account.publication_target_id === publicationTargetId &&
        account.status === "registered",
    ),
  ).sort((left, right) => left.localeCompare(right));

  return { providers, unresolved: providers.length === 0 };
}

export function evaluateSocialPublicationExecutionEligibilityPreflight(
  intent: SocialPublicationExecutionIntentRecord,
  result: SocialPublicationExecutionResultRecord | null = null,
  context: SocialPublicationExecutionEligibilityPreflightContext,
): SocialPublicationExecutionEligibilityEvaluation {
  const d10Preflight = evaluateSocialPublicationExecutionPreflight(intent, result);
  const publicationTargetId = intent.scope.publication_target_id;
  const providerResolution = resolveProvidersForPublicationTarget(
    publicationTargetId,
    context.credentialModel,
  );
  const primaryProvider = providerResolution.providers[0] ?? null;
  const providerContext = primaryProvider
    ? context.providerContexts[primaryProvider] ?? emptyProviderContext()
    : emptyProviderContext();

  const credentialSummary = summarizeCredentialReadiness(primaryProvider, providerContext);
  const orchestrationSummary = summarizeOrchestrationReadiness(primaryProvider, providerContext);
  const capabilitySummary = summarizeProviderCapability(primaryProvider, providerContext);
  const tokenLifecycleSummary = summarizeTokenLifecycleReadiness(
    publicationTargetId,
    primaryProvider,
    context.credentialModel,
  );
  const tokenLifecycleCouldRunLater = tokenLifecycleSummary.couldRunLater;
  const authorizationSummary = summarizeExecutionAuthorizationReadiness(
    intent.execution_intent_id,
    publicationTargetId,
    context.authorizationSnapshot ?? EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT,
  );
  const authorizationCouldRunLater = authorizationSummary.couldRunLater;
  const auditAppendCompatible =
    (providerContext.orchestratorProvider?.auditIntegration.appendOnlyCompatible ?? false) &&
    (providerContext.resolutionProvider?.auditCompatible ?? false);

  const blockingReasons = aggregateEligibilityBlockingReasons({
    d10Preflight,
    providerResolution,
    credentialSummary,
    orchestrationSummary,
    capabilitySummary,
    tokenLifecycleSummary,
    authorizationSummary,
    auditAppendCompatible,
  });
  const aggregatedBlockingCodes = uniqueSorted(
    blockingReasons.map((reason) => `${reason.category}:${reason.code}`),
  );

  const couldRunLater =
    d10Preflight.couldRunLater &&
    blockingReasons.every((reason) => reason.category !== "unsafe") &&
    blockingReasons.every((reason) => reason.category !== "audit_compatibility") &&
    (tokenLifecycleCouldRunLater ||
      tokenLifecycleSummary.preflightBlockingCodes.length === 0) &&
    (authorizationCouldRunLater ||
      authorizationSummary.preflightBlockingCodes.length === 0);

  return deepFreeze({
    preflightVersion: SOCIAL_PUBLICATION_EXECUTION_ELIGIBILITY_PREFLIGHT_VERSION,
    executionJobId: intent.execution_job_id,
    executionIntentId: intent.execution_intent_id,
    executionResultId: result?.execution_result_id ?? null,
    publicationTargetId,
    resolvedProviders: providerResolution.providers,
    status:
      d10Preflight.status === "pass" && blockingReasons.length === 0 ? "pass" : "block",
    d10Preflight,
    blockingReasons,
    aggregatedBlockingCodes,
    readiness: {
      credential: credentialSummary,
      orchestration: orchestrationSummary,
      providerCapability: capabilitySummary,
      tokenLifecycle: {
        provider: tokenLifecycleSummary.provider,
        tokenLifecycleReady: tokenLifecycleSummary.tokenLifecycleReady,
        expiryState: tokenLifecycleSummary.expiryState,
        preflightBlockingCodes: tokenLifecycleSummary.preflightBlockingCodes,
        blockingReasons: tokenLifecycleSummary.blockingReasons,
      },
      executionAuthorization: {
        authorizationReady: authorizationSummary.authorizationReady,
        derivedAuthorizationState: authorizationSummary.derivedAuthorizationState,
        derivedIntentState: authorizationSummary.derivedIntentState,
        derivedSessionStatus: authorizationSummary.derivedSessionStatus,
        correlationId: authorizationSummary.correlationId,
        preflightBlockingCodes: authorizationSummary.preflightBlockingCodes,
        blockingReasons: authorizationSummary.blockingReasons,
      },
      auditAppendCompatible,
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

function summarizeCredentialReadiness(
  provider: SocialPlatformCredentialProvider | null,
  context: SocialPublicationExecutionEligibilityProviderContext,
): SocialPublicationExecutionCredentialReadinessSummary {
  const readiness = context.credentialReadiness;
  const blockingReasons = uniqueSorted([
    ...(readiness?.blockingReasons ?? (provider ? ["credential_readiness_missing"] : [])),
    ...(readiness?.credentialReady ? [] : ["credential_not_ready"]),
  ]);

  return {
    provider,
    credentialReady: readiness?.credentialReady ?? false,
    credentialBlocked: readiness?.credentialBlocked ?? true,
    missingCredentialKinds: readiness?.missingCredentialKinds ?? [],
    blockingReasons,
  };
}

function summarizeOrchestrationReadiness(
  provider: SocialPlatformCredentialProvider | null,
  context: SocialPublicationExecutionEligibilityProviderContext,
): SocialPublicationExecutionOrchestrationReadinessSummary {
  const orchestrator = context.orchestratorProvider;
  const resolution = context.resolutionProvider;
  const orchestrationStatus = orchestrator?.orchestrationStatus ?? "missing";
  const blockingReasons = uniqueSorted([
    ...(orchestrator?.blockingReasons ?? (provider ? ["orchestration_provider_missing"] : [])),
    ...(orchestrator?.fullyOrchestrated ? [] : ["orchestration_not_fully_orchestrated"]),
    ...(resolution?.orchestrationAligned ? [] : ["orchestration_alignment_missing"]),
  ]);

  return {
    provider,
    orchestrationStatus,
    fullyOrchestrated: orchestrator?.fullyOrchestrated ?? false,
    readinessReady: orchestrator?.readinessAggregation.credentialReady ?? false,
    resolutionComplete: orchestrator?.resolutionFlow.resolutionComplete ?? false,
    orchestrationAligned: resolution?.orchestrationAligned ?? false,
    blockingReasons,
  };
}

function summarizeTokenLifecycleReadiness(
  publicationTargetId: string | null,
  provider: SocialPlatformCredentialProvider | null,
  credentialModel: SocialCredentialPersistenceModel,
): SocialPublicationExecutionTokenLifecycleReadinessSummary & {
  couldRunLater: boolean;
} {
  if (provider !== "meta") {
    return {
      provider,
      tokenLifecycleReady: true,
      expiryState: null,
      preflightBlockingCodes: [],
      blockingReasons: [],
      couldRunLater: true,
    };
  }

  const tokenLifecycle = evaluateTokenLifecyclePreflightForPublicationTarget({
    publicationTargetId,
    credentialModel,
  });

  if (!tokenLifecycle) {
    return {
      provider,
      tokenLifecycleReady: true,
      expiryState: null,
      preflightBlockingCodes: [],
      blockingReasons: [],
      couldRunLater: true,
    };
  }

  const blockingReasons = [...tokenLifecycle.preflightBlockingCodes];
  return {
    provider,
    tokenLifecycleReady: !tokenLifecycle.blocksExecutionEligibility,
    expiryState: tokenLifecycle.expiryState,
    preflightBlockingCodes: tokenLifecycle.preflightBlockingCodes,
    blockingReasons,
    couldRunLater: tokenLifecycle.couldRunLater,
  };
}

function summarizeExecutionAuthorizationReadiness(
  executionIntentId: string,
  publicationTargetId: string | null,
  snapshot: SocialExecutionAuthorizationPersistenceSnapshot,
): SocialPublicationExecutionAuthorizationReadinessSummary & {
  couldRunLater: boolean;
} {
  const preflight = evaluateExecutionAuthorizationPreflightForIntent({
    executionIntentId,
    publicationTargetId,
    snapshot,
  });

  if (!preflight) {
    return {
      authorizationReady: false,
      derivedAuthorizationState: null,
      derivedIntentState: null,
      derivedSessionStatus: null,
      correlationId: null,
      preflightBlockingCodes: ["authorization_missing"],
      blockingReasons: ["authorization_missing"],
      couldRunLater: true,
    };
  }

  return {
    authorizationReady: preflight.authorizationValid,
    derivedAuthorizationState: preflight.derivedAuthorizationState,
    derivedIntentState: preflight.derivedIntentState,
    derivedSessionStatus: preflight.derivedSessionStatus,
    correlationId: preflight.correlationId,
    preflightBlockingCodes: preflight.preflightBlockingCodes,
    blockingReasons: preflight.blockingReasons,
    couldRunLater: preflight.couldRunLater,
  };
}

function summarizeProviderCapability(
  provider: SocialPlatformCredentialProvider | null,
  context: SocialPublicationExecutionEligibilityProviderContext,
): SocialPublicationExecutionProviderCapabilitySummary {
  const orchestrator = context.orchestratorProvider;
  const resolution = context.resolutionProvider;
  const satisfiedCapabilityFlags = orchestrator?.capabilityAggregation.satisfiedCapabilityFlags ?? [];
  const missingCapabilityFlags = orchestrator?.capabilityAggregation.missingCapabilityFlags ?? [];
  const capabilityReady =
    missingCapabilityFlags.length === 0 &&
    (orchestrator?.capabilityAggregation.blockingReasons.length ?? 1) === 0;
  const blockingReasons = uniqueSorted([
    ...(orchestrator?.capabilityAggregation.blockingReasons ?? []),
    ...(resolution?.referenceCoverageComplete ? [] : ["reference_coverage_incomplete"]),
    ...(resolution?.planningComplete ? [] : ["planning_incomplete"]),
    ...(capabilityReady ? [] : ["provider_capability_blocked"]),
  ]);

  return {
    provider,
    capabilityReady,
    referenceCoverageComplete: resolution?.referenceCoverageComplete ?? false,
    planningComplete: resolution?.planningComplete ?? false,
    satisfiedCapabilityFlags,
    missingCapabilityFlags,
    blockingReasons,
  };
}

function aggregateEligibilityBlockingReasons(input: Readonly<{
  d10Preflight: SocialPublicationExecutionPreflightEvaluation;
  providerResolution: ReturnType<typeof resolveProvidersForPublicationTarget>;
  credentialSummary: SocialPublicationExecutionCredentialReadinessSummary;
  orchestrationSummary: SocialPublicationExecutionOrchestrationReadinessSummary;
  capabilitySummary: SocialPublicationExecutionProviderCapabilitySummary;
  tokenLifecycleSummary: SocialPublicationExecutionTokenLifecycleReadinessSummary & {
    couldRunLater: boolean;
  };
  authorizationSummary: SocialPublicationExecutionAuthorizationReadinessSummary & {
    couldRunLater: boolean;
  };
  auditAppendCompatible: boolean;
}>): SocialPublicationExecutionEligibilityBlockedReason[] {
  const reasons: SocialPublicationExecutionEligibilityBlockedReason[] = [];

  for (const diagnostic of input.d10Preflight.diagnostics) {
    reasons.push({
      category: "d10_preflight",
      code: diagnostic.code,
      path: diagnostic.path,
      message: diagnostic.message,
      severity: "block",
    });
  }

  if (input.providerResolution.unresolved) {
    reasons.push({
      category: "provider_resolution",
      code: "provider_unresolved",
      path: "intent.scope.publication_target_id",
      message: "Publication execution eligibility preflight could not resolve a credential provider for the publication target.",
      severity: "block",
    });
  }

  for (const code of input.credentialSummary.blockingReasons) {
    reasons.push({
      category: "credential_readiness",
      code,
      path: "readiness.credential",
      message: `Credential readiness blocked publication execution eligibility: ${code}.`,
      severity: "block",
    });
  }

  for (const code of input.orchestrationSummary.blockingReasons) {
    reasons.push({
      category: "orchestration_readiness",
      code,
      path: "readiness.orchestration",
      message: `Orchestration readiness blocked publication execution eligibility: ${code}.`,
      severity: "block",
    });
  }

  for (const code of input.capabilitySummary.blockingReasons) {
    reasons.push({
      category: "provider_capability",
      code,
      path: "readiness.providerCapability",
      message: `Provider capability blocked publication execution eligibility: ${code}.`,
      severity: "block",
    });
  }

  for (const code of input.tokenLifecycleSummary.blockingReasons) {
    reasons.push({
      category: "token_lifecycle",
      code,
      path: "readiness.tokenLifecycle",
      message: `Meta OAuth token lifecycle blocked publication execution eligibility: ${code}.`,
      severity: "block",
    });
  }

  for (const code of input.authorizationSummary.blockingReasons) {
    reasons.push({
      category: "execution_authorization",
      code,
      path: "readiness.executionAuthorization",
      message: `Execution authorization blocked publication execution eligibility: ${code}.`,
      severity: "block",
    });
  }

  if (!input.auditAppendCompatible && input.providerResolution.providers.length > 0) {
    reasons.push({
      category: "audit_compatibility",
      code: "audit_append_incompatible",
      path: "readiness.auditAppendCompatible",
      message: "Publication execution eligibility requires append-only audit compatibility across orchestration and resolution planning.",
      severity: "block",
    });
  }

  if (
    input.d10Preflight.diagnostics.some((diagnostic) => diagnostic.category === "unsafe")
  ) {
    reasons.push({
      category: "unsafe",
      code: "unsafe_execution_contract",
      path: "execution.contract",
      message: "Publication execution eligibility requires non-executing, read-only contract invariants.",
      severity: "block",
    });
  }

  return sortBlockingReasons(reasons);
}

function emptyProviderContext(): SocialPublicationExecutionEligibilityProviderContext {
  return {
    credentialReadiness: null,
    orchestratorProvider: null,
    resolutionProvider: null,
  };
}

function sortBlockingReasons(
  reasons: readonly SocialPublicationExecutionEligibilityBlockedReason[],
): SocialPublicationExecutionEligibilityBlockedReason[] {
  return [...reasons].sort(
    (left, right) =>
      left.category.localeCompare(right.category) ||
      left.code.localeCompare(right.code) ||
      left.path.localeCompare(right.path),
  );
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort((left, right) =>
    left.localeCompare(right),
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
