import { replaySocialPlatformAdapterCapabilities } from "./social-platform-adapter-capability-replay";
import type { SocialPlatformAdapterPlatform } from "./social-platform-adapter-registry";
import {
  createSocialPlatformCredentialBoundaryContract,
  platformsForProvider,
  providerForPlatform,
  requiredCredentialKindsForProvider,
  type SocialPlatformCredentialKind,
  type SocialPlatformCredentialProvider,
} from "./social-platform-credential-boundary";
import {
  createSocialPlatformOAuthBoundaryContract,
  oauthScopesForProvider,
} from "./social-platform-oauth-boundary";
import {
  replaySocialCredentialReadiness,
} from "./credentials/social-credential-readiness-replay";
import type { SocialCredentialPersistenceModel } from "./credentials/social-credential-repository";
import { replaySocialPlatformMetaAdapter } from "./social-platform-meta-adapter-replay";
import type { SocialPublicationExecutionPersistenceModel } from "./social-publication-execution-repository";
import { replaySocialPublicationExecutionPlanner } from "./social-publication-execution-planner-replay";
import type { SocialPublicationExecutionPlanStep } from "./social-publication-execution-planner";

export const SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_REPLAY_VERSION = "d11-m9-v1" as const;

export const SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_REPLAY_DIAGNOSTIC_CODES = [
  "capability_replay_error",
  "meta_replay_error",
  "planner_replay_error",
  "provider_contract_missing",
] as const;

export type SocialPlatformCredentialBoundaryReplayDiagnosticCode =
  (typeof SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPlatformCredentialBoundaryReplayDiagnostic = Readonly<{
  code: SocialPlatformCredentialBoundaryReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPlatformCredentialBoundaryJobHint = Readonly<{
  executionJobId: string;
  publicationTargetId: string;
  platform: SocialPlatformAdapterPlatform | null;
  provider: SocialPlatformCredentialProvider | null;
}>;

export type SocialPlatformCredentialBoundaryJobProjection = Readonly<{
  executionJobId: string;
  executionIntentId: string;
  executionResultId: string | null;
  publicationTargetId: string;
  plannerStatus: SocialPublicationExecutionPlanStep["status"];
  platform: SocialPlatformAdapterPlatform | null;
  provider: SocialPlatformCredentialProvider | null;
  credentialReady: boolean;
  credentialBlocked: boolean;
  oauthReady: boolean;
  oauthBlocked: boolean;
  missingAuthorization: boolean;
  missingCredentialKinds: boolean;
  liveOAuthBlocked: boolean;
  liveCredentialsBlocked: boolean;
  requiredCredentialKinds: readonly SocialPlatformCredentialKind[];
  requiredOAuthScopes: readonly string[];
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformCredentialProviderReadiness = Readonly<{
  provider: SocialPlatformCredentialProvider;
  platforms: readonly SocialPlatformAdapterPlatform[];
  credentialContractId: string;
  oauthContractId: string;
  requiredCredentialKinds: readonly SocialPlatformCredentialKind[];
  requiredOAuthScopes: readonly string[];
  liveOAuthBlocked: true;
  liveCredentialsBlocked: true;
  credentialReferenceOnly: true;
  oauthFlowReferenceOnly: true;
  authorizationModeled: false;
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformCredentialBoundaryReadModel = Readonly<{
  replayVersion: typeof SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_REPLAY_VERSION;
  credentialReadyJobs: readonly SocialPlatformCredentialBoundaryJobProjection[];
  credentialBlockedJobs: readonly SocialPlatformCredentialBoundaryJobProjection[];
  oauthReadyJobs: readonly SocialPlatformCredentialBoundaryJobProjection[];
  oauthBlockedJobs: readonly SocialPlatformCredentialBoundaryJobProjection[];
  missingAuthorizationJobs: readonly SocialPlatformCredentialBoundaryJobProjection[];
  missingCredentialKindJobs: readonly SocialPlatformCredentialBoundaryJobProjection[];
  providerReadiness: readonly SocialPlatformCredentialProviderReadiness[];
  capabilityImpact: Readonly<{
    platformReadyCount: number;
    platformBlockedCount: number;
    credentialBlockedPlatformCount: number;
    metaReadyJobCount: number;
    metaBlockedJobCount: number;
    credentialReadyJobCount: number;
    credentialBlockedJobCount: number;
    liveOAuthBlocked: true;
    liveCredentialsBlocked: true;
    executionCapable: false;
  }>;
  diagnostics: readonly SocialPlatformCredentialBoundaryReplayDiagnostic[];
  summary: Readonly<{
    totalJobCount: number;
    credentialReadyJobCount: number;
    credentialBlockedJobCount: number;
    oauthReadyJobCount: number;
    oauthBlockedJobCount: number;
    missingAuthorizationJobCount: number;
    missingCredentialKindJobCount: number;
    providerCount: number;
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
    source: "social_platform_credential_boundary_replay";
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

export type SocialPlatformCredentialBoundaryReplayResult = Readonly<{
  ok: true;
  value: SocialPlatformCredentialBoundaryReadModel;
}>;

const EMPTY_EXECUTION_MODEL: SocialPublicationExecutionPersistenceModel = Object.freeze({
  intents: [],
  results: [],
});

export function replaySocialPlatformCredentialBoundary(
  model: SocialPublicationExecutionPersistenceModel = EMPTY_EXECUTION_MODEL,
  input: Readonly<{
    jobHints?: readonly SocialPlatformCredentialBoundaryJobHint[];
    credentialModel?: SocialCredentialPersistenceModel;
  }> = {},
): SocialPlatformCredentialBoundaryReplayResult {
  const diagnostics: SocialPlatformCredentialBoundaryReplayDiagnostic[] = [];
  const jobHints = input.jobHints ?? [];
  const credentialReadiness = replaySocialCredentialReadiness(
    input.credentialModel,
  ).value;

  const capabilityReplay = replaySocialPlatformAdapterCapabilities(model).value;
  for (const diagnostic of capabilityReplay.diagnostics) {
    if (diagnostic.severity !== "error") continue;
    diagnostics.push({
      code: "capability_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: "warning",
    });
  }

  const metaReplay = replaySocialPlatformMetaAdapter(model).value;
  for (const diagnostic of metaReplay.diagnostics) {
    if (diagnostic.severity !== "error") continue;
    diagnostics.push({
      code: "meta_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: "warning",
    });
  }

  const plannerReplay = replaySocialPublicationExecutionPlanner(model).value;
  for (const diagnostic of plannerReplay.diagnostics) {
    if (diagnostic.severity !== "error") continue;
    diagnostics.push({
      code: "planner_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: "warning",
    });
  }

  const providerReadiness = projectProviderReadiness(credentialReadiness, diagnostics);
  const storedReadinessByProvider = new Map(
    credentialReadiness.providerReadiness.map((readiness) => [readiness.provider, readiness]),
  );
  const hintByJobId = new Map(jobHints.map((hint) => [hint.executionJobId, hint]));
  const hintByTargetId = new Map(jobHints.map((hint) => [hint.publicationTargetId, hint]));
  const intentsByJobId = new Map(
    model.intents.map((intent) => [intent.execution_job_id, intent]),
  );

  const projections = plannerReplay.executionOrder.map((step) =>
    projectCredentialJob(
      step,
      hintByJobId,
      hintByTargetId,
      intentsByJobId,
      storedReadinessByProvider,
      diagnostics,
    ),
  );

  const credentialReadyJobs = projections.filter((job) => job.credentialReady);
  const credentialBlockedJobs = projections.filter((job) => job.credentialBlocked);
  const oauthReadyJobs = projections.filter((job) => job.oauthReady);
  const oauthBlockedJobs = projections.filter((job) => job.oauthBlocked);
  const missingAuthorizationJobs = projections.filter((job) => job.missingAuthorization);
  const missingCredentialKindJobs = projections.filter((job) => job.missingCredentialKinds);
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;

  const credentialBlockedPlatformCount = providerReadiness.filter(
    (readiness) => readiness.blockingReasons.length > 0,
  ).length;

  return {
    ok: true,
    value: deepFreeze({
      replayVersion: SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_REPLAY_VERSION,
      credentialReadyJobs,
      credentialBlockedJobs,
      oauthReadyJobs,
      oauthBlockedJobs,
      missingAuthorizationJobs,
      missingCredentialKindJobs,
      providerReadiness,
      capabilityImpact: {
        platformReadyCount: capabilityReplay.summary.platformReadyCount,
        platformBlockedCount: capabilityReplay.summary.platformBlockedCount,
        credentialBlockedPlatformCount,
        metaReadyJobCount: metaReplay.summary.metaReadyJobCount,
        metaBlockedJobCount: metaReplay.summary.metaBlockedJobCount,
        credentialReadyJobCount: credentialReadyJobs.length,
        credentialBlockedJobCount: credentialBlockedJobs.length,
        liveOAuthBlocked: true,
        liveCredentialsBlocked: true,
        executionCapable: false,
      },
      diagnostics,
      summary: {
        totalJobCount: projections.length,
        credentialReadyJobCount: credentialReadyJobs.length,
        credentialBlockedJobCount: credentialBlockedJobs.length,
        oauthReadyJobCount: oauthReadyJobs.length,
        oauthBlockedJobCount: oauthBlockedJobs.length,
        missingAuthorizationJobCount: missingAuthorizationJobs.length,
        missingCredentialKindJobCount: missingCredentialKindJobs.length,
        providerCount: providerReadiness.length,
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
        source: "social_platform_credential_boundary_replay",
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

function projectProviderReadiness(
  credentialReadiness: ReturnType<typeof replaySocialCredentialReadiness>["value"],
  diagnostics: SocialPlatformCredentialBoundaryReplayDiagnostic[],
): readonly SocialPlatformCredentialProviderReadiness[] {
  const providers: SocialPlatformCredentialProvider[] = ["meta", "tiktok", "linkedin"];

  return providers.map((provider) => {
    let credentialContract;
    let oauthContract;
    try {
      credentialContract = createSocialPlatformCredentialBoundaryContract(provider);
      oauthContract = createSocialPlatformOAuthBoundaryContract(provider);
    } catch {
      diagnostics.push({
        code: "provider_contract_missing",
        path: `providerReadiness.${provider}`,
        message: "Credential or OAuth boundary contract could not be resolved.",
        severity: "warning",
      });
    }

    const credentialProjection = credentialReadiness.providerReadiness.find(
      (readiness) => readiness.provider === provider,
    );
    const blockingReasons = unique([
      ...(credentialProjection?.blockingReasons ?? ["credential_readiness_missing"]),
      "live_oauth_blocked",
      "live_credentials_blocked",
      "authorization_not_modeled",
      credentialProjection?.credentialReady ? "" : "no_stored_credentials",
    ]);

    return {
      provider,
      platforms: credentialContract ? [...platformsForProvider(provider)] : [],
      credentialContractId: credentialContract?.identity.boundaryId ?? `missing-${provider}`,
      oauthContractId: oauthContract?.identity.boundaryId ?? `missing-${provider}`,
      requiredCredentialKinds: requiredCredentialKindsForProvider(provider),
      requiredOAuthScopes: [...oauthScopesForProvider(provider)],
      liveOAuthBlocked: true,
      liveCredentialsBlocked: true,
      credentialReferenceOnly: true,
      oauthFlowReferenceOnly: true,
      authorizationModeled: false,
      blockingReasons,
      computedOnly: true,
      readOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    };
  });
}

function projectCredentialJob(
  step: SocialPublicationExecutionPlanStep,
  hintByJobId: ReadonlyMap<string, SocialPlatformCredentialBoundaryJobHint>,
  hintByTargetId: ReadonlyMap<string, SocialPlatformCredentialBoundaryJobHint>,
  intentsByJobId: ReadonlyMap<
    string,
    SocialPublicationExecutionPersistenceModel["intents"][number]
  >,
  readinessByProvider: ReadonlyMap<
    SocialPlatformCredentialProvider,
    ReturnType<typeof replaySocialCredentialReadiness>["value"]["providerReadiness"][number]
  >,
  diagnostics: SocialPlatformCredentialBoundaryReplayDiagnostic[],
): SocialPlatformCredentialBoundaryJobProjection {
  const intent = intentsByJobId.get(step.executionJobId);
  const publicationTargetId = intent?.scope.publication_target_id ?? "unknown";
  const hint =
    hintByJobId.get(step.executionJobId) ??
    hintByTargetId.get(publicationTargetId) ??
    null;

  const platform = hint?.platform ?? null;
  const provider =
    hint?.provider ??
    (platform ? providerForPlatform(platform) : null);
  const blockingReasons: string[] = [];

  if (!provider) {
    blockingReasons.push("provider_unresolved");
  }

  let requiredCredentialKinds: readonly SocialPlatformCredentialKind[] = [];
  let requiredOAuthScopes: readonly string[] = [];
  const credentialProviderReadiness = provider
    ? readinessByProvider.get(provider) ?? null
    : null;
  if (provider) {
    try {
      createSocialPlatformCredentialBoundaryContract(provider);
      createSocialPlatformOAuthBoundaryContract(provider);
      requiredCredentialKinds = requiredCredentialKindsForProvider(provider);
      requiredOAuthScopes = [...oauthScopesForProvider(provider)];
    } catch {
      diagnostics.push({
        code: "provider_contract_missing",
        path: `projections.${step.executionJobId}.provider`,
        message: "Credential or OAuth boundary contract could not be resolved for job provider.",
        severity: "warning",
      });
      blockingReasons.push("provider_contract_missing");
    }
  }

  blockingReasons.push("live_oauth_blocked");
  blockingReasons.push("live_credentials_blocked");
  blockingReasons.push(
    ...(credentialProviderReadiness?.blockingReasons ?? ["authorization_not_modeled", "no_stored_credentials"]),
  );

  if (step.status !== "ready") {
    blockingReasons.push(`planner_status:${step.status}`);
  }
  blockingReasons.push(...step.blockingReasons);

  const missingAuthorization = Boolean(
    credentialProviderReadiness && credentialProviderReadiness.activeLifecycleCount === 0,
  ) || credentialProviderReadiness === null;
  const missingCredentialKinds = credentialProviderReadiness
    ? credentialProviderReadiness.missingCredentialKinds.length > 0
    : requiredCredentialKinds.length > 0;
  const liveOAuthBlocked = true;
  const liveCredentialsBlocked = true;

  const credentialReady = credentialProviderReadiness?.credentialReady ?? false;
  const credentialBlocked = !credentialReady;
  const oauthReady = false;
  const oauthBlocked = true;

  return {
    executionJobId: step.executionJobId,
    executionIntentId: step.executionIntentId,
    executionResultId: step.executionResultId,
    publicationTargetId: hint?.publicationTargetId ?? publicationTargetId,
    plannerStatus: step.status,
    platform,
    provider,
    credentialReady,
    credentialBlocked,
    oauthReady,
    oauthBlocked,
    missingAuthorization,
    missingCredentialKinds,
    liveOAuthBlocked,
    liveCredentialsBlocked,
    requiredCredentialKinds,
    requiredOAuthScopes,
    blockingReasons: unique(blockingReasons),
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
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
