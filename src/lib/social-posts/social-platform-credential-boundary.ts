import {
  SOCIAL_PLATFORM_ADAPTER_PLATFORMS,
  type SocialPlatformAdapterPlatform,
} from "./social-platform-adapter-registry";

export const SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION = "d11-m7-v1" as const;

export const SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS = [
  "meta",
  "tiktok",
  "linkedin",
] as const;

export const SOCIAL_PLATFORM_CREDENTIAL_KINDS = [
  "oauth_token_ref",
  "oauth_refresh_ref",
  "app_secret_ref",
  "page_access_ref",
  "business_account_ref",
] as const;

export const SOCIAL_PLATFORM_AUTHORIZATION_STATES = [
  "not_authorized",
  "authorized_reference",
  "expired_reference",
  "revoked_reference",
  "scope_insufficient",
] as const;

export const SOCIAL_PLATFORM_CREDENTIAL_CAPABILITY_FLAGS = [
  "credential_reference_only",
  "oauth_flow_blocked",
  "token_storage_blocked",
  "secret_storage_blocked",
  "encryption_blocked",
  "network_blocked",
  "execution_blocked",
  "live_oauth_blocked",
  "live_credentials_blocked",
] as const;

export const SOCIAL_PLATFORM_CREDENTIAL_ERROR_CODES = [
  "provider_unknown",
  "credential_kind_unknown",
  "authorization_state_unknown",
  "credential_ref_id_required",
  "account_ref_id_required",
  "redacted_hint_required",
  "redacted_hint_forbidden_secret",
  "platform_provider_mismatch",
  "authorization_state_invalid",
  "contract_invariant_failed",
  "secret_forbidden",
  "token_forbidden",
  "oauth_flow_forbidden",
  "network_forbidden",
  "serialization_invalid",
  "capabilities_invalid",
  "safety_requirements_invalid",
] as const;

export type SocialPlatformCredentialProvider =
  (typeof SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS)[number];

export type SocialPlatformCredentialKind =
  (typeof SOCIAL_PLATFORM_CREDENTIAL_KINDS)[number];

export type SocialPlatformAuthorizationState =
  (typeof SOCIAL_PLATFORM_AUTHORIZATION_STATES)[number];

export type SocialPlatformCredentialCapabilityFlag =
  (typeof SOCIAL_PLATFORM_CREDENTIAL_CAPABILITY_FLAGS)[number];

export type SocialPlatformCredentialErrorCode =
  (typeof SOCIAL_PLATFORM_CREDENTIAL_ERROR_CODES)[number];

export type SocialPlatformCredentialDiagnostic = Readonly<{
  code: SocialPlatformCredentialErrorCode;
  path: string;
  message: string;
  severity: "block" | "error" | "warning";
}>;

export type SocialPlatformCredentialValidationResult = Readonly<{
  valid: boolean;
  diagnostics: readonly SocialPlatformCredentialDiagnostic[];
}>;

export type SocialPlatformRedactedCredentialReference = Readonly<{
  credentialRefId: string;
  provider: SocialPlatformCredentialProvider;
  credentialKind: SocialPlatformCredentialKind;
  accountRefId: string;
  redactedHint: string;
  platform: SocialPlatformAdapterPlatform | null;
  referencesOnly: true;
  containsSecretValue: false;
  containsTokenValue: false;
  containsRefreshToken: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformAccountAuthorizationState = Readonly<{
  accountRefId: string;
  provider: SocialPlatformCredentialProvider;
  platform: SocialPlatformAdapterPlatform | null;
  authorizationState: SocialPlatformAuthorizationState;
  requiredCredentialKinds: readonly SocialPlatformCredentialKind[];
  satisfiedCredentialRefIds: readonly string[];
  missingCredentialKinds: readonly SocialPlatformCredentialKind[];
  modeledOnly: true;
  referencesOnly: true;
  containsCredentials: false;
  containsOAuthTokens: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformCredentialBoundaryCapabilities = Readonly<{
  supportedProviders: readonly SocialPlatformCredentialProvider[];
  supportedCredentialKinds: readonly SocialPlatformCredentialKind[];
  supportedAuthorizationStates: readonly SocialPlatformAuthorizationState[];
  capabilityFlags: readonly SocialPlatformCredentialCapabilityFlag[];
  allowsLiveOAuth: false;
  allowsLiveCredentials: false;
  allowsTokenStorage: false;
  allowsSecretStorage: false;
  allowsEncryption: false;
  allowsNetwork: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformCredentialBoundarySafetyRequirements = Readonly<{
  contractOnly: true;
  modelAuthorityOnly: true;
  referencesOnly: true;
  callsNoExternalApis: true;
  usesNoSdks: true;
  usesNoNetwork: true;
  usesNoOAuth: true;
  usesNoCredentials: true;
  storesNoSecrets: true;
  storesNoTokens: true;
  startsNoWorkers: true;
  startsNoTimers: true;
  createsNoQueues: true;
  exposesNoApiRoutes: true;
  exposesNoAdminUi: true;
  mutatesNoSql: true;
  mutatesNoStorage: true;
  mutatesNoLowerLayers: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformCredentialBoundaryIdentity = Readonly<{
  boundaryId: string;
  boundaryVersion: typeof SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION;
  displayName: string;
  layer: "credential_boundary";
  contractOnly: true;
  implementsNothing: true;
  containsCredentials: false;
  containsOAuthFlow: false;
  containsNetworkClient: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformCredentialBoundaryContract = Readonly<{
  identity: SocialPlatformCredentialBoundaryIdentity;
  capabilities: SocialPlatformCredentialBoundaryCapabilities;
  safety: SocialPlatformCredentialBoundarySafetyRequirements;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

const PROVIDER_SET = new Set<string>(SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS);
const CREDENTIAL_KIND_SET = new Set<string>(SOCIAL_PLATFORM_CREDENTIAL_KINDS);
const AUTHORIZATION_STATE_SET = new Set<string>(SOCIAL_PLATFORM_AUTHORIZATION_STATES);
const PLATFORM_SET = new Set<string>(SOCIAL_PLATFORM_ADAPTER_PLATFORMS);

const PLATFORM_PROVIDER: Readonly<
  Record<SocialPlatformAdapterPlatform, SocialPlatformCredentialProvider>
> = {
  facebook: "meta",
  instagram: "meta",
  tiktok: "tiktok",
  linkedin: "linkedin",
};

const PROVIDER_PLATFORMS: Readonly<
  Record<SocialPlatformCredentialProvider, readonly SocialPlatformAdapterPlatform[]>
> = {
  meta: ["facebook", "instagram"],
  tiktok: ["tiktok"],
  linkedin: ["linkedin"],
};

const PROVIDER_REQUIRED_CREDENTIAL_KINDS: Readonly<
  Record<SocialPlatformCredentialProvider, readonly SocialPlatformCredentialKind[]>
> = {
  meta: ["oauth_token_ref", "page_access_ref", "business_account_ref"],
  tiktok: ["oauth_token_ref", "business_account_ref"],
  linkedin: ["oauth_token_ref", "page_access_ref"],
};

const SHARED_CAPABILITY_FLAGS: readonly SocialPlatformCredentialCapabilityFlag[] = [
  "credential_reference_only",
  "oauth_flow_blocked",
  "token_storage_blocked",
  "secret_storage_blocked",
  "encryption_blocked",
  "network_blocked",
  "execution_blocked",
  "live_oauth_blocked",
  "live_credentials_blocked",
];

const SHARED_SAFETY: SocialPlatformCredentialBoundarySafetyRequirements = {
  contractOnly: true,
  modelAuthorityOnly: true,
  referencesOnly: true,
  callsNoExternalApis: true,
  usesNoSdks: true,
  usesNoNetwork: true,
  usesNoOAuth: true,
  usesNoCredentials: true,
  storesNoSecrets: true,
  storesNoTokens: true,
  startsNoWorkers: true,
  startsNoTimers: true,
  createsNoQueues: true,
  exposesNoApiRoutes: true,
  exposesNoAdminUi: true,
  mutatesNoSql: true,
  mutatesNoStorage: true,
  mutatesNoLowerLayers: true,
  recordsNoMetrics: true,
  performsNoLearning: true,
  grantsExecutionPermission: false,
  executesNothing: true,
  publishesNothing: true,
};

function createCredentialBoundaryContract(
  provider: SocialPlatformCredentialProvider,
): SocialPlatformCredentialBoundaryContract {
  return deepFreeze({
    identity: {
      boundaryId: `credential-boundary-${provider}-contract`,
      boundaryVersion: SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
      displayName: `${provider} credential boundary contract`,
      layer: "credential_boundary",
      contractOnly: true,
      implementsNothing: true,
      containsCredentials: false,
      containsOAuthFlow: false,
      containsNetworkClient: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    capabilities: {
      supportedProviders: [provider],
      supportedCredentialKinds: [...PROVIDER_REQUIRED_CREDENTIAL_KINDS[provider]],
      supportedAuthorizationStates: [...SOCIAL_PLATFORM_AUTHORIZATION_STATES],
      capabilityFlags: SHARED_CAPABILITY_FLAGS,
      allowsLiveOAuth: false,
      allowsLiveCredentials: false,
      allowsTokenStorage: false,
      allowsSecretStorage: false,
      allowsEncryption: false,
      allowsNetwork: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    safety: SHARED_SAFETY,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
}

export const SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_CONTRACTS = Object.freeze([
  createCredentialBoundaryContract("meta"),
  createCredentialBoundaryContract("tiktok"),
  createCredentialBoundaryContract("linkedin"),
]);

export function isSocialPlatformCredentialProvider(
  value: unknown,
): value is SocialPlatformCredentialProvider {
  return typeof value === "string" && PROVIDER_SET.has(value);
}

export function isSocialPlatformCredentialKind(
  value: unknown,
): value is SocialPlatformCredentialKind {
  return typeof value === "string" && CREDENTIAL_KIND_SET.has(value);
}

export function isSocialPlatformAuthorizationState(
  value: unknown,
): value is SocialPlatformAuthorizationState {
  return typeof value === "string" && AUTHORIZATION_STATE_SET.has(value);
}

export function isSocialPlatformAdapterPlatformForCredential(
  value: unknown,
): value is SocialPlatformAdapterPlatform {
  return typeof value === "string" && PLATFORM_SET.has(value);
}

export function providerForPlatform(
  platform: SocialPlatformAdapterPlatform,
): SocialPlatformCredentialProvider {
  return PLATFORM_PROVIDER[platform];
}

export function platformsForProvider(
  provider: SocialPlatformCredentialProvider,
): readonly SocialPlatformAdapterPlatform[] {
  return PROVIDER_PLATFORMS[provider];
}

export function createSocialPlatformCredentialBoundaryContract(
  provider: SocialPlatformCredentialProvider,
): SocialPlatformCredentialBoundaryContract {
  const contract = SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_CONTRACTS.find((candidate) =>
    candidate.capabilities.supportedProviders.includes(provider),
  );
  if (!contract) {
    throw new Error(`Credential boundary contract is unavailable for provider: ${provider}`);
  }
  return contract;
}

export function requiredCredentialKindsForProvider(
  provider: SocialPlatformCredentialProvider,
): readonly SocialPlatformCredentialKind[] {
  return PROVIDER_REQUIRED_CREDENTIAL_KINDS[provider];
}

export function computeMissingCredentialKinds(
  provider: SocialPlatformCredentialProvider,
  satisfiedKinds: readonly SocialPlatformCredentialKind[],
): readonly SocialPlatformCredentialKind[] {
  const required = requiredCredentialKindsForProvider(provider);
  const satisfied = new Set(satisfiedKinds);
  return required.filter((kind) => !satisfied.has(kind));
}

export function isAuthorizationStateSufficient(
  state: SocialPlatformAuthorizationState,
): boolean {
  return state === "authorized_reference";
}

export function validateSocialPlatformCredentialBoundaryContract(
  contract: unknown,
): SocialPlatformCredentialValidationResult {
  const diagnostics: SocialPlatformCredentialDiagnostic[] = [];
  if (!isRecord(contract)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", "contract", "Credential boundary contract must be an object."),
      ],
    };
  }

  validateIdentity(contract.identity, "contract.identity", diagnostics);
  validateCapabilities(contract.capabilities, "contract.capabilities", diagnostics);
  validateSafety(contract.safety, "contract.safety", diagnostics);

  if (contract.grantsExecutionPermission !== false) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      "contract.grantsExecutionPermission",
      "Credential boundary contract must not grant execution permission.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialPlatformRedactedCredentialReference(
  reference: unknown,
  path = "credentialRef",
): SocialPlatformCredentialValidationResult {
  const diagnostics: SocialPlatformCredentialDiagnostic[] = [];
  if (!isRecord(reference)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", path, "Redacted credential reference must be an object."),
      ],
    };
  }

  requireText(reference.credentialRefId, `${path}.credentialRefId`, "credential_ref_id_required", diagnostics);
  requireText(reference.accountRefId, `${path}.accountRefId`, "account_ref_id_required", diagnostics);
  requireText(reference.redactedHint, `${path}.redactedHint`, "redacted_hint_required", diagnostics);

  if (!isSocialPlatformCredentialProvider(reference.provider)) {
    diagnostics.push(errorDiagnostic(
      "provider_unknown",
      `${path}.provider`,
      "Credential provider is not supported.",
    ));
  }
  if (!isSocialPlatformCredentialKind(reference.credentialKind)) {
    diagnostics.push(errorDiagnostic(
      "credential_kind_unknown",
      `${path}.credentialKind`,
      "Credential kind is not supported.",
    ));
  }
  if (
    reference.platform !== null &&
    !isSocialPlatformAdapterPlatformForCredential(reference.platform)
  ) {
    diagnostics.push(errorDiagnostic(
      "platform_provider_mismatch",
      `${path}.platform`,
      "Credential platform is not recognized.",
    ));
  } else if (
    isSocialPlatformCredentialProvider(reference.provider) &&
    reference.platform !== null &&
    isSocialPlatformAdapterPlatformForCredential(reference.platform) &&
    providerForPlatform(reference.platform) !== reference.provider
  ) {
    diagnostics.push(errorDiagnostic(
      "platform_provider_mismatch",
      path,
      "Credential platform must match provider.",
    ));
  }
  if (
    hasText(reference.redactedHint) &&
    looksLikeSecretValue(reference.redactedHint)
  ) {
    diagnostics.push(errorDiagnostic(
      "redacted_hint_forbidden_secret",
      `${path}.redactedHint`,
      "Redacted hint must not contain secret or token values.",
    ));
  }
  if (
    reference.referencesOnly !== true ||
    reference.containsSecretValue !== false ||
    reference.containsTokenValue !== false ||
    reference.containsRefreshToken !== false ||
    reference.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "Redacted credential reference must remain reference-only.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialPlatformAccountAuthorizationState(
  state: unknown,
  path = "accountAuthorization",
): SocialPlatformCredentialValidationResult {
  const diagnostics: SocialPlatformCredentialDiagnostic[] = [];
  if (!isRecord(state)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", path, "Account authorization state must be an object."),
      ],
    };
  }

  requireText(state.accountRefId, `${path}.accountRefId`, "account_ref_id_required", diagnostics);
  if (!isSocialPlatformCredentialProvider(state.provider)) {
    diagnostics.push(errorDiagnostic(
      "provider_unknown",
      `${path}.provider`,
      "Credential provider is not supported.",
    ));
  }
  if (!isSocialPlatformAuthorizationState(state.authorizationState)) {
    diagnostics.push(errorDiagnostic(
      "authorization_state_unknown",
      `${path}.authorizationState`,
      "Authorization state is not supported.",
    ));
  }
  if (
    state.platform !== null &&
    !isSocialPlatformAdapterPlatformForCredential(state.platform)
  ) {
    diagnostics.push(errorDiagnostic(
      "platform_provider_mismatch",
      `${path}.platform`,
      "Account platform is not recognized.",
    ));
  }
  if (
    state.modeledOnly !== true ||
    state.referencesOnly !== true ||
    state.containsCredentials !== false ||
    state.containsOAuthTokens !== false ||
    state.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "authorization_state_invalid",
      path,
      "Account authorization state must remain modeled and reference-only.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function detectSocialPlatformCredentialForbiddenStates(
  contract: SocialPlatformCredentialBoundaryContract,
  accountState: SocialPlatformAccountAuthorizationState,
): SocialPlatformCredentialValidationResult {
  const diagnostics: SocialPlatformCredentialDiagnostic[] = [];

  if (!contract.capabilities.supportedProviders.includes(accountState.provider)) {
    diagnostics.push(blockDiagnostic(
      "provider_unknown",
      "accountAuthorization.provider",
      "Credential boundary contract does not support this provider.",
    ));
  }

  if (!isAuthorizationStateSufficient(accountState.authorizationState)) {
    diagnostics.push(blockDiagnostic(
      "authorization_state_invalid",
      "accountAuthorization.authorizationState",
      "Account authorization state is insufficient for modeled credential readiness.",
    ));
  }

  if (accountState.missingCredentialKinds.length > 0) {
    for (const [index, kind] of accountState.missingCredentialKinds.entries()) {
      diagnostics.push(blockDiagnostic(
        "credential_kind_unknown",
        `accountAuthorization.missingCredentialKinds.${index}`,
        `Missing modeled credential kind: ${kind}`,
      ));
    }
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

export function serializeSocialPlatformCredentialBoundaryContract(
  contract: SocialPlatformCredentialBoundaryContract,
): string {
  return JSON.stringify(toStableValue(contract));
}

export function hydrateSocialPlatformCredentialBoundaryContract(
  serialized: string,
): Readonly<{
  ok: true;
  value: SocialPlatformCredentialBoundaryContract;
}> | Readonly<{
  ok: false;
  diagnostics: readonly SocialPlatformCredentialDiagnostic[];
}> {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const validation = validateSocialPlatformCredentialBoundaryContract(parsed);
    if (!validation.valid || !isRecord(parsed)) {
      return { ok: false, diagnostics: validation.diagnostics };
    }
    return { ok: true, value: deepFreeze(parsed as SocialPlatformCredentialBoundaryContract) };
  } catch {
    return {
      ok: false,
      diagnostics: [
        errorDiagnostic(
          "serialization_invalid",
          "serialized",
          "Credential boundary contract serialization must be valid JSON.",
        ),
      ],
    };
  }
}

function validateIdentity(
  identity: unknown,
  path: string,
  diagnostics: SocialPlatformCredentialDiagnostic[],
): void {
  if (!isRecord(identity)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", path, "Credential boundary identity must be an object."));
    return;
  }
  requireText(identity.boundaryId, `${path}.boundaryId`, "credential_ref_id_required", diagnostics);
  if (identity.boundaryVersion !== SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.boundaryVersion`,
      "Credential boundary version must match the current contract version.",
    ));
  }
  if (
    identity.contractOnly !== true ||
    identity.containsCredentials !== false ||
    identity.containsOAuthFlow !== false ||
    identity.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "Credential boundary identity must remain contract-only and non-executing.",
    ));
  }
}

function validateCapabilities(
  capabilities: unknown,
  path: string,
  diagnostics: SocialPlatformCredentialDiagnostic[],
): void {
  if (!isRecord(capabilities)) {
    diagnostics.push(errorDiagnostic("capabilities_invalid", path, "Credential boundary capabilities must be an object."));
    return;
  }
  if (
    capabilities.allowsLiveOAuth !== false ||
    capabilities.allowsLiveCredentials !== false ||
    capabilities.allowsTokenStorage !== false ||
    capabilities.allowsSecretStorage !== false ||
    capabilities.allowsNetwork !== false ||
    capabilities.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "capabilities_invalid",
      path,
      "Credential boundary capabilities must forbid live OAuth, credentials, storage, network, and execution permission.",
    ));
  }
}

function validateSafety(
  safety: unknown,
  path: string,
  diagnostics: SocialPlatformCredentialDiagnostic[],
): void {
  if (!isRecord(safety)) {
    diagnostics.push(errorDiagnostic(
      "safety_requirements_invalid",
      path,
      "Credential boundary safety requirements must be an object.",
    ));
    return;
  }
  const requiredFlags = [
    "contractOnly",
    "modelAuthorityOnly",
    "referencesOnly",
    "callsNoExternalApis",
    "usesNoSdks",
    "usesNoNetwork",
    "usesNoOAuth",
    "usesNoCredentials",
    "storesNoSecrets",
    "storesNoTokens",
    "grantsExecutionPermission",
    "executesNothing",
    "publishesNothing",
  ] as const;
  for (const flag of requiredFlags) {
    const expected = flag === "grantsExecutionPermission" ? false : true;
    if (safety[flag] !== expected) {
      diagnostics.push(errorDiagnostic(
        "safety_requirements_invalid",
        `${path}.${flag}`,
        "Credential boundary safety requirement invariant failed.",
      ));
    }
  }
}

function requireText(
  value: unknown,
  path: string,
  code: SocialPlatformCredentialErrorCode,
  diagnostics: SocialPlatformCredentialDiagnostic[],
): void {
  if (hasText(value)) return;
  diagnostics.push(errorDiagnostic(code, path, "Required credential boundary text field is missing."));
}

function errorDiagnostic(
  code: SocialPlatformCredentialErrorCode,
  path: string,
  message: string,
): SocialPlatformCredentialDiagnostic {
  return { code, path, message, severity: "error" };
}

function blockDiagnostic(
  code: SocialPlatformCredentialErrorCode,
  path: string,
  message: string,
): SocialPlatformCredentialDiagnostic {
  return { code, path, message, severity: "block" };
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function looksLikeSecretValue(value: string): boolean {
  const trimmed = value.trim();
  if (/^Bearer\s+/i.test(trimmed)) return true;
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(trimmed)) return true;
  if (/^[A-Za-z0-9+/=]{32,}$/.test(trimmed) && !trimmed.includes("*")) return true;
  return false;
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
