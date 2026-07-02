import type { SocialPlatformCredentialProvider } from "./social-platform-credential-boundary";
import type { SocialPlatformOAuthCallbackExpectation } from "./social-platform-oauth-request";
import {
  SOCIAL_PLATFORM_OAUTH_CALLBACK_VERSION,
  validateSocialPlatformOAuthCallbackOutcome,
  type SocialPlatformOAuthCallbackDiagnostic,
  type SocialPlatformOAuthCallbackOutcome,
  type SocialPlatformOAuthCallbackOutcomeKind,
} from "./social-platform-oauth-callback";

export const SOCIAL_PLATFORM_OAUTH_CALLBACK_REPLAY_VERSION = "d12-m2-replay-v1" as const;

export const SOCIAL_PLATFORM_OAUTH_CALLBACK_REPLAY_DIAGNOSTIC_CODES = [
  "callback_outcome_validation_error",
  "callback_expectation_missing",
  "callback_success_intent_modeled",
  "credential_exchange_blocked",
  "live_callback_blocked",
] as const;

export type SocialPlatformOAuthCallbackReplayDiagnosticCode =
  (typeof SOCIAL_PLATFORM_OAUTH_CALLBACK_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPlatformOAuthCallbackReplayDiagnostic = Readonly<{
  code: SocialPlatformOAuthCallbackReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "block" | "error" | "warning";
}>;

export type SocialPlatformOAuthCallbackReplayModel = Readonly<{
  callbackExpectations?: readonly SocialPlatformOAuthCallbackExpectation[];
  callbackOutcomes?: readonly SocialPlatformOAuthCallbackOutcome[];
}>;

export type SocialPlatformOAuthCallbackOutcomeProjection = Readonly<{
  callbackResultId: string;
  callbackExpectationId: string;
  provider: SocialPlatformCredentialProvider;
  accountRefId: string;
  oauthStateRefId: string;
  outcomeKind: SocialPlatformOAuthCallbackOutcomeKind;
  modeledOutcomeValid: boolean;
  successIntentModeled: boolean;
  userDenied: boolean;
  userCanceled: boolean;
  providerError: boolean;
  stateMismatch: boolean;
  expired: boolean;
  liveCallbackBlocked: true;
  credentialExchangeBlocked: true;
  tokenStorageBlocked: true;
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformOAuthCallbackProviderReadiness = Readonly<{
  provider: SocialPlatformCredentialProvider;
  callbackOutcomeCount: number;
  invalidOutcomeCount: number;
  successIntentCount: number;
  deniedCount: number;
  canceledCount: number;
  errorCount: number;
  credentialExchangeBlocked: true;
  tokenStorageBlocked: true;
  networkBlocked: true;
  executionCapable: false;
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformOAuthCallbackReadModel = Readonly<{
  replayVersion: typeof SOCIAL_PLATFORM_OAUTH_CALLBACK_REPLAY_VERSION;
  callbackVersion: typeof SOCIAL_PLATFORM_OAUTH_CALLBACK_VERSION;
  modeledOutcomes: readonly SocialPlatformOAuthCallbackOutcomeProjection[];
  invalidOutcomes: readonly SocialPlatformOAuthCallbackOutcomeProjection[];
  successIntentOutcomes: readonly SocialPlatformOAuthCallbackOutcomeProjection[];
  deniedOutcomes: readonly SocialPlatformOAuthCallbackOutcomeProjection[];
  canceledOutcomes: readonly SocialPlatformOAuthCallbackOutcomeProjection[];
  providerErrorOutcomes: readonly SocialPlatformOAuthCallbackOutcomeProjection[];
  blockedCredentialExchangeOutcomes: readonly SocialPlatformOAuthCallbackOutcomeProjection[];
  providerReadiness: readonly SocialPlatformOAuthCallbackProviderReadiness[];
  diagnostics: readonly SocialPlatformOAuthCallbackReplayDiagnostic[];
  summary: Readonly<{
    outcomeCount: number;
    modeledOutcomeCount: number;
    invalidOutcomeCount: number;
    successIntentCount: number;
    deniedCount: number;
    canceledCount: number;
    providerErrorCount: number;
    credentialExchangeBlockedCount: number;
    diagnosticCount: number;
    errorCount: number;
    blockCount: number;
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
    source: "social_platform_oauth_callback_replay";
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

export type SocialPlatformOAuthCallbackReplayResult = Readonly<{
  ok: true;
  value: SocialPlatformOAuthCallbackReadModel;
}>;

export function replaySocialPlatformOAuthCallbacks(
  model: SocialPlatformOAuthCallbackReplayModel = {},
): SocialPlatformOAuthCallbackReplayResult {
  const diagnostics: SocialPlatformOAuthCallbackReplayDiagnostic[] = [];
  const expectations = model.callbackExpectations ?? [];
  const outcomes = model.callbackOutcomes ?? [];
  const expectationById = new Map(
    expectations.map((expectation) => [expectation.callbackExpectationId, expectation]),
  );

  const projections = outcomes.map((outcome, index) =>
    projectOutcome(outcome, index, expectationById, diagnostics),
  );
  const modeledOutcomes = projections.filter((outcome) => outcome.modeledOutcomeValid);
  const invalidOutcomes = projections.filter((outcome) => !outcome.modeledOutcomeValid);
  const successIntentOutcomes = projections.filter((outcome) => outcome.successIntentModeled);
  const deniedOutcomes = projections.filter((outcome) => outcome.userDenied);
  const canceledOutcomes = projections.filter((outcome) => outcome.userCanceled);
  const providerErrorOutcomes = projections.filter((outcome) => outcome.providerError);
  const blockedCredentialExchangeOutcomes = [...projections];
  const providerReadiness = projectProviderReadiness(projections);
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const blockCount = diagnostics.filter((diagnostic) => diagnostic.severity === "block").length;

  return {
    ok: true,
    value: deepFreeze({
      replayVersion: SOCIAL_PLATFORM_OAUTH_CALLBACK_REPLAY_VERSION,
      callbackVersion: SOCIAL_PLATFORM_OAUTH_CALLBACK_VERSION,
      modeledOutcomes,
      invalidOutcomes,
      successIntentOutcomes,
      deniedOutcomes,
      canceledOutcomes,
      providerErrorOutcomes,
      blockedCredentialExchangeOutcomes,
      providerReadiness,
      diagnostics,
      summary: {
        outcomeCount: projections.length,
        modeledOutcomeCount: modeledOutcomes.length,
        invalidOutcomeCount: invalidOutcomes.length,
        successIntentCount: successIntentOutcomes.length,
        deniedCount: deniedOutcomes.length,
        canceledCount: canceledOutcomes.length,
        providerErrorCount: providerErrorOutcomes.length,
        credentialExchangeBlockedCount: blockedCredentialExchangeOutcomes.length,
        diagnosticCount: diagnostics.length,
        errorCount,
        blockCount,
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
        source: "social_platform_oauth_callback_replay",
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

function projectOutcome(
  outcome: SocialPlatformOAuthCallbackOutcome,
  index: number,
  expectationById: ReadonlyMap<string, SocialPlatformOAuthCallbackExpectation>,
  diagnostics: SocialPlatformOAuthCallbackReplayDiagnostic[],
): SocialPlatformOAuthCallbackOutcomeProjection {
  const path = `callbackOutcomes.${index}`;
  const expectation = expectationById.get(outcome.callbackExpectationId) ?? null;
  if (!expectation) {
    diagnostics.push({
      code: "callback_expectation_missing",
      path: `${path}.callbackExpectationId`,
      message: "OAuth callback outcome does not have a modeled callback expectation.",
      severity: "error",
    });
  }

  const validation = validateSocialPlatformOAuthCallbackOutcome(outcome, expectation, path);
  diagnostics.push(...mapValidationDiagnostics(validation.diagnostics));

  if (outcome.outcomeKind === "success_intent_modeled") {
    diagnostics.push({
      code: "callback_success_intent_modeled",
      path,
      message: "OAuth callback success is modeled as intent only; no code exchange is performed.",
      severity: "warning",
    });
  }
  diagnostics.push({
    code: "credential_exchange_blocked",
    path,
    message: "OAuth callback credential exchange remains blocked.",
    severity: "block",
  });
  diagnostics.push({
    code: "live_callback_blocked",
    path,
    message: "OAuth callback route execution remains blocked.",
    severity: "block",
  });

  return {
    callbackResultId: outcome.callbackResultId,
    callbackExpectationId: outcome.callbackExpectationId,
    provider: outcome.provider,
    accountRefId: outcome.accountRefId,
    oauthStateRefId: outcome.oauthStateRefId,
    outcomeKind: outcome.outcomeKind,
    modeledOutcomeValid: validation.valid && Boolean(expectation),
    successIntentModeled: outcome.outcomeKind === "success_intent_modeled",
    userDenied: outcome.outcomeKind === "denied_by_user",
    userCanceled: outcome.outcomeKind === "canceled_by_user",
    providerError: outcome.outcomeKind === "provider_error_reference",
    stateMismatch: outcome.outcomeKind === "state_mismatch_reference",
    expired: outcome.outcomeKind === "expired_reference",
    liveCallbackBlocked: true,
    credentialExchangeBlocked: true,
    tokenStorageBlocked: true,
    blockingReasons: unique([
      "live_callback_blocked",
      "credential_exchange_blocked",
      "token_storage_blocked",
      "network_blocked",
      "execution_blocked",
      validation.valid ? "" : "callback_outcome_validation_failed",
      expectation ? "" : "callback_expectation_missing",
      outcome.outcomeKind === "success_intent_modeled" ? "success_intent_only" : "",
      outcome.outcomeKind === "denied_by_user" ? "user_denied" : "",
      outcome.outcomeKind === "canceled_by_user" ? "user_canceled" : "",
      outcome.outcomeKind === "provider_error_reference" ? "provider_error" : "",
      outcome.outcomeKind === "state_mismatch_reference" ? "state_mismatch" : "",
      outcome.outcomeKind === "expired_reference" ? "expired" : "",
    ]),
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function projectProviderReadiness(
  projections: readonly SocialPlatformOAuthCallbackOutcomeProjection[],
): readonly SocialPlatformOAuthCallbackProviderReadiness[] {
  const providers: readonly SocialPlatformCredentialProvider[] = ["meta", "tiktok", "linkedin"];

  return providers.map((provider) => {
    const providerOutcomes = projections.filter((outcome) => outcome.provider === provider);
    const invalidOutcomeCount = providerOutcomes.filter((outcome) => !outcome.modeledOutcomeValid).length;

    return {
      provider,
      callbackOutcomeCount: providerOutcomes.length,
      invalidOutcomeCount,
      successIntentCount: providerOutcomes.filter((outcome) => outcome.successIntentModeled).length,
      deniedCount: providerOutcomes.filter((outcome) => outcome.userDenied).length,
      canceledCount: providerOutcomes.filter((outcome) => outcome.userCanceled).length,
      errorCount: providerOutcomes.filter((outcome) => outcome.providerError).length,
      credentialExchangeBlocked: true,
      tokenStorageBlocked: true,
      networkBlocked: true,
      executionCapable: false,
      blockingReasons: [
        "live_callback_blocked",
        "credential_exchange_blocked",
        "token_storage_blocked",
        "network_blocked",
        "execution_blocked",
      ],
      computedOnly: true,
      readOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    };
  });
}

function mapValidationDiagnostics(
  diagnostics: readonly SocialPlatformOAuthCallbackDiagnostic[],
): readonly SocialPlatformOAuthCallbackReplayDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    code: "callback_outcome_validation_error",
    path: diagnostic.path,
    message: diagnostic.message,
    severity: diagnostic.severity,
  }));
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
