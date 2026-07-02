import type { SocialPlatformCredentialProvider } from "./social-platform-credential-boundary";
import type {
  SocialPlatformOAuthAuthorizationRequestIntent,
  SocialPlatformOAuthCallbackExpectation,
} from "./social-platform-oauth-request";
import {
  replaySocialPlatformOAuthRequests,
  type SocialPlatformOAuthRequestReplayDiagnostic,
} from "./social-platform-oauth-request-replay";
import type { SocialPlatformOAuthCallbackOutcome } from "./social-platform-oauth-callback";
import {
  replaySocialPlatformOAuthCallbacks,
  type SocialPlatformOAuthCallbackReplayDiagnostic,
} from "./social-platform-oauth-callback-replay";

export const SOCIAL_PLATFORM_OAUTH_SESSION_REPLAY_VERSION = "d12-m3-replay-v1" as const;

export const SOCIAL_PLATFORM_OAUTH_SESSION_LIFECYCLE_STATES = [
  "request_modeled",
  "awaiting_callback_reference",
  "success_intent_modeled",
  "denied_by_user",
  "canceled_by_user",
  "provider_error_reference",
  "state_mismatch_reference",
  "expired_reference",
  "invalid_session",
] as const;

export const SOCIAL_PLATFORM_OAUTH_SESSION_REPLAY_DIAGNOSTIC_CODES = [
  "request_replay_error",
  "callback_replay_error",
  "session_request_invalid",
  "session_callback_missing",
  "session_callback_invalid",
  "session_callback_duplicate",
  "session_state_mismatch",
  "session_expired",
  "session_denied",
  "session_canceled",
  "session_success_intent_modeled",
  "session_provider_error",
  "live_oauth_blocked",
  "credential_exchange_blocked",
] as const;

export type SocialPlatformOAuthSessionLifecycleState =
  (typeof SOCIAL_PLATFORM_OAUTH_SESSION_LIFECYCLE_STATES)[number];

export type SocialPlatformOAuthSessionReplayDiagnosticCode =
  (typeof SOCIAL_PLATFORM_OAUTH_SESSION_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPlatformOAuthSessionReplayDiagnostic = Readonly<{
  code: SocialPlatformOAuthSessionReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "block" | "error" | "warning";
}>;

export type SocialPlatformOAuthSessionReplayModel = Readonly<{
  authorizationRequests?: readonly SocialPlatformOAuthAuthorizationRequestIntent[];
  callbackExpectations?: readonly SocialPlatformOAuthCallbackExpectation[];
  callbackOutcomes?: readonly SocialPlatformOAuthCallbackOutcome[];
}>;

export type SocialPlatformOAuthSessionProjection = Readonly<{
  sessionId: string;
  requestIntentId: string;
  callbackExpectationId: string;
  callbackResultIds: readonly string[];
  provider: SocialPlatformCredentialProvider;
  accountRefId: string;
  oauthStateRefId: string;
  lifecycleState: SocialPlatformOAuthSessionLifecycleState;
  modeledRequestValid: boolean;
  modeledCallbackValid: boolean;
  hasCallbackOutcome: boolean;
  hasDuplicateCallbackOutcomes: boolean;
  successIntentModeled: boolean;
  denied: boolean;
  canceled: boolean;
  providerError: boolean;
  stateMismatch: boolean;
  expired: boolean;
  liveOAuthBlocked: true;
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

export type SocialPlatformOAuthSessionProviderSummary = Readonly<{
  provider: SocialPlatformCredentialProvider;
  sessionCount: number;
  awaitingCallbackCount: number;
  successIntentCount: number;
  deniedCount: number;
  canceledCount: number;
  providerErrorCount: number;
  stateMismatchCount: number;
  expiredCount: number;
  invalidSessionCount: number;
  liveOAuthBlocked: true;
  credentialExchangeBlocked: true;
  executionCapable: false;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformOAuthSessionReadModel = Readonly<{
  replayVersion: typeof SOCIAL_PLATFORM_OAUTH_SESSION_REPLAY_VERSION;
  sessions: readonly SocialPlatformOAuthSessionProjection[];
  awaitingCallbackSessions: readonly SocialPlatformOAuthSessionProjection[];
  successIntentSessions: readonly SocialPlatformOAuthSessionProjection[];
  deniedSessions: readonly SocialPlatformOAuthSessionProjection[];
  canceledSessions: readonly SocialPlatformOAuthSessionProjection[];
  providerErrorSessions: readonly SocialPlatformOAuthSessionProjection[];
  stateMismatchSessions: readonly SocialPlatformOAuthSessionProjection[];
  expiredSessions: readonly SocialPlatformOAuthSessionProjection[];
  invalidSessions: readonly SocialPlatformOAuthSessionProjection[];
  providerSummaries: readonly SocialPlatformOAuthSessionProviderSummary[];
  diagnostics: readonly SocialPlatformOAuthSessionReplayDiagnostic[];
  summary: Readonly<{
    sessionCount: number;
    awaitingCallbackCount: number;
    successIntentCount: number;
    deniedCount: number;
    canceledCount: number;
    providerErrorCount: number;
    stateMismatchCount: number;
    expiredCount: number;
    invalidSessionCount: number;
    duplicateCallbackSessionCount: number;
    liveOAuthBlockedSessionCount: number;
    credentialExchangeBlockedSessionCount: number;
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
    source: "social_platform_oauth_session_replay";
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

export type SocialPlatformOAuthSessionReplayResult = Readonly<{
  ok: true;
  value: SocialPlatformOAuthSessionReadModel;
}>;

export function replaySocialPlatformOAuthSessions(
  model: SocialPlatformOAuthSessionReplayModel = {},
): SocialPlatformOAuthSessionReplayResult {
  const diagnostics: SocialPlatformOAuthSessionReplayDiagnostic[] = [];
  const authorizationRequests = model.authorizationRequests ?? [];
  const callbackExpectations = model.callbackExpectations ?? [];
  const callbackOutcomes = model.callbackOutcomes ?? [];

  const requestReplay = replaySocialPlatformOAuthRequests({
    authorizationRequests,
    callbackExpectations,
  }).value;
  diagnostics.push(...mapRequestDiagnostics(requestReplay.diagnostics));

  const callbackReplay = replaySocialPlatformOAuthCallbacks({
    callbackExpectations,
    callbackOutcomes,
  }).value;
  diagnostics.push(...mapCallbackDiagnostics(callbackReplay.diagnostics));

  const outcomesByExpectationId = groupCallbackOutcomes(callbackOutcomes);
  const requestProjectionById = new Map(
    requestReplay.liveOAuthBlockedRequests.map((request) => [request.requestIntentId, request]),
  );
  const callbackProjectionByResultId = new Map(
    callbackReplay.blockedCredentialExchangeOutcomes.map((outcome) => [outcome.callbackResultId, outcome]),
  );

  const sessions = authorizationRequests.map((request, index) =>
    projectSession(
      request,
      index,
      outcomesByExpectationId.get(request.callbackExpectation.callbackExpectationId) ?? [],
      requestProjectionById,
      callbackProjectionByResultId,
      diagnostics,
    ),
  );

  const awaitingCallbackSessions = sessions.filter(
    (session) => session.lifecycleState === "awaiting_callback_reference",
  );
  const successIntentSessions = sessions.filter((session) => session.successIntentModeled);
  const deniedSessions = sessions.filter((session) => session.denied);
  const canceledSessions = sessions.filter((session) => session.canceled);
  const providerErrorSessions = sessions.filter((session) => session.providerError);
  const stateMismatchSessions = sessions.filter((session) => session.stateMismatch);
  const expiredSessions = sessions.filter((session) => session.expired);
  const invalidSessions = sessions.filter((session) => session.lifecycleState === "invalid_session");
  const duplicateCallbackSessionCount = sessions.filter(
    (session) => session.hasDuplicateCallbackOutcomes,
  ).length;
  const providerSummaries = projectProviderSummaries(sessions);
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const blockCount = diagnostics.filter((diagnostic) => diagnostic.severity === "block").length;

  return {
    ok: true,
    value: deepFreeze({
      replayVersion: SOCIAL_PLATFORM_OAUTH_SESSION_REPLAY_VERSION,
      sessions,
      awaitingCallbackSessions,
      successIntentSessions,
      deniedSessions,
      canceledSessions,
      providerErrorSessions,
      stateMismatchSessions,
      expiredSessions,
      invalidSessions,
      providerSummaries,
      diagnostics,
      summary: {
        sessionCount: sessions.length,
        awaitingCallbackCount: awaitingCallbackSessions.length,
        successIntentCount: successIntentSessions.length,
        deniedCount: deniedSessions.length,
        canceledCount: canceledSessions.length,
        providerErrorCount: providerErrorSessions.length,
        stateMismatchCount: stateMismatchSessions.length,
        expiredCount: expiredSessions.length,
        invalidSessionCount: invalidSessions.length,
        duplicateCallbackSessionCount,
        liveOAuthBlockedSessionCount: sessions.length,
        credentialExchangeBlockedSessionCount: sessions.length,
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
        source: "social_platform_oauth_session_replay",
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

function projectSession(
  request: SocialPlatformOAuthAuthorizationRequestIntent,
  index: number,
  outcomes: readonly SocialPlatformOAuthCallbackOutcome[],
  requestProjectionById: ReadonlyMap<string, { modeledRequestValid: boolean }>,
  callbackProjectionByResultId: ReadonlyMap<string, { modeledOutcomeValid: boolean }>,
  diagnostics: SocialPlatformOAuthSessionReplayDiagnostic[],
): SocialPlatformOAuthSessionProjection {
  const path = `sessions.${index}`;
  const requestProjection = requestProjectionById.get(request.requestIntentId);
  const callbackProjections = outcomes.map((outcome) =>
    callbackProjectionByResultId.get(outcome.callbackResultId),
  );
  const modeledRequestValid = requestProjection?.modeledRequestValid ?? false;
  const modeledCallbackValid = callbackProjections.every(
    (projection) => projection?.modeledOutcomeValid === true,
  );
  const hasCallbackOutcome = outcomes.length > 0;
  const hasDuplicateCallbackOutcomes = outcomes.length > 1;
  const outcome = outcomes[0] ?? null;
  const successIntentModeled = outcome?.outcomeKind === "success_intent_modeled";
  const denied = outcome?.outcomeKind === "denied_by_user";
  const canceled = outcome?.outcomeKind === "canceled_by_user";
  const providerError = outcome?.outcomeKind === "provider_error_reference";
  const stateMismatch = outcome?.outcomeKind === "state_mismatch_reference";
  const expired = outcome?.outcomeKind === "expired_reference";
  const lifecycleState = determineLifecycleState(
    modeledRequestValid,
    modeledCallbackValid,
    hasCallbackOutcome,
    successIntentModeled,
    denied,
    canceled,
    providerError,
    stateMismatch,
    expired,
  );

  if (!modeledRequestValid) {
    diagnostics.push(errorDiagnostic(
      "session_request_invalid",
      `${path}.requestIntentId`,
      "OAuth session request model is invalid.",
    ));
  }
  if (!hasCallbackOutcome) {
    diagnostics.push(warningDiagnostic(
      "session_callback_missing",
      `${path}.callbackExpectationId`,
      "OAuth session is awaiting a modeled callback outcome.",
    ));
  }
  if (hasCallbackOutcome && !modeledCallbackValid) {
    diagnostics.push(errorDiagnostic(
      "session_callback_invalid",
      `${path}.callbackResultIds`,
      "OAuth session callback outcome model is invalid.",
    ));
  }
  if (hasDuplicateCallbackOutcomes) {
    diagnostics.push(errorDiagnostic(
      "session_callback_duplicate",
      `${path}.callbackResultIds`,
      "OAuth session has multiple callback outcomes for the same expectation.",
    ));
  }
  if (stateMismatch) {
    diagnostics.push(blockDiagnostic(
      "session_state_mismatch",
      path,
      "OAuth session modeled a state mismatch outcome.",
    ));
  }
  if (expired) {
    diagnostics.push(blockDiagnostic(
      "session_expired",
      path,
      "OAuth session modeled an expired callback outcome.",
    ));
  }
  if (denied) {
    diagnostics.push(blockDiagnostic(
      "session_denied",
      path,
      "OAuth session modeled a user-denied callback outcome.",
    ));
  }
  if (canceled) {
    diagnostics.push(blockDiagnostic(
      "session_canceled",
      path,
      "OAuth session modeled a user-canceled callback outcome.",
    ));
  }
  if (providerError) {
    diagnostics.push(blockDiagnostic(
      "session_provider_error",
      path,
      "OAuth session modeled a provider-error callback outcome.",
    ));
  }
  if (successIntentModeled) {
    diagnostics.push(warningDiagnostic(
      "session_success_intent_modeled",
      path,
      "OAuth session success is modeled as intent only; no credentials are received or exchanged.",
    ));
  }
  diagnostics.push(blockDiagnostic(
    "live_oauth_blocked",
    path,
    "OAuth session replay does not perform live OAuth.",
  ));
  diagnostics.push(blockDiagnostic(
    "credential_exchange_blocked",
    path,
    "OAuth session replay does not exchange codes or store credentials.",
  ));

  return {
    sessionId: `oauth-session:${request.requestIntentId}`,
    requestIntentId: request.requestIntentId,
    callbackExpectationId: request.callbackExpectation.callbackExpectationId,
    callbackResultIds: outcomes.map((candidate) => candidate.callbackResultId),
    provider: request.provider,
    accountRefId: request.accountRefId,
    oauthStateRefId: request.oauthStateRefId,
    lifecycleState,
    modeledRequestValid,
    modeledCallbackValid,
    hasCallbackOutcome,
    hasDuplicateCallbackOutcomes,
    successIntentModeled,
    denied,
    canceled,
    providerError,
    stateMismatch,
    expired,
    liveOAuthBlocked: true,
    credentialExchangeBlocked: true,
    tokenStorageBlocked: true,
    blockingReasons: unique([
      "live_oauth_blocked",
      "credential_exchange_blocked",
      "token_storage_blocked",
      "network_blocked",
      "execution_blocked",
      modeledRequestValid ? "" : "request_invalid",
      hasCallbackOutcome ? "" : "callback_missing",
      modeledCallbackValid ? "" : "callback_invalid",
      hasDuplicateCallbackOutcomes ? "callback_duplicate" : "",
      successIntentModeled ? "success_intent_only" : "",
      denied ? "denied_by_user" : "",
      canceled ? "canceled_by_user" : "",
      providerError ? "provider_error" : "",
      stateMismatch ? "state_mismatch" : "",
      expired ? "expired" : "",
    ]),
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function determineLifecycleState(
  modeledRequestValid: boolean,
  modeledCallbackValid: boolean,
  hasCallbackOutcome: boolean,
  successIntentModeled: boolean,
  denied: boolean,
  canceled: boolean,
  providerError: boolean,
  stateMismatch: boolean,
  expired: boolean,
): SocialPlatformOAuthSessionLifecycleState {
  if (!modeledRequestValid || !modeledCallbackValid) return "invalid_session";
  if (!hasCallbackOutcome) return "awaiting_callback_reference";
  if (successIntentModeled) return "success_intent_modeled";
  if (denied) return "denied_by_user";
  if (canceled) return "canceled_by_user";
  if (providerError) return "provider_error_reference";
  if (stateMismatch) return "state_mismatch_reference";
  if (expired) return "expired_reference";
  return "request_modeled";
}

function projectProviderSummaries(
  sessions: readonly SocialPlatformOAuthSessionProjection[],
): readonly SocialPlatformOAuthSessionProviderSummary[] {
  const providers: readonly SocialPlatformCredentialProvider[] = ["meta", "tiktok", "linkedin"];
  return providers.map((provider) => {
    const providerSessions = sessions.filter((session) => session.provider === provider);
    return {
      provider,
      sessionCount: providerSessions.length,
      awaitingCallbackCount: providerSessions.filter(
        (session) => session.lifecycleState === "awaiting_callback_reference",
      ).length,
      successIntentCount: providerSessions.filter((session) => session.successIntentModeled).length,
      deniedCount: providerSessions.filter((session) => session.denied).length,
      canceledCount: providerSessions.filter((session) => session.canceled).length,
      providerErrorCount: providerSessions.filter((session) => session.providerError).length,
      stateMismatchCount: providerSessions.filter((session) => session.stateMismatch).length,
      expiredCount: providerSessions.filter((session) => session.expired).length,
      invalidSessionCount: providerSessions.filter(
        (session) => session.lifecycleState === "invalid_session",
      ).length,
      liveOAuthBlocked: true,
      credentialExchangeBlocked: true,
      executionCapable: false,
      computedOnly: true,
      readOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    };
  });
}

function groupCallbackOutcomes(
  outcomes: readonly SocialPlatformOAuthCallbackOutcome[],
): ReadonlyMap<string, readonly SocialPlatformOAuthCallbackOutcome[]> {
  const grouped = new Map<string, SocialPlatformOAuthCallbackOutcome[]>();
  for (const outcome of outcomes) {
    const current = grouped.get(outcome.callbackExpectationId) ?? [];
    current.push(outcome);
    grouped.set(outcome.callbackExpectationId, current);
  }
  return grouped;
}

function mapRequestDiagnostics(
  diagnostics: readonly SocialPlatformOAuthRequestReplayDiagnostic[],
): readonly SocialPlatformOAuthSessionReplayDiagnostic[] {
  return diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => ({
      code: "request_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: diagnostic.severity,
    }));
}

function mapCallbackDiagnostics(
  diagnostics: readonly SocialPlatformOAuthCallbackReplayDiagnostic[],
): readonly SocialPlatformOAuthSessionReplayDiagnostic[] {
  return diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => ({
      code: "callback_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: diagnostic.severity,
    }));
}

function errorDiagnostic(
  code: SocialPlatformOAuthSessionReplayDiagnosticCode,
  path: string,
  message: string,
): SocialPlatformOAuthSessionReplayDiagnostic {
  return { code, path, message, severity: "error" };
}

function blockDiagnostic(
  code: SocialPlatformOAuthSessionReplayDiagnosticCode,
  path: string,
  message: string,
): SocialPlatformOAuthSessionReplayDiagnostic {
  return { code, path, message, severity: "block" };
}

function warningDiagnostic(
  code: SocialPlatformOAuthSessionReplayDiagnosticCode,
  path: string,
  message: string,
): SocialPlatformOAuthSessionReplayDiagnostic {
  return { code, path, message, severity: "warning" };
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
