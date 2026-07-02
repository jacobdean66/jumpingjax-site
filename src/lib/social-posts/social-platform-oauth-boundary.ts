import {
  SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
  SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS,
  type SocialPlatformCredentialProvider,
  isSocialPlatformCredentialProvider,
} from "./social-platform-credential-boundary";

export const SOCIAL_PLATFORM_OAUTH_BOUNDARY_VERSION = "d11-m8-v1" as const;

export const SOCIAL_PLATFORM_OAUTH_FLOW_PHASES = [
  "authorize_modeled",
  "callback_modeled",
  "token_exchange_modeled",
  "refresh_modeled",
  "revoke_modeled",
] as const;

export const SOCIAL_PLATFORM_OAUTH_SCOPES = [
  "pages_manage_posts_modeled",
  "pages_read_engagement_modeled",
  "instagram_basic_modeled",
  "instagram_content_publish_modeled",
  "business_management_modeled",
  "tiktok_content_post_modeled",
  "linkedin_organization_social_modeled",
] as const;

export const SOCIAL_PLATFORM_OAUTH_STATE_KINDS = [
  "oauth_state_ref",
  "oauth_code_ref",
  "oauth_pkce_verifier_ref",
] as const;

export const SOCIAL_PLATFORM_OAUTH_CAPABILITY_FLAGS = [
  "oauth_flow_reference_only",
  "authorize_endpoint_blocked",
  "token_endpoint_blocked",
  "refresh_endpoint_blocked",
  "callback_handler_blocked",
  "live_oauth_blocked",
  "network_blocked",
  "execution_blocked",
] as const;

export const SOCIAL_PLATFORM_OAUTH_ERROR_CODES = [
  "provider_unknown",
  "flow_phase_unknown",
  "oauth_scope_unknown",
  "oauth_state_kind_unknown",
  "oauth_state_ref_id_required",
  "redirect_uri_forbidden_url",
  "contract_invariant_failed",
  "oauth_flow_forbidden",
  "network_forbidden",
  "serialization_invalid",
  "capabilities_invalid",
  "safety_requirements_invalid",
] as const;

export type SocialPlatformOAuthFlowPhase =
  (typeof SOCIAL_PLATFORM_OAUTH_FLOW_PHASES)[number];

export type SocialPlatformOAuthScope =
  (typeof SOCIAL_PLATFORM_OAUTH_SCOPES)[number];

export type SocialPlatformOAuthStateKind =
  (typeof SOCIAL_PLATFORM_OAUTH_STATE_KINDS)[number];

export type SocialPlatformOAuthCapabilityFlag =
  (typeof SOCIAL_PLATFORM_OAUTH_CAPABILITY_FLAGS)[number];

export type SocialPlatformOAuthErrorCode =
  (typeof SOCIAL_PLATFORM_OAUTH_ERROR_CODES)[number];

export type SocialPlatformOAuthDiagnostic = Readonly<{
  code: SocialPlatformOAuthErrorCode;
  path: string;
  message: string;
  severity: "block" | "error" | "warning";
}>;

export type SocialPlatformOAuthValidationResult = Readonly<{
  valid: boolean;
  diagnostics: readonly SocialPlatformOAuthDiagnostic[];
}>;

export type SocialPlatformOAuthStateReference = Readonly<{
  oauthStateRefId: string;
  provider: SocialPlatformCredentialProvider;
  stateKind: SocialPlatformOAuthStateKind;
  redactedHint: string;
  referencesOnly: true;
  containsSecretValue: false;
  containsAuthorizationCode: false;
  containsAccessToken: false;
  containsRefreshToken: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformOAuthFlowBoundary = Readonly<{
  flowId: string;
  provider: SocialPlatformCredentialProvider;
  phase: SocialPlatformOAuthFlowPhase;
  requiredScopes: readonly SocialPlatformOAuthScope[];
  oauthStateRefs: readonly SocialPlatformOAuthStateReference[];
  redirectUriReference: string | null;
  modeledOnly: true;
  contractOnly: true;
  liveOAuthBlocked: true;
  callsNoExternalApis: true;
  usesNoNetwork: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformOAuthBoundaryCapabilities = Readonly<{
  supportedProviders: readonly SocialPlatformCredentialProvider[];
  supportedFlowPhases: readonly SocialPlatformOAuthFlowPhase[];
  supportedScopes: readonly SocialPlatformOAuthScope[];
  supportedStateKinds: readonly SocialPlatformOAuthStateKind[];
  capabilityFlags: readonly SocialPlatformOAuthCapabilityFlag[];
  allowsLiveOAuth: false;
  allowsAuthorizeEndpoint: false;
  allowsTokenEndpoint: false;
  allowsRefreshEndpoint: false;
  allowsCallbackHandler: false;
  allowsNetwork: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformOAuthBoundarySafetyRequirements = Readonly<{
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

export type SocialPlatformOAuthBoundaryIdentity = Readonly<{
  boundaryId: string;
  boundaryVersion: typeof SOCIAL_PLATFORM_OAUTH_BOUNDARY_VERSION;
  credentialBoundaryVersion: typeof SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION;
  displayName: string;
  layer: "oauth_boundary";
  contractOnly: true;
  implementsNothing: true;
  containsCredentials: false;
  containsOAuthFlow: false;
  containsNetworkClient: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformOAuthBoundaryContract = Readonly<{
  identity: SocialPlatformOAuthBoundaryIdentity;
  capabilities: SocialPlatformOAuthBoundaryCapabilities;
  safety: SocialPlatformOAuthBoundarySafetyRequirements;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

const FLOW_PHASE_SET = new Set<string>(SOCIAL_PLATFORM_OAUTH_FLOW_PHASES);
const OAUTH_SCOPE_SET = new Set<string>(SOCIAL_PLATFORM_OAUTH_SCOPES);
const OAUTH_STATE_KIND_SET = new Set<string>(SOCIAL_PLATFORM_OAUTH_STATE_KINDS);

const PROVIDER_SCOPES: Readonly<
  Record<SocialPlatformCredentialProvider, readonly SocialPlatformOAuthScope[]>
> = {
  meta: [
    "pages_manage_posts_modeled",
    "pages_read_engagement_modeled",
    "instagram_basic_modeled",
    "instagram_content_publish_modeled",
    "business_management_modeled",
  ],
  tiktok: ["tiktok_content_post_modeled"],
  linkedin: ["linkedin_organization_social_modeled"],
};

const SHARED_OAUTH_CAPABILITY_FLAGS: readonly SocialPlatformOAuthCapabilityFlag[] = [
  "oauth_flow_reference_only",
  "authorize_endpoint_blocked",
  "token_endpoint_blocked",
  "refresh_endpoint_blocked",
  "callback_handler_blocked",
  "live_oauth_blocked",
  "network_blocked",
  "execution_blocked",
];

const SHARED_OAUTH_SAFETY: SocialPlatformOAuthBoundarySafetyRequirements = {
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

function createOAuthBoundaryContract(
  provider: SocialPlatformCredentialProvider,
): SocialPlatformOAuthBoundaryContract {
  return deepFreeze({
    identity: {
      boundaryId: `oauth-boundary-${provider}-contract`,
      boundaryVersion: SOCIAL_PLATFORM_OAUTH_BOUNDARY_VERSION,
      credentialBoundaryVersion: SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
      displayName: `${provider} OAuth boundary contract`,
      layer: "oauth_boundary",
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
      supportedFlowPhases: [...SOCIAL_PLATFORM_OAUTH_FLOW_PHASES],
      supportedScopes: [...PROVIDER_SCOPES[provider]],
      supportedStateKinds: [...SOCIAL_PLATFORM_OAUTH_STATE_KINDS],
      capabilityFlags: SHARED_OAUTH_CAPABILITY_FLAGS,
      allowsLiveOAuth: false,
      allowsAuthorizeEndpoint: false,
      allowsTokenEndpoint: false,
      allowsRefreshEndpoint: false,
      allowsCallbackHandler: false,
      allowsNetwork: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    safety: SHARED_OAUTH_SAFETY,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
}

export const SOCIAL_PLATFORM_OAUTH_BOUNDARY_CONTRACTS = Object.freeze(
  SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS.map(createOAuthBoundaryContract),
);

export function isSocialPlatformOAuthFlowPhase(
  value: unknown,
): value is SocialPlatformOAuthFlowPhase {
  return typeof value === "string" && FLOW_PHASE_SET.has(value);
}

export function isSocialPlatformOAuthScope(
  value: unknown,
): value is SocialPlatformOAuthScope {
  return typeof value === "string" && OAUTH_SCOPE_SET.has(value);
}

export function isSocialPlatformOAuthStateKind(
  value: unknown,
): value is SocialPlatformOAuthStateKind {
  return typeof value === "string" && OAUTH_STATE_KIND_SET.has(value);
}

export function createSocialPlatformOAuthBoundaryContract(
  provider: SocialPlatformCredentialProvider,
): SocialPlatformOAuthBoundaryContract {
  const contract = SOCIAL_PLATFORM_OAUTH_BOUNDARY_CONTRACTS.find((candidate) =>
    candidate.capabilities.supportedProviders.includes(provider),
  );
  if (!contract) {
    throw new Error(`OAuth boundary contract is unavailable for provider: ${provider}`);
  }
  return contract;
}

export function oauthScopesForProvider(
  provider: SocialPlatformCredentialProvider,
): readonly SocialPlatformOAuthScope[] {
  return PROVIDER_SCOPES[provider];
}

export function validateSocialPlatformOAuthBoundaryContract(
  contract: unknown,
): SocialPlatformOAuthValidationResult {
  const diagnostics: SocialPlatformOAuthDiagnostic[] = [];
  if (!isRecord(contract)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", "contract", "OAuth boundary contract must be an object."),
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
      "OAuth boundary contract must not grant execution permission.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialPlatformOAuthStateReference(
  reference: unknown,
  path = "oauthStateRef",
): SocialPlatformOAuthValidationResult {
  const diagnostics: SocialPlatformOAuthDiagnostic[] = [];
  if (!isRecord(reference)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", path, "OAuth state reference must be an object."),
      ],
    };
  }

  requireText(reference.oauthStateRefId, `${path}.oauthStateRefId`, "oauth_state_ref_id_required", diagnostics);
  requireText(reference.redactedHint, `${path}.redactedHint`, "oauth_state_ref_id_required", diagnostics);

  if (!isSocialPlatformCredentialProvider(reference.provider)) {
    diagnostics.push(errorDiagnostic(
      "provider_unknown",
      `${path}.provider`,
      "OAuth provider is not supported.",
    ));
  }
  if (!isSocialPlatformOAuthStateKind(reference.stateKind)) {
    diagnostics.push(errorDiagnostic(
      "oauth_state_kind_unknown",
      `${path}.stateKind`,
      "OAuth state kind is not supported.",
    ));
  }
  if (
    reference.referencesOnly !== true ||
    reference.containsSecretValue !== false ||
    reference.containsAuthorizationCode !== false ||
    reference.containsAccessToken !== false ||
    reference.containsRefreshToken !== false ||
    reference.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "OAuth state reference must remain reference-only.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialPlatformOAuthFlowBoundary(
  flow: unknown,
): SocialPlatformOAuthValidationResult {
  const diagnostics: SocialPlatformOAuthDiagnostic[] = [];
  if (!isRecord(flow)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", "flow", "OAuth flow boundary must be an object."),
      ],
    };
  }

  requireText(flow.flowId, "flow.flowId", "oauth_state_ref_id_required", diagnostics);
  if (!isSocialPlatformCredentialProvider(flow.provider)) {
    diagnostics.push(errorDiagnostic(
      "provider_unknown",
      "flow.provider",
      "OAuth provider is not supported.",
    ));
  }
  if (!isSocialPlatformOAuthFlowPhase(flow.phase)) {
    diagnostics.push(errorDiagnostic(
      "flow_phase_unknown",
      "flow.phase",
      "OAuth flow phase is not supported.",
    ));
  }
  if (
    flow.redirectUriReference !== null &&
    typeof flow.redirectUriReference === "string" &&
    looksLikeNetworkUrl(flow.redirectUriReference)
  ) {
    diagnostics.push(errorDiagnostic(
      "redirect_uri_forbidden_url",
      "flow.redirectUriReference",
      "OAuth redirect URI must use internal references, not network URLs.",
    ));
  }
  if (
    flow.modeledOnly !== true ||
    flow.contractOnly !== true ||
    flow.liveOAuthBlocked !== true ||
    flow.callsNoExternalApis !== true ||
    flow.usesNoNetwork !== true ||
    flow.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "oauth_flow_forbidden",
      "flow",
      "OAuth flow boundary must remain modeled and non-executing.",
    ));
  }

  if (Array.isArray(flow.oauthStateRefs)) {
    flow.oauthStateRefs.forEach((stateRef, index) => {
      const validation = validateSocialPlatformOAuthStateReference(stateRef, `flow.oauthStateRefs.${index}`);
      diagnostics.push(...validation.diagnostics);
    });
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function serializeSocialPlatformOAuthBoundaryContract(
  contract: SocialPlatformOAuthBoundaryContract,
): string {
  return JSON.stringify(toStableValue(contract));
}

export function hydrateSocialPlatformOAuthBoundaryContract(
  serialized: string,
): Readonly<{
  ok: true;
  value: SocialPlatformOAuthBoundaryContract;
}> | Readonly<{
  ok: false;
  diagnostics: readonly SocialPlatformOAuthDiagnostic[];
}> {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const validation = validateSocialPlatformOAuthBoundaryContract(parsed);
    if (!validation.valid || !isRecord(parsed)) {
      return { ok: false, diagnostics: validation.diagnostics };
    }
    return { ok: true, value: deepFreeze(parsed as SocialPlatformOAuthBoundaryContract) };
  } catch {
    return {
      ok: false,
      diagnostics: [
        errorDiagnostic(
          "serialization_invalid",
          "serialized",
          "OAuth boundary contract serialization must be valid JSON.",
        ),
      ],
    };
  }
}

function validateIdentity(
  identity: unknown,
  path: string,
  diagnostics: SocialPlatformOAuthDiagnostic[],
): void {
  if (!isRecord(identity)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", path, "OAuth boundary identity must be an object."));
    return;
  }
  requireText(identity.boundaryId, `${path}.boundaryId`, "oauth_state_ref_id_required", diagnostics);
  if (identity.boundaryVersion !== SOCIAL_PLATFORM_OAUTH_BOUNDARY_VERSION) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.boundaryVersion`,
      "OAuth boundary version must match the current contract version.",
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
      "OAuth boundary identity must remain contract-only and non-executing.",
    ));
  }
}

function validateCapabilities(
  capabilities: unknown,
  path: string,
  diagnostics: SocialPlatformOAuthDiagnostic[],
): void {
  if (!isRecord(capabilities)) {
    diagnostics.push(errorDiagnostic("capabilities_invalid", path, "OAuth boundary capabilities must be an object."));
    return;
  }
  if (
    capabilities.allowsLiveOAuth !== false ||
    capabilities.allowsAuthorizeEndpoint !== false ||
    capabilities.allowsTokenEndpoint !== false ||
    capabilities.allowsNetwork !== false ||
    capabilities.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "capabilities_invalid",
      path,
      "OAuth boundary capabilities must forbid live OAuth, endpoints, network, and execution permission.",
    ));
  }
}

function validateSafety(
  safety: unknown,
  path: string,
  diagnostics: SocialPlatformOAuthDiagnostic[],
): void {
  if (!isRecord(safety)) {
    diagnostics.push(errorDiagnostic(
      "safety_requirements_invalid",
      path,
      "OAuth boundary safety requirements must be an object.",
    ));
    return;
  }
  const requiredFlags = [
    "contractOnly",
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
        "OAuth boundary safety requirement invariant failed.",
      ));
    }
  }
}

function requireText(
  value: unknown,
  path: string,
  code: SocialPlatformOAuthErrorCode,
  diagnostics: SocialPlatformOAuthDiagnostic[],
): void {
  if (hasText(value)) return;
  diagnostics.push(errorDiagnostic(code, path, "Required OAuth boundary text field is missing."));
}

function errorDiagnostic(
  code: SocialPlatformOAuthErrorCode,
  path: string,
  message: string,
): SocialPlatformOAuthDiagnostic {
  return { code, path, message, severity: "error" };
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
