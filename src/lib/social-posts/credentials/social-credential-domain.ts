import {
  SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
  SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS,
  computeMissingCredentialKinds,
  isAuthorizationStateSufficient,
  requiredCredentialKindsForProvider,
  type SocialPlatformAuthorizationState,
  type SocialPlatformCredentialKind,
  type SocialPlatformCredentialProvider,
  isSocialPlatformCredentialProvider,
  isSocialPlatformCredentialKind,
  isSocialPlatformAuthorizationState,
} from "../social-platform-credential-boundary";

export const SOCIAL_CREDENTIAL_DOMAIN_VERSION = "d13-w1-v1" as const;

export const SOCIAL_CREDENTIAL_LIFECYCLE_PHASES = [
  "pending",
  "active",
  "expired",
  "revoked",
  "superseded",
] as const;

export const SOCIAL_CREDENTIAL_PROVIDER_ACCOUNT_STATUSES = [
  "registered",
  "disabled",
] as const;

export const SOCIAL_CREDENTIAL_AUDIT_ACTIONS = [
  "create",
  "rotate",
  "revoke",
  "decrypt_attempt",
  "read_metadata",
] as const;

export const SOCIAL_CREDENTIAL_AUDIT_OUTCOMES = [
  "success",
  "denied",
  "failed",
] as const;

export const SOCIAL_CREDENTIAL_KEY_VERSION_STATUSES = [
  "active",
  "retired",
] as const;

export const SOCIAL_CREDENTIAL_CAPABILITY_FLAGS = [
  "vault_reference_only",
  "encryption_blocked",
  "decrypt_blocked",
  "oauth_flow_blocked",
  "network_blocked",
  "execution_blocked",
  "live_credentials_blocked",
  "persistence_blocked",
] as const;

export const SOCIAL_CREDENTIAL_ERROR_CODES = [
  "provider_unknown",
  "credential_kind_unknown",
  "authorization_state_unknown",
  "lifecycle_phase_unknown",
  "account_status_unknown",
  "audit_action_unknown",
  "audit_outcome_unknown",
  "key_version_status_unknown",
  "credential_ref_id_required",
  "account_ref_id_required",
  "provider_account_id_required",
  "publication_target_id_required",
  "external_account_id_required",
  "redacted_hint_required",
  "redacted_hint_forbidden_secret",
  "key_version_required",
  "encrypted_payload_ref_required",
  "timestamp_invalid",
  "contract_invariant_failed",
  "secret_forbidden",
  "token_forbidden",
  "plaintext_forbidden",
  "oauth_flow_forbidden",
  "network_forbidden",
  "serialization_invalid",
  "capabilities_invalid",
  "safety_requirements_invalid",
  "lifecycle_transition_invalid",
  "forbidden_state_detected",
] as const;

export type SocialCredentialLifecyclePhase =
  (typeof SOCIAL_CREDENTIAL_LIFECYCLE_PHASES)[number];

export type SocialCredentialProviderAccountStatus =
  (typeof SOCIAL_CREDENTIAL_PROVIDER_ACCOUNT_STATUSES)[number];

export type SocialCredentialAuditAction =
  (typeof SOCIAL_CREDENTIAL_AUDIT_ACTIONS)[number];

export type SocialCredentialAuditOutcome =
  (typeof SOCIAL_CREDENTIAL_AUDIT_OUTCOMES)[number];

export type SocialCredentialKeyVersionStatus =
  (typeof SOCIAL_CREDENTIAL_KEY_VERSION_STATUSES)[number];

export type SocialCredentialCapabilityFlag =
  (typeof SOCIAL_CREDENTIAL_CAPABILITY_FLAGS)[number];

export type SocialCredentialErrorCode =
  (typeof SOCIAL_CREDENTIAL_ERROR_CODES)[number];

export type SocialCredentialDiagnostic = Readonly<{
  code: SocialCredentialErrorCode;
  path: string;
  message: string;
  severity: "block" | "error" | "warning";
}>;

export type SocialCredentialValidationResult = Readonly<{
  valid: boolean;
  diagnostics: readonly SocialCredentialDiagnostic[];
}>;

export type SocialCredentialProviderAccountReference = Readonly<{
  providerAccountId: string;
  provider: SocialPlatformCredentialProvider;
  publicationTargetId: string;
  externalAccountIdRedacted: string;
  displayNameRedacted: string;
  status: SocialCredentialProviderAccountStatus;
  accountRefId: string;
  referencesOnly: true;
  containsCredentials: false;
  containsOAuthTokens: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialIdentity = Readonly<{
  credentialRefId: string;
  provider: SocialPlatformCredentialProvider;
  credentialKind: SocialPlatformCredentialKind;
  accountRefId: string;
  providerAccountId: string;
  publicationTargetId: string;
  domainVersion: typeof SOCIAL_CREDENTIAL_DOMAIN_VERSION;
  credentialBoundaryVersion: typeof SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION;
  referencesOnly: true;
  containsSecretValue: false;
  containsTokenValue: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialVaultRecordMetadata = Readonly<{
  vaultRecordId: string;
  credentialRefId: string;
  provider: SocialPlatformCredentialProvider;
  credentialKind: SocialPlatformCredentialKind;
  accountRefId: string;
  providerAccountId: string;
  publicationTargetId: string;
  encryptedPayloadRef: string;
  keyVersion: string;
  lifecyclePhase: SocialCredentialLifecyclePhase;
  supersededAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  metadataOnly: true;
  containsPlaintext: false;
  containsCiphertext: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialLifecycleState = Readonly<{
  lifecycleStateId: string;
  credentialRefId: string;
  accountRefId: string;
  provider: SocialPlatformCredentialProvider;
  authorizationState: SocialPlatformAuthorizationState;
  lifecyclePhase: SocialCredentialLifecyclePhase;
  issuedAt: string | null;
  expiresAt: string | null;
  lastRotatedAt: string | null;
  revokedAt: string | null;
  scopeFingerprintRedacted: string | null;
  modeledOnly: true;
  referencesOnly: true;
  containsCredentials: false;
  containsOAuthTokens: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialReference = Readonly<{
  credentialRefId: string;
  provider: SocialPlatformCredentialProvider;
  credentialKind: SocialPlatformCredentialKind;
  accountRefId: string;
  redactedHint: string;
  referencesOnly: true;
  containsSecretValue: false;
  containsTokenValue: false;
  containsRefreshToken: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialAuditEvent = Readonly<{
  auditEventId: string;
  credentialRefId: string;
  actorAdminId: string | null;
  action: SocialCredentialAuditAction;
  outcome: SocialCredentialAuditOutcome;
  sanitizedDetail: string;
  createdAt: string;
  appendOnly: true;
  containsSecrets: false;
  containsTokens: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialKeyVersion = Readonly<{
  keyVersion: string;
  status: SocialCredentialKeyVersionStatus;
  activatedAt: string;
  retiredAt: string | null;
  metadataOnly: true;
  containsKeyMaterial: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialServiceRoleBoundary = Readonly<{
  boundaryId: string;
  domainVersion: typeof SOCIAL_CREDENTIAL_DOMAIN_VERSION;
  allowedDecryptModules: readonly ["src/lib/social-posts/credentials/**"];
  vaultModuleOnly: true;
  contractOnly: true;
  referencesOnly: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialDomainCapabilities = Readonly<{
  supportedProviders: readonly SocialPlatformCredentialProvider[];
  supportedLifecyclePhases: readonly SocialCredentialLifecyclePhase[];
  supportedAuditActions: readonly SocialCredentialAuditAction[];
  capabilityFlags: readonly SocialCredentialCapabilityFlag[];
  allowsEncryption: false;
  allowsDecryption: false;
  allowsLiveCredentials: false;
  allowsNetwork: false;
  allowsPersistence: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialDomainSafetyRequirements = Readonly<{
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
  storesNoPlaintext: true;
  startsNoWorkers: true;
  startsNoTimers: true;
  createsNoQueues: true;
  exposesNoApiRoutes: true;
  mutatesNoSql: true;
  mutatesNoStorage: true;
  mutatesNoLowerLayers: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialDomainIdentity = Readonly<{
  domainId: string;
  domainVersion: typeof SOCIAL_CREDENTIAL_DOMAIN_VERSION;
  credentialBoundaryVersion: typeof SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION;
  displayName: string;
  layer: "credential_domain";
  contractOnly: true;
  implementsNothing: true;
  containsCredentials: false;
  containsOAuthFlow: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialDomainContract = Readonly<{
  identity: SocialCredentialDomainIdentity;
  capabilities: SocialCredentialDomainCapabilities;
  safety: SocialCredentialDomainSafetyRequirements;
  serviceRoleBoundary: SocialCredentialServiceRoleBoundary;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

const LIFECYCLE_PHASE_SET = new Set<string>(SOCIAL_CREDENTIAL_LIFECYCLE_PHASES);
const ACCOUNT_STATUS_SET = new Set<string>(SOCIAL_CREDENTIAL_PROVIDER_ACCOUNT_STATUSES);
const AUDIT_ACTION_SET = new Set<string>(SOCIAL_CREDENTIAL_AUDIT_ACTIONS);
const AUDIT_OUTCOME_SET = new Set<string>(SOCIAL_CREDENTIAL_AUDIT_OUTCOMES);
const KEY_VERSION_STATUS_SET = new Set<string>(SOCIAL_CREDENTIAL_KEY_VERSION_STATUSES);

const SHARED_CAPABILITY_FLAGS: readonly SocialCredentialCapabilityFlag[] = [
  "vault_reference_only",
  "encryption_blocked",
  "decrypt_blocked",
  "oauth_flow_blocked",
  "network_blocked",
  "execution_blocked",
  "live_credentials_blocked",
  "persistence_blocked",
];

const SHARED_SAFETY: SocialCredentialDomainSafetyRequirements = {
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
  storesNoPlaintext: true,
  startsNoWorkers: true,
  startsNoTimers: true,
  createsNoQueues: true,
  exposesNoApiRoutes: true,
  mutatesNoSql: true,
  mutatesNoStorage: true,
  mutatesNoLowerLayers: true,
  grantsExecutionPermission: false,
  executesNothing: true,
  publishesNothing: true,
};

const SERVICE_ROLE_BOUNDARY: SocialCredentialServiceRoleBoundary = deepFreeze({
  boundaryId: "credential-service-role-boundary",
  domainVersion: SOCIAL_CREDENTIAL_DOMAIN_VERSION,
  allowedDecryptModules: ["src/lib/social-posts/credentials/**"] as const,
  vaultModuleOnly: true,
  contractOnly: true,
  referencesOnly: true,
  grantsExecutionPermission: false,
  executesNothing: true,
  publishesNothing: true,
});

export const SOCIAL_CREDENTIAL_DOMAIN_CONTRACT: SocialCredentialDomainContract = deepFreeze({
  identity: {
    domainId: "credential-domain-contract",
    domainVersion: SOCIAL_CREDENTIAL_DOMAIN_VERSION,
    credentialBoundaryVersion: SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
    displayName: "D13 credential domain contract",
    layer: "credential_domain",
    contractOnly: true,
    implementsNothing: true,
    containsCredentials: false,
    containsOAuthFlow: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  },
  capabilities: {
    supportedProviders: [...SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS],
    supportedLifecyclePhases: [...SOCIAL_CREDENTIAL_LIFECYCLE_PHASES],
    supportedAuditActions: [...SOCIAL_CREDENTIAL_AUDIT_ACTIONS],
    capabilityFlags: SHARED_CAPABILITY_FLAGS,
    allowsEncryption: false,
    allowsDecryption: false,
    allowsLiveCredentials: false,
    allowsNetwork: false,
    allowsPersistence: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  },
  safety: SHARED_SAFETY,
  serviceRoleBoundary: SERVICE_ROLE_BOUNDARY,
  computedOnly: true,
  readOnly: true,
  authoritative: false,
  grantsExecutionPermission: false,
  executesNothing: true,
  publishesNothing: true,
});

const VALID_LIFECYCLE_TRANSITIONS: Readonly<
  Record<SocialCredentialLifecyclePhase, readonly SocialCredentialLifecyclePhase[]>
> = {
  pending: ["active", "revoked"],
  active: ["expired", "revoked", "superseded"],
  expired: ["revoked", "superseded"],
  revoked: [],
  superseded: [],
};

export function isSocialCredentialLifecyclePhase(
  value: unknown,
): value is SocialCredentialLifecyclePhase {
  return typeof value === "string" && LIFECYCLE_PHASE_SET.has(value);
}

export function isSocialCredentialProviderAccountStatus(
  value: unknown,
): value is SocialCredentialProviderAccountStatus {
  return typeof value === "string" && ACCOUNT_STATUS_SET.has(value);
}

export function isSocialCredentialAuditAction(
  value: unknown,
): value is SocialCredentialAuditAction {
  return typeof value === "string" && AUDIT_ACTION_SET.has(value);
}

export function isSocialCredentialAuditOutcome(
  value: unknown,
): value is SocialCredentialAuditOutcome {
  return typeof value === "string" && AUDIT_OUTCOME_SET.has(value);
}

export function isSocialCredentialKeyVersionStatus(
  value: unknown,
): value is SocialCredentialKeyVersionStatus {
  return typeof value === "string" && KEY_VERSION_STATUS_SET.has(value);
}

export function authorizationStateForLifecyclePhase(
  phase: SocialCredentialLifecyclePhase,
): SocialPlatformAuthorizationState {
  switch (phase) {
    case "pending":
      return "not_authorized";
    case "active":
      return "authorized_reference";
    case "expired":
      return "expired_reference";
    case "revoked":
      return "revoked_reference";
    case "superseded":
      return "revoked_reference";
  }
}

export function isLifecycleTransitionValid(
  from: SocialCredentialLifecyclePhase,
  to: SocialCredentialLifecyclePhase,
): boolean {
  return VALID_LIFECYCLE_TRANSITIONS[from].includes(to);
}

export function validateSocialCredentialDomainContract(
  contract: unknown,
): SocialCredentialValidationResult {
  const diagnostics: SocialCredentialDiagnostic[] = [];
  if (!isRecord(contract)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", "contract", "Credential domain contract must be an object."),
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
      "Credential domain contract must not grant execution permission.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialCredentialProviderAccountReference(
  reference: unknown,
  path = "providerAccount",
): SocialCredentialValidationResult {
  const diagnostics: SocialCredentialDiagnostic[] = [];
  if (!isRecord(reference)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", path, "Provider account reference must be an object."),
      ],
    };
  }

  requireText(reference.providerAccountId, `${path}.providerAccountId`, "provider_account_id_required", diagnostics);
  requireText(reference.publicationTargetId, `${path}.publicationTargetId`, "publication_target_id_required", diagnostics);
  requireText(reference.externalAccountIdRedacted, `${path}.externalAccountIdRedacted`, "external_account_id_required", diagnostics);
  requireText(reference.accountRefId, `${path}.accountRefId`, "account_ref_id_required", diagnostics);

  if (!isSocialPlatformCredentialProvider(reference.provider)) {
    diagnostics.push(errorDiagnostic("provider_unknown", `${path}.provider`, "Credential provider is not supported."));
  }
  if (!isSocialCredentialProviderAccountStatus(reference.status)) {
    diagnostics.push(errorDiagnostic("account_status_unknown", `${path}.status`, "Provider account status is not supported."));
  }
  if (
    reference.referencesOnly !== true ||
    reference.containsCredentials !== false ||
    reference.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "Provider account reference must remain reference-only.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialCredentialIdentity(
  identity: unknown,
  path = "credentialIdentity",
): SocialCredentialValidationResult {
  const diagnostics: SocialCredentialDiagnostic[] = [];
  if (!isRecord(identity)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", path, "Credential identity must be an object."),
      ],
    };
  }

  requireText(identity.credentialRefId, `${path}.credentialRefId`, "credential_ref_id_required", diagnostics);
  requireText(identity.accountRefId, `${path}.accountRefId`, "account_ref_id_required", diagnostics);
  requireText(identity.providerAccountId, `${path}.providerAccountId`, "provider_account_id_required", diagnostics);
  requireText(identity.publicationTargetId, `${path}.publicationTargetId`, "publication_target_id_required", diagnostics);

  if (!isSocialPlatformCredentialProvider(identity.provider)) {
    diagnostics.push(errorDiagnostic("provider_unknown", `${path}.provider`, "Credential provider is not supported."));
  }
  if (!isSocialPlatformCredentialKind(identity.credentialKind)) {
    diagnostics.push(errorDiagnostic("credential_kind_unknown", `${path}.credentialKind`, "Credential kind is not supported."));
  }
  if (identity.domainVersion !== SOCIAL_CREDENTIAL_DOMAIN_VERSION) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.domainVersion`,
      "Credential identity domain version must match current version.",
    ));
  }
  if (
    identity.referencesOnly !== true ||
    identity.containsSecretValue !== false ||
    identity.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "Credential identity must remain reference-only.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialCredentialVaultRecordMetadata(
  record: unknown,
  path = "vaultRecord",
): SocialCredentialValidationResult {
  const diagnostics: SocialCredentialDiagnostic[] = [];
  if (!isRecord(record)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", path, "Vault record metadata must be an object."),
      ],
    };
  }

  requireText(record.vaultRecordId, `${path}.vaultRecordId`, "credential_ref_id_required", diagnostics);
  requireText(record.credentialRefId, `${path}.credentialRefId`, "credential_ref_id_required", diagnostics);
  requireText(record.encryptedPayloadRef, `${path}.encryptedPayloadRef`, "encrypted_payload_ref_required", diagnostics);
  requireText(record.keyVersion, `${path}.keyVersion`, "key_version_required", diagnostics);

  if (!isSocialPlatformCredentialProvider(record.provider)) {
    diagnostics.push(errorDiagnostic("provider_unknown", `${path}.provider`, "Credential provider is not supported."));
  }
  if (!isSocialPlatformCredentialKind(record.credentialKind)) {
    diagnostics.push(errorDiagnostic("credential_kind_unknown", `${path}.credentialKind`, "Credential kind is not supported."));
  }
  if (!isSocialCredentialLifecyclePhase(record.lifecyclePhase)) {
    diagnostics.push(errorDiagnostic("lifecycle_phase_unknown", `${path}.lifecyclePhase`, "Lifecycle phase is not supported."));
  }
  if (
    record.metadataOnly !== true ||
    record.containsPlaintext !== false ||
    record.containsCiphertext !== false ||
    record.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "Vault record metadata must remain metadata-only without plaintext or ciphertext.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialCredentialLifecycleState(
  state: unknown,
  path = "lifecycleState",
): SocialCredentialValidationResult {
  const diagnostics: SocialCredentialDiagnostic[] = [];
  if (!isRecord(state)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", path, "Lifecycle state must be an object."),
      ],
    };
  }

  requireText(state.lifecycleStateId, `${path}.lifecycleStateId`, "credential_ref_id_required", diagnostics);
  requireText(state.credentialRefId, `${path}.credentialRefId`, "credential_ref_id_required", diagnostics);
  requireText(state.accountRefId, `${path}.accountRefId`, "account_ref_id_required", diagnostics);

  if (!isSocialPlatformCredentialProvider(state.provider)) {
    diagnostics.push(errorDiagnostic("provider_unknown", `${path}.provider`, "Credential provider is not supported."));
  }
  if (!isSocialPlatformAuthorizationState(state.authorizationState)) {
    diagnostics.push(errorDiagnostic(
      "authorization_state_unknown",
      `${path}.authorizationState`,
      "Authorization state is not supported.",
    ));
  }
  if (!isSocialCredentialLifecyclePhase(state.lifecyclePhase)) {
    diagnostics.push(errorDiagnostic("lifecycle_phase_unknown", `${path}.lifecyclePhase`, "Lifecycle phase is not supported."));
  }

  const expectedAuth = authorizationStateForLifecyclePhase(state.lifecyclePhase as SocialCredentialLifecyclePhase);
  if (
    isSocialCredentialLifecyclePhase(state.lifecyclePhase) &&
    isSocialPlatformAuthorizationState(state.authorizationState) &&
    state.authorizationState !== expectedAuth &&
    !(state.lifecyclePhase === "superseded" && state.authorizationState === "revoked_reference")
  ) {
    diagnostics.push(errorDiagnostic(
      "lifecycle_transition_invalid",
      path,
      "Lifecycle phase and authorization state must align.",
    ));
  }

  if (
    state.modeledOnly !== true ||
    state.referencesOnly !== true ||
    state.containsCredentials !== false ||
    state.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "Lifecycle state must remain modeled and reference-only.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialCredentialReference(
  reference: unknown,
  path = "credentialRef",
): SocialCredentialValidationResult {
  const diagnostics: SocialCredentialDiagnostic[] = [];
  if (!isRecord(reference)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", path, "Credential reference must be an object."),
      ],
    };
  }

  requireText(reference.credentialRefId, `${path}.credentialRefId`, "credential_ref_id_required", diagnostics);
  requireText(reference.accountRefId, `${path}.accountRefId`, "account_ref_id_required", diagnostics);
  requireText(reference.redactedHint, `${path}.redactedHint`, "redacted_hint_required", diagnostics);

  if (!isSocialPlatformCredentialProvider(reference.provider)) {
    diagnostics.push(errorDiagnostic("provider_unknown", `${path}.provider`, "Credential provider is not supported."));
  }
  if (!isSocialPlatformCredentialKind(reference.credentialKind)) {
    diagnostics.push(errorDiagnostic("credential_kind_unknown", `${path}.credentialKind`, "Credential kind is not supported."));
  }
  if (hasText(reference.redactedHint) && looksLikeSecretValue(reference.redactedHint)) {
    diagnostics.push(errorDiagnostic(
      "redacted_hint_forbidden_secret",
      `${path}.redactedHint`,
      "Redacted hint must not contain secret or token values.",
    ));
  }
  if (
    reference.referencesOnly !== true ||
    reference.containsSecretValue !== false ||
    reference.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "Credential reference must remain reference-only.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function detectSocialCredentialForbiddenStates(
  provider: SocialPlatformCredentialProvider,
  lifecycleStates: readonly SocialCredentialLifecycleState[],
  satisfiedKinds: readonly SocialPlatformCredentialKind[],
): SocialCredentialValidationResult {
  const diagnostics: SocialCredentialDiagnostic[] = [];
  const required = requiredCredentialKindsForProvider(provider);
  const missing = computeMissingCredentialKinds(provider, satisfiedKinds);

  if (missing.length > 0) {
    for (const [index, kind] of missing.entries()) {
      diagnostics.push(blockDiagnostic(
        "credential_kind_unknown",
        `missingCredentialKinds.${index}`,
        `Missing credential kind for provider ${provider}: ${kind}`,
      ));
    }
  }

  const activeStates = lifecycleStates.filter(
    (state) => state.provider === provider && state.lifecyclePhase === "active",
  );
  if (activeStates.length === 0 && missing.length === required.length) {
    diagnostics.push(blockDiagnostic(
      "forbidden_state_detected",
      "lifecycle",
      `No active credential lifecycle states for provider ${provider}.`,
    ));
  }

  for (const state of lifecycleStates) {
    if (state.provider !== provider) continue;
    if (!isAuthorizationStateSufficient(state.authorizationState)) {
      diagnostics.push(blockDiagnostic(
        "forbidden_state_detected",
        `lifecycle.${state.credentialRefId}`,
        `Credential ${state.credentialRefId} authorization state is insufficient: ${state.authorizationState}.`,
      ));
    }
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

export function serializeSocialCredentialDomainContract(
  contract: SocialCredentialDomainContract = SOCIAL_CREDENTIAL_DOMAIN_CONTRACT,
): string {
  return JSON.stringify(toStableValue(contract));
}

export function hydrateSocialCredentialDomainContract(
  serialized: string,
): Readonly<{
  ok: true;
  value: SocialCredentialDomainContract;
}> | Readonly<{
  ok: false;
  diagnostics: readonly SocialCredentialDiagnostic[];
}> {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const validation = validateSocialCredentialDomainContract(parsed);
    if (!validation.valid || !isRecord(parsed)) {
      return { ok: false, diagnostics: validation.diagnostics };
    }
    return { ok: true, value: deepFreeze(parsed as SocialCredentialDomainContract) };
  } catch {
    return {
      ok: false,
      diagnostics: [
        errorDiagnostic(
          "serialization_invalid",
          "serialized",
          "Credential domain contract serialization must be valid JSON.",
        ),
      ],
    };
  }
}

function validateIdentity(
  identity: unknown,
  path: string,
  diagnostics: SocialCredentialDiagnostic[],
): void {
  if (!isRecord(identity)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", path, "Credential domain identity must be an object."));
    return;
  }
  requireText(identity.domainId, `${path}.domainId`, "credential_ref_id_required", diagnostics);
  if (identity.domainVersion !== SOCIAL_CREDENTIAL_DOMAIN_VERSION) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.domainVersion`,
      "Credential domain version must match current contract version.",
    ));
  }
  if (
    identity.contractOnly !== true ||
    identity.containsCredentials !== false ||
    identity.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "Credential domain identity must remain contract-only and non-executing.",
    ));
  }
}

function validateCapabilities(
  capabilities: unknown,
  path: string,
  diagnostics: SocialCredentialDiagnostic[],
): void {
  if (!isRecord(capabilities)) {
    diagnostics.push(errorDiagnostic("capabilities_invalid", path, "Credential domain capabilities must be an object."));
    return;
  }
  if (
    capabilities.allowsEncryption !== false ||
    capabilities.allowsDecryption !== false ||
    capabilities.allowsLiveCredentials !== false ||
    capabilities.allowsNetwork !== false ||
    capabilities.allowsPersistence !== false ||
    capabilities.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "capabilities_invalid",
      path,
      "Credential domain capabilities must forbid encryption, decryption, live credentials, network, persistence, and execution permission.",
    ));
  }
}

function validateSafety(
  safety: unknown,
  path: string,
  diagnostics: SocialCredentialDiagnostic[],
): void {
  if (!isRecord(safety)) {
    diagnostics.push(errorDiagnostic(
      "safety_requirements_invalid",
      path,
      "Credential domain safety requirements must be an object.",
    ));
    return;
  }
  const requiredFlags = [
    "contractOnly",
    "referencesOnly",
    "usesNoOAuth",
    "usesNoCredentials",
    "storesNoSecrets",
    "storesNoTokens",
    "storesNoPlaintext",
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
        "Credential domain safety requirement invariant failed.",
      ));
    }
  }
}

function requireText(
  value: unknown,
  path: string,
  code: SocialCredentialErrorCode,
  diagnostics: SocialCredentialDiagnostic[],
): void {
  if (hasText(value)) return;
  diagnostics.push(errorDiagnostic(code, path, "Required credential domain text field is missing."));
}

function errorDiagnostic(
  code: SocialCredentialErrorCode,
  path: string,
  message: string,
): SocialCredentialDiagnostic {
  return { code, path, message, severity: "error" };
}

function blockDiagnostic(
  code: SocialCredentialErrorCode,
  path: string,
  message: string,
): SocialCredentialDiagnostic {
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
