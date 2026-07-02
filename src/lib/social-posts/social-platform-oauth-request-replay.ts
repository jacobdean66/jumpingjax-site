import {
  createSocialPlatformOAuthBoundaryContract,
  oauthScopesForProvider,
  type SocialPlatformOAuthScope,
} from "./social-platform-oauth-boundary";
import {
  createSocialPlatformCredentialBoundaryContract,
  type SocialPlatformCredentialProvider,
} from "./social-platform-credential-boundary";
import {
  SOCIAL_PLATFORM_OAUTH_REQUEST_VERSION,
  validateSocialPlatformOAuthAuthorizationRequestIntent,
  validateSocialPlatformOAuthCallbackExpectation,
  type SocialPlatformOAuthAuthorizationRequestIntent,
  type SocialPlatformOAuthCallbackExpectation,
  type SocialPlatformOAuthRequestDiagnostic,
} from "./social-platform-oauth-request";

export const SOCIAL_PLATFORM_OAUTH_REQUEST_REPLAY_VERSION = "d12-m1-replay-v1" as const;

export const SOCIAL_PLATFORM_OAUTH_REQUEST_REPLAY_DIAGNOSTIC_CODES = [
  "request_validation_error",
  "callback_validation_error",
  "provider_contract_missing",
  "scope_missing",
  "live_oauth_blocked",
] as const;

export type SocialPlatformOAuthRequestReplayDiagnosticCode =
  (typeof SOCIAL_PLATFORM_OAUTH_REQUEST_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPlatformOAuthRequestReplayDiagnostic = Readonly<{
  code: SocialPlatformOAuthRequestReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "block" | "error" | "warning";
}>;

export type SocialPlatformOAuthRequestReplayModel = Readonly<{
  authorizationRequests?: readonly SocialPlatformOAuthAuthorizationRequestIntent[];
  callbackExpectations?: readonly SocialPlatformOAuthCallbackExpectation[];
}>;

export type SocialPlatformOAuthRequestProjection = Readonly<{
  requestIntentId: string;
  provider: SocialPlatformCredentialProvider;
  accountRefId: string;
  requestedScopeCount: number;
  missingScopes: readonly SocialPlatformOAuthScope[];
  callbackExpectationId: string;
  modeledRequestValid: boolean;
  callbackExpectationValid: boolean;
  liveOAuthBlocked: true;
  realRedirectBlocked: true;
  realCallbackBlocked: true;
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformOAuthProviderRequestReadiness = Readonly<{
  provider: SocialPlatformCredentialProvider;
  credentialContractId: string;
  oauthContractId: string;
  supportedScopes: readonly SocialPlatformOAuthScope[];
  modeledRequestCount: number;
  invalidRequestCount: number;
  liveOAuthBlocked: true;
  credentialStorageBlocked: true;
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

export type SocialPlatformOAuthRequestReadModel = Readonly<{
  replayVersion: typeof SOCIAL_PLATFORM_OAUTH_REQUEST_REPLAY_VERSION;
  requestVersion: typeof SOCIAL_PLATFORM_OAUTH_REQUEST_VERSION;
  modeledRequests: readonly SocialPlatformOAuthRequestProjection[];
  invalidRequests: readonly SocialPlatformOAuthRequestProjection[];
  liveOAuthBlockedRequests: readonly SocialPlatformOAuthRequestProjection[];
  callbackExpectations: readonly SocialPlatformOAuthCallbackExpectation[];
  providerReadiness: readonly SocialPlatformOAuthProviderRequestReadiness[];
  diagnostics: readonly SocialPlatformOAuthRequestReplayDiagnostic[];
  summary: Readonly<{
    requestCount: number;
    modeledRequestCount: number;
    invalidRequestCount: number;
    callbackExpectationCount: number;
    liveOAuthBlockedRequestCount: number;
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
    source: "social_platform_oauth_request_replay";
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

export type SocialPlatformOAuthRequestReplayResult = Readonly<{
  ok: true;
  value: SocialPlatformOAuthRequestReadModel;
}>;

export function replaySocialPlatformOAuthRequests(
  model: SocialPlatformOAuthRequestReplayModel = {},
): SocialPlatformOAuthRequestReplayResult {
  const diagnostics: SocialPlatformOAuthRequestReplayDiagnostic[] = [];
  const requests = model.authorizationRequests ?? [];
  const callbacks = model.callbackExpectations ?? [];

  callbacks.forEach((callback, index) => {
    const validation = validateSocialPlatformOAuthCallbackExpectation(
      callback,
      `callbackExpectations.${index}`,
    );
    diagnostics.push(...mapValidationDiagnostics("callback_validation_error", validation.diagnostics));
  });

  const callbackById = new Map(callbacks.map((callback) => [callback.callbackExpectationId, callback]));
  const projections = requests.map((request, index) =>
    projectRequest(request, index, callbackById, diagnostics),
  );
  const modeledRequests = projections.filter((request) => request.modeledRequestValid);
  const invalidRequests = projections.filter((request) => !request.modeledRequestValid);
  const liveOAuthBlockedRequests = [...projections];
  const providerReadiness = projectProviderReadiness(projections, diagnostics);
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const blockCount = diagnostics.filter((diagnostic) => diagnostic.severity === "block").length;

  return {
    ok: true,
    value: deepFreeze({
      replayVersion: SOCIAL_PLATFORM_OAUTH_REQUEST_REPLAY_VERSION,
      requestVersion: SOCIAL_PLATFORM_OAUTH_REQUEST_VERSION,
      modeledRequests,
      invalidRequests,
      liveOAuthBlockedRequests,
      callbackExpectations: callbacks,
      providerReadiness,
      diagnostics,
      summary: {
        requestCount: projections.length,
        modeledRequestCount: modeledRequests.length,
        invalidRequestCount: invalidRequests.length,
        callbackExpectationCount: callbacks.length,
        liveOAuthBlockedRequestCount: liveOAuthBlockedRequests.length,
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
        source: "social_platform_oauth_request_replay",
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

function projectRequest(
  request: SocialPlatformOAuthAuthorizationRequestIntent,
  index: number,
  callbackById: ReadonlyMap<string, SocialPlatformOAuthCallbackExpectation>,
  diagnostics: SocialPlatformOAuthRequestReplayDiagnostic[],
): SocialPlatformOAuthRequestProjection {
  const requestPath = `authorizationRequests.${index}`;
  const validation = validateSocialPlatformOAuthAuthorizationRequestIntent(request, requestPath);
  diagnostics.push(...mapValidationDiagnostics("request_validation_error", validation.diagnostics));

  const supportedScopes = new Set(oauthScopesForProvider(request.provider));
  const missingScopes = oauthScopesForProvider(request.provider).filter(
    (scope) => !request.requestedScopes.includes(scope),
  );
  for (const [scopeIndex, scope] of missingScopes.entries()) {
    diagnostics.push({
      code: "scope_missing",
      path: `${requestPath}.requestedScopes.${scopeIndex}`,
      message: `OAuth request intent does not include modeled provider scope: ${scope}`,
      severity: "warning",
    });
  }

  const callbackExpectation = callbackById.get(request.callbackExpectation.callbackExpectationId)
    ?? request.callbackExpectation;
  const callbackValidation = validateSocialPlatformOAuthCallbackExpectation(
    callbackExpectation,
    `${requestPath}.callbackExpectation`,
  );
  diagnostics.push(...mapValidationDiagnostics("callback_validation_error", callbackValidation.diagnostics));

  const blockingReasons = [
    "live_oauth_blocked",
    "real_redirect_blocked",
    "real_callback_blocked",
    "credential_storage_blocked",
    "network_blocked",
    "execution_blocked",
    validation.valid ? "" : "request_validation_failed",
    callbackValidation.valid ? "" : "callback_validation_failed",
    ...request.requestedScopes
      .filter((scope) => !supportedScopes.has(scope))
      .map((scope) => `unsupported_scope:${scope}`),
  ];

  diagnostics.push({
    code: "live_oauth_blocked",
    path: requestPath,
    message: "OAuth request is modeled only; live OAuth remains blocked.",
    severity: "block",
  });

  return {
    requestIntentId: request.requestIntentId,
    provider: request.provider,
    accountRefId: request.accountRefId,
    requestedScopeCount: request.requestedScopes.length,
    missingScopes,
    callbackExpectationId: callbackExpectation.callbackExpectationId,
    modeledRequestValid: validation.valid && callbackValidation.valid,
    callbackExpectationValid: callbackValidation.valid,
    liveOAuthBlocked: true,
    realRedirectBlocked: true,
    realCallbackBlocked: true,
    blockingReasons: unique(blockingReasons),
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function projectProviderReadiness(
  projections: readonly SocialPlatformOAuthRequestProjection[],
  diagnostics: SocialPlatformOAuthRequestReplayDiagnostic[],
): readonly SocialPlatformOAuthProviderRequestReadiness[] {
  const providers: readonly SocialPlatformCredentialProvider[] = ["meta", "tiktok", "linkedin"];
  return providers.map((provider) => {
    let credentialContractId = `missing-${provider}`;
    let oauthContractId = `missing-${provider}`;
    try {
      credentialContractId = createSocialPlatformCredentialBoundaryContract(provider).identity.boundaryId;
      oauthContractId = createSocialPlatformOAuthBoundaryContract(provider).identity.boundaryId;
    } catch {
      diagnostics.push({
        code: "provider_contract_missing",
        path: `providerReadiness.${provider}`,
        message: "Credential or OAuth boundary contract could not be resolved for provider.",
        severity: "warning",
      });
    }

    const providerRequests = projections.filter((request) => request.provider === provider);
    const invalidRequestCount = providerRequests.filter((request) => !request.modeledRequestValid).length;

    return {
      provider,
      credentialContractId,
      oauthContractId,
      supportedScopes: [...oauthScopesForProvider(provider)],
      modeledRequestCount: providerRequests.length,
      invalidRequestCount,
      liveOAuthBlocked: true,
      credentialStorageBlocked: true,
      networkBlocked: true,
      executionCapable: false,
      blockingReasons: [
        "live_oauth_blocked",
        "credential_storage_blocked",
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
  code: SocialPlatformOAuthRequestReplayDiagnosticCode,
  diagnostics: readonly SocialPlatformOAuthRequestDiagnostic[],
): readonly SocialPlatformOAuthRequestReplayDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    code,
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
