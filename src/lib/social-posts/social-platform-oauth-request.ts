import {
  SOCIAL_PLATFORM_OAUTH_BOUNDARY_VERSION,
  isSocialPlatformOAuthScope,
  oauthScopesForProvider,
  type SocialPlatformOAuthScope,
} from "./social-platform-oauth-boundary";
import {
  SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
  isSocialPlatformCredentialProvider,
  type SocialPlatformCredentialProvider,
} from "./social-platform-credential-boundary";

export const SOCIAL_PLATFORM_OAUTH_REQUEST_VERSION = "d12-m1-v1" as const;

export const SOCIAL_PLATFORM_OAUTH_REQUEST_INTENT_KINDS = [
  "authorize_account",
  "reauthorize_account",
  "verify_scopes",
] as const;

export const SOCIAL_PLATFORM_OAUTH_CALLBACK_EXPECTATION_STATES = [
  "not_expected",
  "expected_reference",
  "received_reference",
  "expired_reference",
  "mismatch_reference",
] as const;

export const SOCIAL_PLATFORM_OAUTH_REQUEST_DIAGNOSTIC_CODES = [
  "provider_unknown",
  "request_intent_kind_unknown",
  "callback_expectation_state_unknown",
  "request_intent_id_required",
  "callback_expectation_id_required",
  "account_ref_id_required",
  "oauth_state_ref_id_required",
  "requested_scope_required",
  "oauth_scope_unknown",
  "oauth_scope_provider_mismatch",
  "redirect_uri_reference_required",
  "redirect_uri_forbidden_url",
  "callback_reference_forbidden_url",
  "timestamp_invalid",
  "secret_forbidden",
  "token_forbidden",
  "authorization_code_forbidden",
  "network_forbidden",
  "oauth_execution_forbidden",
  "contract_invariant_failed",
  "serialization_invalid",
  "safety_requirements_invalid",
] as const;

export type SocialPlatformOAuthRequestIntentKind =
  (typeof SOCIAL_PLATFORM_OAUTH_REQUEST_INTENT_KINDS)[number];

export type SocialPlatformOAuthCallbackExpectationState =
  (typeof SOCIAL_PLATFORM_OAUTH_CALLBACK_EXPECTATION_STATES)[number];

export type SocialPlatformOAuthRequestDiagnosticCode =
  (typeof SOCIAL_PLATFORM_OAUTH_REQUEST_DIAGNOSTIC_CODES)[number];

export type SocialPlatformOAuthRequestDiagnostic = Readonly<{
  code: SocialPlatformOAuthRequestDiagnosticCode;
  path: string;
  message: string;
  severity: "block" | "error" | "warning";
}>;

export type SocialPlatformOAuthRequestValidationResult = Readonly<{
  valid: boolean;
  diagnostics: readonly SocialPlatformOAuthRequestDiagnostic[];
}>;

export type SocialPlatformOAuthCallbackExpectation = Readonly<{
  callbackExpectationId: string;
  provider: SocialPlatformCredentialProvider;
  accountRefId: string;
  oauthStateRefId: string;
  redirectUriReference: string;
  callbackReference: string | null;
  expectationState: SocialPlatformOAuthCallbackExpectationState;
  expiresAt: string | null;
  modeledOnly: true;
  referencesOnly: true;
  secretless: true;
  containsAuthorizationCode: false;
  containsAccessToken: false;
  containsRefreshToken: false;
  containsSecretValue: false;
  callsNoExternalApis: true;
  usesNoNetwork: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformOAuthAuthorizationRequestIntent = Readonly<{
  requestIntentId: string;
  requestVersion: typeof SOCIAL_PLATFORM_OAUTH_REQUEST_VERSION;
  oauthBoundaryVersion: typeof SOCIAL_PLATFORM_OAUTH_BOUNDARY_VERSION;
  credentialBoundaryVersion: typeof SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION;
  provider: SocialPlatformCredentialProvider;
  accountRefId: string;
  intentKind: SocialPlatformOAuthRequestIntentKind;
  requestedScopes: readonly SocialPlatformOAuthScope[];
  oauthStateRefId: string;
  redirectUriReference: string;
  callbackExpectation: SocialPlatformOAuthCallbackExpectation;
  requestedAt: string | null;
  requestedByActorRef: string | null;
  modeledOnly: true;
  referencesOnly: true;
  secretless: true;
  liveOAuthBlocked: true;
  realRedirectBlocked: true;
  realCallbackBlocked: true;
  containsClientSecret: false;
  containsAuthorizationCode: false;
  containsAccessToken: false;
  containsRefreshToken: false;
  containsSecretValue: false;
  callsNoExternalApis: true;
  usesNoNetwork: true;
  usesNoSdks: true;
  startsNoWorkers: true;
  startsNoTimers: true;
  createsNoQueues: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformOAuthAuthorizationRequestInput = Readonly<{
  requestIntentId: string;
  provider: SocialPlatformCredentialProvider;
  accountRefId: string;
  intentKind: SocialPlatformOAuthRequestIntentKind;
  requestedScopes: readonly SocialPlatformOAuthScope[];
  oauthStateRefId: string;
  redirectUriReference: string;
  callbackExpectationId: string;
  callbackReference?: string | null;
  callbackExpectationState?: SocialPlatformOAuthCallbackExpectationState;
  requestedAt?: string | null;
  requestedByActorRef?: string | null;
  expiresAt?: string | null;
}>;

const REQUEST_INTENT_KIND_SET = new Set<string>(SOCIAL_PLATFORM_OAUTH_REQUEST_INTENT_KINDS);
const CALLBACK_EXPECTATION_STATE_SET = new Set<string>(
  SOCIAL_PLATFORM_OAUTH_CALLBACK_EXPECTATION_STATES,
);
const FORBIDDEN_SECRET_KEYS = new Set([
  "secret",
  "clientsecret",
  "client_secret",
  "appsecret",
  "app_secret",
  "password",
]);
const FORBIDDEN_TOKEN_KEYS = new Set([
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
]);
const FORBIDDEN_AUTHORIZATION_CODE_KEYS = new Set([
  "code",
  "authorizationcode",
  "authorization_code",
]);

export function createSocialPlatformOAuthAuthorizationRequestIntent(
  input: SocialPlatformOAuthAuthorizationRequestInput,
): SocialPlatformOAuthAuthorizationRequestIntent {
  const callbackExpectation: SocialPlatformOAuthCallbackExpectation = {
    callbackExpectationId: input.callbackExpectationId,
    provider: input.provider,
    accountRefId: input.accountRefId,
    oauthStateRefId: input.oauthStateRefId,
    redirectUriReference: input.redirectUriReference,
    callbackReference: input.callbackReference ?? null,
    expectationState: input.callbackExpectationState ?? "expected_reference",
    expiresAt: input.expiresAt ?? null,
    modeledOnly: true,
    referencesOnly: true,
    secretless: true,
    containsAuthorizationCode: false,
    containsAccessToken: false,
    containsRefreshToken: false,
    containsSecretValue: false,
    callsNoExternalApis: true,
    usesNoNetwork: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };

  return deepFreeze({
    requestIntentId: input.requestIntentId,
    requestVersion: SOCIAL_PLATFORM_OAUTH_REQUEST_VERSION,
    oauthBoundaryVersion: SOCIAL_PLATFORM_OAUTH_BOUNDARY_VERSION,
    credentialBoundaryVersion: SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
    provider: input.provider,
    accountRefId: input.accountRefId,
    intentKind: input.intentKind,
    requestedScopes: [...input.requestedScopes],
    oauthStateRefId: input.oauthStateRefId,
    redirectUriReference: input.redirectUriReference,
    callbackExpectation,
    requestedAt: input.requestedAt ?? null,
    requestedByActorRef: input.requestedByActorRef ?? null,
    modeledOnly: true,
    referencesOnly: true,
    secretless: true,
    liveOAuthBlocked: true,
    realRedirectBlocked: true,
    realCallbackBlocked: true,
    containsClientSecret: false,
    containsAuthorizationCode: false,
    containsAccessToken: false,
    containsRefreshToken: false,
    containsSecretValue: false,
    callsNoExternalApis: true,
    usesNoNetwork: true,
    usesNoSdks: true,
    startsNoWorkers: true,
    startsNoTimers: true,
    createsNoQueues: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
}

export function isSocialPlatformOAuthRequestIntentKind(
  value: unknown,
): value is SocialPlatformOAuthRequestIntentKind {
  return typeof value === "string" && REQUEST_INTENT_KIND_SET.has(value);
}

export function isSocialPlatformOAuthCallbackExpectationState(
  value: unknown,
): value is SocialPlatformOAuthCallbackExpectationState {
  return typeof value === "string" && CALLBACK_EXPECTATION_STATE_SET.has(value);
}

export function validateSocialPlatformOAuthAuthorizationRequestIntent(
  intent: unknown,
  path = "oauthRequestIntent",
): SocialPlatformOAuthRequestValidationResult {
  const diagnostics: SocialPlatformOAuthRequestDiagnostic[] = [];
  if (!isRecord(intent)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", path, "OAuth request intent must be an object."),
      ],
    };
  }

  requireText(intent.requestIntentId, `${path}.requestIntentId`, "request_intent_id_required", diagnostics);
  requireText(intent.accountRefId, `${path}.accountRefId`, "account_ref_id_required", diagnostics);
  requireText(intent.oauthStateRefId, `${path}.oauthStateRefId`, "oauth_state_ref_id_required", diagnostics);
  validateRedirectReference(intent.redirectUriReference, `${path}.redirectUriReference`, diagnostics);

  if (intent.requestVersion !== SOCIAL_PLATFORM_OAUTH_REQUEST_VERSION) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.requestVersion`,
      "OAuth request intent version must match the current D12 contract.",
    ));
  }
  if (intent.oauthBoundaryVersion !== SOCIAL_PLATFORM_OAUTH_BOUNDARY_VERSION) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.oauthBoundaryVersion`,
      "OAuth request intent must reference the current OAuth boundary contract.",
    ));
  }
  if (intent.credentialBoundaryVersion !== SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.credentialBoundaryVersion`,
      "OAuth request intent must reference the current credential boundary contract.",
    ));
  }
  if (!isSocialPlatformCredentialProvider(intent.provider)) {
    diagnostics.push(errorDiagnostic(
      "provider_unknown",
      `${path}.provider`,
      "OAuth request provider is not supported.",
    ));
  }
  if (!isSocialPlatformOAuthRequestIntentKind(intent.intentKind)) {
    diagnostics.push(errorDiagnostic(
      "request_intent_kind_unknown",
      `${path}.intentKind`,
      "OAuth request intent kind is not supported.",
    ));
  }
  validateScopes(intent.provider, intent.requestedScopes, `${path}.requestedScopes`, diagnostics);
  validateNullableTimestamp(intent.requestedAt, `${path}.requestedAt`, diagnostics);
  validateCallbackExpectation(intent.callbackExpectation, `${path}.callbackExpectation`, diagnostics);
  validateRequestSafety(intent, path, diagnostics);
  diagnostics.push(...scanForbiddenPayload(intent, path));

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialPlatformOAuthCallbackExpectation(
  expectation: unknown,
  path = "oauthCallbackExpectation",
): SocialPlatformOAuthRequestValidationResult {
  const diagnostics: SocialPlatformOAuthRequestDiagnostic[] = [];
  validateCallbackExpectation(expectation, path, diagnostics);
  if (isRecord(expectation)) {
    diagnostics.push(...scanForbiddenPayload(expectation, path));
  }
  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function detectSocialPlatformOAuthRequestForbiddenStates(
  intent: unknown,
  path = "oauthRequestIntent",
): SocialPlatformOAuthRequestValidationResult {
  const diagnostics: SocialPlatformOAuthRequestDiagnostic[] = [];
  if (!isRecord(intent)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", path, "OAuth request intent must be an object."));
  } else {
    validateRequestSafety(intent, path, diagnostics);
    diagnostics.push(...scanForbiddenPayload(intent, path));
    if (hasText(intent.redirectUriReference) && looksLikeNetworkUrl(intent.redirectUriReference)) {
      diagnostics.push(blockDiagnostic(
        "network_forbidden",
        `${path}.redirectUriReference`,
        "OAuth request modeling must not contain a live redirect URL.",
      ));
    }
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

export function serializeSocialPlatformOAuthAuthorizationRequestIntent(
  intent: SocialPlatformOAuthAuthorizationRequestIntent,
): string {
  return JSON.stringify(toStableValue(intent));
}

export function hydrateSocialPlatformOAuthAuthorizationRequestIntent(
  serialized: string,
): Readonly<{
  ok: true;
  value: SocialPlatformOAuthAuthorizationRequestIntent;
}> | Readonly<{
  ok: false;
  diagnostics: readonly SocialPlatformOAuthRequestDiagnostic[];
}> {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const validation = validateSocialPlatformOAuthAuthorizationRequestIntent(parsed);
    if (!validation.valid || !isRecord(parsed)) {
      return { ok: false, diagnostics: validation.diagnostics };
    }
    return { ok: true, value: deepFreeze(parsed as SocialPlatformOAuthAuthorizationRequestIntent) };
  } catch {
    return {
      ok: false,
      diagnostics: [
        errorDiagnostic(
          "serialization_invalid",
          "serialized",
          "OAuth request intent serialization must be valid JSON.",
        ),
      ],
    };
  }
}

function validateCallbackExpectation(
  expectation: unknown,
  path: string,
  diagnostics: SocialPlatformOAuthRequestDiagnostic[],
): void {
  if (!isRecord(expectation)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", path, "OAuth callback expectation must be an object."));
    return;
  }

  requireText(
    expectation.callbackExpectationId,
    `${path}.callbackExpectationId`,
    "callback_expectation_id_required",
    diagnostics,
  );
  requireText(expectation.accountRefId, `${path}.accountRefId`, "account_ref_id_required", diagnostics);
  requireText(expectation.oauthStateRefId, `${path}.oauthStateRefId`, "oauth_state_ref_id_required", diagnostics);
  validateRedirectReference(expectation.redirectUriReference, `${path}.redirectUriReference`, diagnostics);
  if (
    expectation.callbackReference !== null &&
    typeof expectation.callbackReference === "string" &&
    looksLikeNetworkUrl(expectation.callbackReference)
  ) {
    diagnostics.push(errorDiagnostic(
      "callback_reference_forbidden_url",
      `${path}.callbackReference`,
      "OAuth callback expectation must use internal references, not network URLs.",
    ));
  }
  if (!isSocialPlatformCredentialProvider(expectation.provider)) {
    diagnostics.push(errorDiagnostic(
      "provider_unknown",
      `${path}.provider`,
      "OAuth callback provider is not supported.",
    ));
  }
  if (!isSocialPlatformOAuthCallbackExpectationState(expectation.expectationState)) {
    diagnostics.push(errorDiagnostic(
      "callback_expectation_state_unknown",
      `${path}.expectationState`,
      "OAuth callback expectation state is not supported.",
    ));
  }
  validateNullableTimestamp(expectation.expiresAt, `${path}.expiresAt`, diagnostics);
  if (
    expectation.modeledOnly !== true ||
    expectation.referencesOnly !== true ||
    expectation.secretless !== true ||
    expectation.containsAuthorizationCode !== false ||
    expectation.containsAccessToken !== false ||
    expectation.containsRefreshToken !== false ||
    expectation.containsSecretValue !== false ||
    expectation.callsNoExternalApis !== true ||
    expectation.usesNoNetwork !== true ||
    expectation.grantsExecutionPermission !== false ||
    expectation.executesNothing !== true ||
    expectation.publishesNothing !== true
  ) {
    diagnostics.push(errorDiagnostic(
      "safety_requirements_invalid",
      path,
      "OAuth callback expectation must remain secretless, reference-only, and non-executing.",
    ));
  }
}

function validateScopes(
  provider: unknown,
  scopes: unknown,
  path: string,
  diagnostics: SocialPlatformOAuthRequestDiagnostic[],
): void {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    diagnostics.push(errorDiagnostic(
      "requested_scope_required",
      path,
      "OAuth request intent requires at least one modeled scope.",
    ));
    return;
  }

  const providerScopes = isSocialPlatformCredentialProvider(provider)
    ? new Set(oauthScopesForProvider(provider))
    : null;
  scopes.forEach((scope, index) => {
    if (!isSocialPlatformOAuthScope(scope)) {
      diagnostics.push(errorDiagnostic(
        "oauth_scope_unknown",
        `${path}.${index}`,
        "OAuth request scope is not supported.",
      ));
      return;
    }
    if (providerScopes && !providerScopes.has(scope)) {
      diagnostics.push(errorDiagnostic(
        "oauth_scope_provider_mismatch",
        `${path}.${index}`,
        "OAuth request scope is not supported by the selected provider.",
      ));
    }
  });
}

function validateRequestSafety(
  intent: UnknownRecord,
  path: string,
  diagnostics: SocialPlatformOAuthRequestDiagnostic[],
): void {
  if (
    intent.modeledOnly !== true ||
    intent.referencesOnly !== true ||
    intent.secretless !== true ||
    intent.liveOAuthBlocked !== true ||
    intent.realRedirectBlocked !== true ||
    intent.realCallbackBlocked !== true ||
    intent.containsClientSecret !== false ||
    intent.containsAuthorizationCode !== false ||
    intent.containsAccessToken !== false ||
    intent.containsRefreshToken !== false ||
    intent.containsSecretValue !== false ||
    intent.callsNoExternalApis !== true ||
    intent.usesNoNetwork !== true ||
    intent.usesNoSdks !== true ||
    intent.startsNoWorkers !== true ||
    intent.startsNoTimers !== true ||
    intent.createsNoQueues !== true ||
    intent.grantsExecutionPermission !== false ||
    intent.executesNothing !== true ||
    intent.publishesNothing !== true
  ) {
    diagnostics.push(errorDiagnostic(
      "safety_requirements_invalid",
      path,
      "OAuth request intent must remain secretless, modeled-only, blocked, and non-executing.",
    ));
  }
}

function validateRedirectReference(
  value: unknown,
  path: string,
  diagnostics: SocialPlatformOAuthRequestDiagnostic[],
): void {
  if (!hasText(value)) {
    diagnostics.push(errorDiagnostic(
      "redirect_uri_reference_required",
      path,
      "OAuth request modeling requires an internal redirect URI reference.",
    ));
    return;
  }
  if (looksLikeNetworkUrl(value)) {
    diagnostics.push(errorDiagnostic(
      "redirect_uri_forbidden_url",
      path,
      "OAuth redirect URI must use an internal reference, not a network URL.",
    ));
  }
}

function validateNullableTimestamp(
  value: unknown,
  path: string,
  diagnostics: SocialPlatformOAuthRequestDiagnostic[],
): void {
  if (value === null) return;
  if (!hasText(value) || Number.isNaN(Date.parse(value))) {
    diagnostics.push(errorDiagnostic(
      "timestamp_invalid",
      path,
      "OAuth request timestamp must be null or an ISO-parseable string.",
    ));
  }
}

function requireText(
  value: unknown,
  path: string,
  code: SocialPlatformOAuthRequestDiagnosticCode,
  diagnostics: SocialPlatformOAuthRequestDiagnostic[],
): void {
  if (hasText(value)) return;
  diagnostics.push(errorDiagnostic(code, path, "Required OAuth request text field is missing."));
}

function scanForbiddenPayload(
  value: unknown,
  path: string,
): readonly SocialPlatformOAuthRequestDiagnostic[] {
  const diagnostics: SocialPlatformOAuthRequestDiagnostic[] = [];
  scanForbiddenPayloadInner(value, path, diagnostics, new Set<unknown>());
  return diagnostics;
}

function scanForbiddenPayloadInner(
  value: unknown,
  path: string,
  diagnostics: SocialPlatformOAuthRequestDiagnostic[],
  seen: Set<unknown>,
): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbiddenPayloadInner(item, `${path}.${index}`, diagnostics, seen));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase().replace(/[^a-z_]/g, "");
    if (FORBIDDEN_SECRET_KEYS.has(normalized)) {
      diagnostics.push(errorDiagnostic(
        "secret_forbidden",
        `${path}.${key}`,
        "OAuth request modeling must not contain client secrets or secret values.",
      ));
    } else if (FORBIDDEN_TOKEN_KEYS.has(normalized)) {
      diagnostics.push(errorDiagnostic(
        "token_forbidden",
        `${path}.${key}`,
        "OAuth request modeling must not contain access or refresh token values.",
      ));
    } else if (FORBIDDEN_AUTHORIZATION_CODE_KEYS.has(normalized)) {
      diagnostics.push(errorDiagnostic(
        "authorization_code_forbidden",
        `${path}.${key}`,
        "OAuth request modeling must not contain authorization code values.",
      ));
    }
    scanForbiddenPayloadInner(nestedValue, `${path}.${key}`, diagnostics, seen);
  }
}

function errorDiagnostic(
  code: SocialPlatformOAuthRequestDiagnosticCode,
  path: string,
  message: string,
): SocialPlatformOAuthRequestDiagnostic {
  return { code, path, message, severity: "error" };
}

function blockDiagnostic(
  code: SocialPlatformOAuthRequestDiagnosticCode,
  path: string,
  message: string,
): SocialPlatformOAuthRequestDiagnostic {
  return { code, path, message, severity: "block" };
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function looksLikeNetworkUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
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
