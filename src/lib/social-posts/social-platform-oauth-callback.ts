import {
  SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
  isSocialPlatformCredentialProvider,
  type SocialPlatformCredentialProvider,
} from "./social-platform-credential-boundary";
import { SOCIAL_PLATFORM_OAUTH_BOUNDARY_VERSION } from "./social-platform-oauth-boundary";
import {
  SOCIAL_PLATFORM_OAUTH_REQUEST_VERSION,
  validateSocialPlatformOAuthCallbackExpectation,
  type SocialPlatformOAuthCallbackExpectation,
} from "./social-platform-oauth-request";

export const SOCIAL_PLATFORM_OAUTH_CALLBACK_VERSION = "d12-m2-v1" as const;

export const SOCIAL_PLATFORM_OAUTH_CALLBACK_OUTCOME_KINDS = [
  "success_intent_modeled",
  "denied_by_user",
  "canceled_by_user",
  "provider_error_reference",
  "state_mismatch_reference",
  "expired_reference",
] as const;

export const SOCIAL_PLATFORM_OAUTH_CALLBACK_DIAGNOSTIC_CODES = [
  "provider_unknown",
  "callback_outcome_kind_unknown",
  "callback_result_id_required",
  "callback_expectation_id_required",
  "account_ref_id_required",
  "oauth_state_ref_id_required",
  "provider_error_ref_required",
  "timestamp_invalid",
  "provider_mismatch",
  "account_mismatch",
  "oauth_state_mismatch",
  "callback_expectation_invalid",
  "secret_forbidden",
  "token_forbidden",
  "authorization_code_forbidden",
  "network_forbidden",
  "callback_route_forbidden",
  "credential_exchange_forbidden",
  "contract_invariant_failed",
  "serialization_invalid",
  "safety_requirements_invalid",
] as const;

export type SocialPlatformOAuthCallbackOutcomeKind =
  (typeof SOCIAL_PLATFORM_OAUTH_CALLBACK_OUTCOME_KINDS)[number];

export type SocialPlatformOAuthCallbackDiagnosticCode =
  (typeof SOCIAL_PLATFORM_OAUTH_CALLBACK_DIAGNOSTIC_CODES)[number];

export type SocialPlatformOAuthCallbackDiagnostic = Readonly<{
  code: SocialPlatformOAuthCallbackDiagnosticCode;
  path: string;
  message: string;
  severity: "block" | "error" | "warning";
}>;

export type SocialPlatformOAuthCallbackValidationResult = Readonly<{
  valid: boolean;
  diagnostics: readonly SocialPlatformOAuthCallbackDiagnostic[];
}>;

export type SocialPlatformOAuthCallbackOutcome = Readonly<{
  callbackResultId: string;
  callbackVersion: typeof SOCIAL_PLATFORM_OAUTH_CALLBACK_VERSION;
  requestVersion: typeof SOCIAL_PLATFORM_OAUTH_REQUEST_VERSION;
  oauthBoundaryVersion: typeof SOCIAL_PLATFORM_OAUTH_BOUNDARY_VERSION;
  credentialBoundaryVersion: typeof SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION;
  callbackExpectationId: string;
  provider: SocialPlatformCredentialProvider;
  accountRefId: string;
  oauthStateRefId: string;
  outcomeKind: SocialPlatformOAuthCallbackOutcomeKind;
  providerErrorRef: string | null;
  providerErrorDescriptionRef: string | null;
  receivedAt: string | null;
  modeledOnly: true;
  referencesOnly: true;
  secretless: true;
  successIntentOnly: true;
  containsAuthorizationCode: false;
  containsAccessToken: false;
  containsRefreshToken: false;
  containsTokenValue: false;
  containsSecretValue: false;
  receivedNoCredentials: true;
  exchangedNoCredentials: true;
  storedNoCredentials: true;
  storesNoSecrets: true;
  storesNoTokens: true;
  callsNoExternalApis: true;
  usesNoNetwork: true;
  usesNoSdks: true;
  exposesNoCallbackRoute: true;
  startsNoWorkers: true;
  startsNoTimers: true;
  createsNoQueues: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformOAuthCallbackOutcomeInput = Readonly<{
  callbackResultId: string;
  callbackExpectation: SocialPlatformOAuthCallbackExpectation;
  outcomeKind: SocialPlatformOAuthCallbackOutcomeKind;
  providerErrorRef?: string | null;
  providerErrorDescriptionRef?: string | null;
  receivedAt?: string | null;
}>;

const CALLBACK_OUTCOME_KIND_SET = new Set<string>(
  SOCIAL_PLATFORM_OAUTH_CALLBACK_OUTCOME_KINDS,
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
  "oauthcode",
  "oauth_code",
]);

export function createSocialPlatformOAuthCallbackOutcome(
  input: SocialPlatformOAuthCallbackOutcomeInput,
): SocialPlatformOAuthCallbackOutcome {
  return deepFreeze({
    callbackResultId: input.callbackResultId,
    callbackVersion: SOCIAL_PLATFORM_OAUTH_CALLBACK_VERSION,
    requestVersion: SOCIAL_PLATFORM_OAUTH_REQUEST_VERSION,
    oauthBoundaryVersion: SOCIAL_PLATFORM_OAUTH_BOUNDARY_VERSION,
    credentialBoundaryVersion: SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
    callbackExpectationId: input.callbackExpectation.callbackExpectationId,
    provider: input.callbackExpectation.provider,
    accountRefId: input.callbackExpectation.accountRefId,
    oauthStateRefId: input.callbackExpectation.oauthStateRefId,
    outcomeKind: input.outcomeKind,
    providerErrorRef: input.providerErrorRef ?? null,
    providerErrorDescriptionRef: input.providerErrorDescriptionRef ?? null,
    receivedAt: input.receivedAt ?? null,
    modeledOnly: true,
    referencesOnly: true,
    secretless: true,
    successIntentOnly: true,
    containsAuthorizationCode: false,
    containsAccessToken: false,
    containsRefreshToken: false,
    containsTokenValue: false,
    containsSecretValue: false,
    receivedNoCredentials: true,
    exchangedNoCredentials: true,
    storedNoCredentials: true,
    storesNoSecrets: true,
    storesNoTokens: true,
    callsNoExternalApis: true,
    usesNoNetwork: true,
    usesNoSdks: true,
    exposesNoCallbackRoute: true,
    startsNoWorkers: true,
    startsNoTimers: true,
    createsNoQueues: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
}

export function isSocialPlatformOAuthCallbackOutcomeKind(
  value: unknown,
): value is SocialPlatformOAuthCallbackOutcomeKind {
  return typeof value === "string" && CALLBACK_OUTCOME_KIND_SET.has(value);
}

export function validateSocialPlatformOAuthCallbackOutcome(
  outcome: unknown,
  expectation: SocialPlatformOAuthCallbackExpectation | null = null,
  path = "oauthCallbackOutcome",
): SocialPlatformOAuthCallbackValidationResult {
  const diagnostics: SocialPlatformOAuthCallbackDiagnostic[] = [];
  if (!isRecord(outcome)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", path, "OAuth callback outcome must be an object."),
      ],
    };
  }

  requireText(outcome.callbackResultId, `${path}.callbackResultId`, "callback_result_id_required", diagnostics);
  requireText(
    outcome.callbackExpectationId,
    `${path}.callbackExpectationId`,
    "callback_expectation_id_required",
    diagnostics,
  );
  requireText(outcome.accountRefId, `${path}.accountRefId`, "account_ref_id_required", diagnostics);
  requireText(outcome.oauthStateRefId, `${path}.oauthStateRefId`, "oauth_state_ref_id_required", diagnostics);

  if (outcome.callbackVersion !== SOCIAL_PLATFORM_OAUTH_CALLBACK_VERSION) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.callbackVersion`,
      "OAuth callback outcome version must match the current D12 callback contract.",
    ));
  }
  if (outcome.requestVersion !== SOCIAL_PLATFORM_OAUTH_REQUEST_VERSION) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.requestVersion`,
      "OAuth callback outcome must reference the current D12 request contract.",
    ));
  }
  if (outcome.oauthBoundaryVersion !== SOCIAL_PLATFORM_OAUTH_BOUNDARY_VERSION) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.oauthBoundaryVersion`,
      "OAuth callback outcome must reference the current OAuth boundary contract.",
    ));
  }
  if (outcome.credentialBoundaryVersion !== SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.credentialBoundaryVersion`,
      "OAuth callback outcome must reference the current credential boundary contract.",
    ));
  }
  if (!isSocialPlatformCredentialProvider(outcome.provider)) {
    diagnostics.push(errorDiagnostic(
      "provider_unknown",
      `${path}.provider`,
      "OAuth callback outcome provider is not supported.",
    ));
  }
  if (!isSocialPlatformOAuthCallbackOutcomeKind(outcome.outcomeKind)) {
    diagnostics.push(errorDiagnostic(
      "callback_outcome_kind_unknown",
      `${path}.outcomeKind`,
      "OAuth callback outcome kind is not supported.",
    ));
  }
  if (
    outcome.outcomeKind === "provider_error_reference" &&
    !hasText(outcome.providerErrorRef)
  ) {
    diagnostics.push(errorDiagnostic(
      "provider_error_ref_required",
      `${path}.providerErrorRef`,
      "Provider error callback outcomes require a redacted provider error reference.",
    ));
  }

  validateNullableTimestamp(outcome.receivedAt, `${path}.receivedAt`, diagnostics);
  validateOutcomeSafety(outcome, path, diagnostics);
  diagnostics.push(...scanForbiddenPayload(outcome, path));

  if (expectation) {
    const expectationValidation = validateSocialPlatformOAuthCallbackExpectation(
      expectation,
      "oauthCallbackExpectation",
    );
    for (const diagnostic of expectationValidation.diagnostics) {
      diagnostics.push({
        code: "callback_expectation_invalid",
        path: diagnostic.path,
        message: diagnostic.message,
        severity: diagnostic.severity,
      });
    }
    validateExpectationMatch(outcome, expectation, path, diagnostics);
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function detectSocialPlatformOAuthCallbackForbiddenStates(
  outcome: unknown,
  path = "oauthCallbackOutcome",
): SocialPlatformOAuthCallbackValidationResult {
  const diagnostics: SocialPlatformOAuthCallbackDiagnostic[] = [];
  if (!isRecord(outcome)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", path, "OAuth callback outcome must be an object."));
  } else {
    validateOutcomeSafety(outcome, path, diagnostics);
    diagnostics.push(...scanForbiddenPayload(outcome, path));
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

export function serializeSocialPlatformOAuthCallbackOutcome(
  outcome: SocialPlatformOAuthCallbackOutcome,
): string {
  return JSON.stringify(toStableValue(outcome));
}

export function hydrateSocialPlatformOAuthCallbackOutcome(
  serialized: string,
): Readonly<{
  ok: true;
  value: SocialPlatformOAuthCallbackOutcome;
}> | Readonly<{
  ok: false;
  diagnostics: readonly SocialPlatformOAuthCallbackDiagnostic[];
}> {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const validation = validateSocialPlatformOAuthCallbackOutcome(parsed);
    if (!validation.valid || !isRecord(parsed)) {
      return { ok: false, diagnostics: validation.diagnostics };
    }
    return { ok: true, value: deepFreeze(parsed as SocialPlatformOAuthCallbackOutcome) };
  } catch {
    return {
      ok: false,
      diagnostics: [
        errorDiagnostic(
          "serialization_invalid",
          "serialized",
          "OAuth callback outcome serialization must be valid JSON.",
        ),
      ],
    };
  }
}

function validateExpectationMatch(
  outcome: UnknownRecord,
  expectation: SocialPlatformOAuthCallbackExpectation,
  path: string,
  diagnostics: SocialPlatformOAuthCallbackDiagnostic[],
): void {
  if (outcome.callbackExpectationId !== expectation.callbackExpectationId) {
    diagnostics.push(errorDiagnostic(
      "callback_expectation_invalid",
      `${path}.callbackExpectationId`,
      "OAuth callback outcome must reference the modeled callback expectation.",
    ));
  }
  if (outcome.provider !== expectation.provider) {
    diagnostics.push(errorDiagnostic(
      "provider_mismatch",
      `${path}.provider`,
      "OAuth callback outcome provider must match the callback expectation provider.",
    ));
  }
  if (outcome.accountRefId !== expectation.accountRefId) {
    diagnostics.push(errorDiagnostic(
      "account_mismatch",
      `${path}.accountRefId`,
      "OAuth callback outcome account reference must match the callback expectation account reference.",
    ));
  }
  if (outcome.oauthStateRefId !== expectation.oauthStateRefId) {
    diagnostics.push(errorDiagnostic(
      "oauth_state_mismatch",
      `${path}.oauthStateRefId`,
      "OAuth callback outcome state reference must match the callback expectation state reference.",
    ));
  }
}

function validateOutcomeSafety(
  outcome: UnknownRecord,
  path: string,
  diagnostics: SocialPlatformOAuthCallbackDiagnostic[],
): void {
  if (
    outcome.modeledOnly !== true ||
    outcome.referencesOnly !== true ||
    outcome.secretless !== true ||
    outcome.successIntentOnly !== true ||
    outcome.containsAuthorizationCode !== false ||
    outcome.containsAccessToken !== false ||
    outcome.containsRefreshToken !== false ||
    outcome.containsTokenValue !== false ||
    outcome.containsSecretValue !== false ||
    outcome.receivedNoCredentials !== true ||
    outcome.exchangedNoCredentials !== true ||
    outcome.storedNoCredentials !== true ||
    outcome.storesNoSecrets !== true ||
    outcome.storesNoTokens !== true ||
    outcome.callsNoExternalApis !== true ||
    outcome.usesNoNetwork !== true ||
    outcome.usesNoSdks !== true ||
    outcome.exposesNoCallbackRoute !== true ||
    outcome.startsNoWorkers !== true ||
    outcome.startsNoTimers !== true ||
    outcome.createsNoQueues !== true ||
    outcome.grantsExecutionPermission !== false ||
    outcome.executesNothing !== true ||
    outcome.publishesNothing !== true
  ) {
    diagnostics.push(errorDiagnostic(
      "safety_requirements_invalid",
      path,
      "OAuth callback outcome must remain secretless, reference-only, route-free, and non-executing.",
    ));
  }
}

function validateNullableTimestamp(
  value: unknown,
  path: string,
  diagnostics: SocialPlatformOAuthCallbackDiagnostic[],
): void {
  if (value === null) return;
  if (!hasText(value) || Number.isNaN(Date.parse(value))) {
    diagnostics.push(errorDiagnostic(
      "timestamp_invalid",
      path,
      "OAuth callback timestamp must be null or an ISO-parseable string.",
    ));
  }
}

function requireText(
  value: unknown,
  path: string,
  code: SocialPlatformOAuthCallbackDiagnosticCode,
  diagnostics: SocialPlatformOAuthCallbackDiagnostic[],
): void {
  if (hasText(value)) return;
  diagnostics.push(errorDiagnostic(code, path, "Required OAuth callback text field is missing."));
}

function scanForbiddenPayload(
  value: unknown,
  path: string,
): readonly SocialPlatformOAuthCallbackDiagnostic[] {
  const diagnostics: SocialPlatformOAuthCallbackDiagnostic[] = [];
  scanForbiddenPayloadInner(value, path, diagnostics, new Set<unknown>());
  return diagnostics;
}

function scanForbiddenPayloadInner(
  value: unknown,
  path: string,
  diagnostics: SocialPlatformOAuthCallbackDiagnostic[],
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
        "OAuth callback modeling must not contain client secrets or secret values.",
      ));
    } else if (FORBIDDEN_TOKEN_KEYS.has(normalized)) {
      diagnostics.push(errorDiagnostic(
        "token_forbidden",
        `${path}.${key}`,
        "OAuth callback modeling must not contain access or refresh token values.",
      ));
    } else if (FORBIDDEN_AUTHORIZATION_CODE_KEYS.has(normalized)) {
      diagnostics.push(errorDiagnostic(
        "authorization_code_forbidden",
        `${path}.${key}`,
        "OAuth callback modeling must not contain authorization code values.",
      ));
    }
    scanForbiddenPayloadInner(nestedValue, `${path}.${key}`, diagnostics, seen);
  }
}

function errorDiagnostic(
  code: SocialPlatformOAuthCallbackDiagnosticCode,
  path: string,
  message: string,
): SocialPlatformOAuthCallbackDiagnostic {
  return { code, path, message, severity: "error" };
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
