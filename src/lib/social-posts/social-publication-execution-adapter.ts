export const SOCIAL_PUBLICATION_EXECUTION_ADAPTER_PLATFORMS = [
  "facebook",
  "instagram",
] as const;

export const SOCIAL_PUBLICATION_EXECUTION_ADAPTER_CHANNEL_TYPES = [
  "facebook_page",
  "instagram_business_account",
] as const;

export const SOCIAL_PUBLICATION_EXECUTION_ADAPTER_KINDS = [
  "reference",
  "platform_contract",
] as const;

export const SOCIAL_PUBLICATION_EXECUTION_ADAPTER_OPERATIONS = [
  "simulate_execution",
  "dry_run_execution",
] as const;

export const SOCIAL_PUBLICATION_EXECUTION_ADAPTER_RESPONSE_STATUSES = [
  "simulated",
  "blocked",
  "rejected",
] as const;

export const SOCIAL_PUBLICATION_EXECUTION_ADAPTER_ERROR_CODES = [
  "adapter_id_required",
  "adapter_kind_unknown",
  "channel_id_required",
  "channel_platform_unknown",
  "channel_type_unknown",
  "channel_identity_invalid",
  "request_id_required",
  "request_adapter_mismatch",
  "request_operation_unknown",
  "response_id_required",
  "response_status_unknown",
  "response_request_mismatch",
  "evidence_id_required",
  "evidence_kind_unknown",
  "execution_job_id_required",
  "execution_intent_id_required",
  "publication_target_id_required",
  "timestamp_invalid",
  "capabilities_invalid",
  "safety_requirements_invalid",
  "preflight_requirements_invalid",
  "dry_run_support_invalid",
  "contract_invariant_failed",
  "secret_forbidden",
  "credential_forbidden",
  "oauth_forbidden",
  "external_api_forbidden",
  "sdk_forbidden",
  "network_forbidden",
  "serialization_invalid",
] as const;

export type SocialPublicationExecutionAdapterPlatform =
  (typeof SOCIAL_PUBLICATION_EXECUTION_ADAPTER_PLATFORMS)[number];

export type SocialPublicationExecutionAdapterChannelType =
  (typeof SOCIAL_PUBLICATION_EXECUTION_ADAPTER_CHANNEL_TYPES)[number];

export type SocialPublicationExecutionAdapterKind =
  (typeof SOCIAL_PUBLICATION_EXECUTION_ADAPTER_KINDS)[number];

export type SocialPublicationExecutionAdapterOperation =
  (typeof SOCIAL_PUBLICATION_EXECUTION_ADAPTER_OPERATIONS)[number];

export type SocialPublicationExecutionAdapterResponseStatus =
  (typeof SOCIAL_PUBLICATION_EXECUTION_ADAPTER_RESPONSE_STATUSES)[number];

export type SocialPublicationExecutionAdapterErrorCode =
  (typeof SOCIAL_PUBLICATION_EXECUTION_ADAPTER_ERROR_CODES)[number];

export type SocialPublicationExecutionAdapterError = Readonly<{
  code: SocialPublicationExecutionAdapterErrorCode;
  path: string;
  message: string;
  severity: "block" | "error";
}>;

export type SocialPublicationExecutionAdapterJsonPrimitive = string | number | boolean | null;

export type SocialPublicationExecutionAdapterJsonValue =
  | SocialPublicationExecutionAdapterJsonPrimitive
  | readonly SocialPublicationExecutionAdapterJsonValue[]
  | { readonly [key: string]: SocialPublicationExecutionAdapterJsonValue };

export type SocialPublicationExecutionAdapterJsonObject = Readonly<{
  [key: string]: SocialPublicationExecutionAdapterJsonValue;
}>;

export type SocialPublicationExecutionAdapterIdentity = Readonly<{
  adapterId: string;
  adapterKind: SocialPublicationExecutionAdapterKind;
  displayName: string;
  contractOnly: true;
  implementsNothing: true;
  containsCredentials: false;
  containsOAuthFlow: false;
  containsNetworkClient: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPublicationExecutionAdapterChannelIdentity = Readonly<{
  channelId: string;
  platform: SocialPublicationExecutionAdapterPlatform;
  channelType: SocialPublicationExecutionAdapterChannelType;
  publicationTargetId: string;
  externalChannelReference: string | null;
  displayName: string | null;
  identityOnly: true;
  containsCredentials: false;
  containsSdkClient: false;
  containsStorageReference: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPublicationExecutionAdapterCapabilities = Readonly<{
  supportsDryRun: boolean;
  supportsEvidenceCapture: boolean;
  supportsPreflightEvaluation: boolean;
  supportedPlatforms: readonly SocialPublicationExecutionAdapterPlatform[];
  supportedChannelTypes: readonly SocialPublicationExecutionAdapterChannelType[];
  allowsNetwork: false;
  allowsOAuth: false;
  allowsCredentials: false;
  allowsExternalApiCall: false;
  allowsSdkUsage: false;
  executesNothing: true;
  publishesNothing: true;
  grantsExecutionPermission: false;
}>;

export type SocialPublicationExecutionAdapterSafetyRequirements = Readonly<{
  contractOnly: true;
  modelAuthorityOnly: true;
  referencesOnly: true;
  callsNoExternalApis: true;
  usesNoSdks: true;
  usesNoNetwork: true;
  usesNoOAuth: true;
  usesNoCredentials: true;
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

export type SocialPublicationExecutionAdapterPreflightRequirements = Readonly<{
  requiresOwnerApproval: true;
  requiresPublisherAuthority: true;
  requiresPreflightPass: true;
  requiresPublicationTarget: true;
  requiresPublisherRequest: true;
  requiresSchedulerIntent: true;
  requiresLedgerEvidence: true;
  requiresManifestReference: true;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
}>;

export type SocialPublicationExecutionAdapterDryRunSupport = Readonly<{
  dryRunSupported: boolean;
  dryRunOnly: boolean;
  simulatesResponse: true;
  persistsNothing: true;
  callsNoExternalApis: true;
  usesNoNetwork: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPublicationExecutionAdapterRequest = Readonly<{
  requestId: string;
  adapterId: string;
  executionJobId: string;
  executionIntentId: string;
  channel: SocialPublicationExecutionAdapterChannelIdentity;
  operation: SocialPublicationExecutionAdapterOperation;
  requestedAt: string;
  contractOnly: true;
  modelAuthorityOnly: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  callsNoExternalApis: true;
  usesNoNetwork: true;
  usesNoOAuth: true;
  usesNoCredentials: true;
}>;

export type SocialPublicationExecutionAdapterResponse = Readonly<{
  responseId: string;
  requestId: string;
  adapterId: string;
  status: SocialPublicationExecutionAdapterResponseStatus;
  message: string | null;
  simulatedExternalReference: null;
  sanitizedSummary: SocialPublicationExecutionAdapterJsonObject;
  containsFullPayload: false;
  containsSecrets: false;
  provesExecution: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPublicationExecutionAdapterEvidence = Readonly<{
  evidenceId: string;
  adapterId: string;
  requestId: string;
  responseId: string | null;
  evidenceKind: "dry_run_evidence" | "contract_evidence";
  notes: string | null;
  sanitizedSummary: SocialPublicationExecutionAdapterJsonObject;
  containsSecrets: false;
  provesExecution: false;
  grantsExecutionPermission: false;
  persistsNothing: true;
}>;

export type SocialPublicationExecutionAdapterContract = Readonly<{
  identity: SocialPublicationExecutionAdapterIdentity;
  capabilities: SocialPublicationExecutionAdapterCapabilities;
  safety: SocialPublicationExecutionAdapterSafetyRequirements;
  preflight: SocialPublicationExecutionAdapterPreflightRequirements;
  dryRun: SocialPublicationExecutionAdapterDryRunSupport;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

const PLATFORM_SET = new Set<string>(SOCIAL_PUBLICATION_EXECUTION_ADAPTER_PLATFORMS);
const CHANNEL_TYPE_SET = new Set<string>(SOCIAL_PUBLICATION_EXECUTION_ADAPTER_CHANNEL_TYPES);
const CHANNEL_TYPE_PLATFORM: Readonly<
  Record<SocialPublicationExecutionAdapterChannelType, SocialPublicationExecutionAdapterPlatform>
> = {
  facebook_page: "facebook",
  instagram_business_account: "instagram",
};

export function isSocialPublicationExecutionAdapterPlatform(
  value: unknown,
): value is SocialPublicationExecutionAdapterPlatform {
  return typeof value === "string" && PLATFORM_SET.has(value);
}

export function isSocialPublicationExecutionAdapterChannelType(
  value: unknown,
): value is SocialPublicationExecutionAdapterChannelType {
  return typeof value === "string" && CHANNEL_TYPE_SET.has(value);
}

export function validateSocialPublicationExecutionAdapterContract(
  contract: unknown,
): Readonly<{
  valid: boolean;
  diagnostics: readonly SocialPublicationExecutionAdapterError[];
}> {
  const diagnostics: SocialPublicationExecutionAdapterError[] = [];
  if (!isRecord(contract)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", "contract", "Adapter contract must be an object."),
      ],
    };
  }

  validateIdentity(contract.identity, "contract.identity", diagnostics);
  validateCapabilities(contract.capabilities, "contract.capabilities", diagnostics);
  validateSafety(contract.safety, "contract.safety", diagnostics);
  validatePreflightRequirements(contract.preflight, "contract.preflight", diagnostics);
  validateDryRunSupport(contract.dryRun, "contract.dryRun", diagnostics);

  if (contract.grantsExecutionPermission !== false) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      "contract.grantsExecutionPermission",
      "Adapter contract must not grant execution permission.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialPublicationExecutionAdapterRequest(
  request: unknown,
): Readonly<{
  valid: boolean;
  diagnostics: readonly SocialPublicationExecutionAdapterError[];
}> {
  const diagnostics: SocialPublicationExecutionAdapterError[] = [];
  if (!isRecord(request)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", "request", "Adapter request must be an object."),
      ],
    };
  }

  requireText(request.requestId, "request.requestId", "request_id_required", diagnostics);
  requireText(request.adapterId, "request.adapterId", "adapter_id_required", diagnostics);
  requireText(request.executionJobId, "request.executionJobId", "execution_job_id_required", diagnostics);
  requireText(request.executionIntentId, "request.executionIntentId", "execution_intent_id_required", diagnostics);
  if (!isValidTimestamp(request.requestedAt)) {
    diagnostics.push(errorDiagnostic(
      "timestamp_invalid",
      "request.requestedAt",
      "Adapter request requires a valid requestedAt timestamp.",
    ));
  }
  if (
    request.operation !== "simulate_execution" &&
    request.operation !== "dry_run_execution"
  ) {
    diagnostics.push(errorDiagnostic(
      "request_operation_unknown",
      "request.operation",
      "Adapter request operation is not supported.",
    ));
  }
  validateChannelIdentity(request.channel, "request.channel", diagnostics);
  assertForbiddenFlags(request, "request", diagnostics);

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialPublicationExecutionAdapterResponse(
  response: unknown,
): Readonly<{
  valid: boolean;
  diagnostics: readonly SocialPublicationExecutionAdapterError[];
}> {
  const diagnostics: SocialPublicationExecutionAdapterError[] = [];
  if (!isRecord(response)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", "response", "Adapter response must be an object."),
      ],
    };
  }

  requireText(response.responseId, "response.responseId", "response_id_required", diagnostics);
  requireText(response.requestId, "response.requestId", "request_id_required", diagnostics);
  requireText(response.adapterId, "response.adapterId", "adapter_id_required", diagnostics);
  if (
    response.status !== "simulated" &&
    response.status !== "blocked" &&
    response.status !== "rejected"
  ) {
    diagnostics.push(errorDiagnostic(
      "response_status_unknown",
      "response.status",
      "Adapter response status is not supported.",
    ));
  }
  if (response.simulatedExternalReference !== null) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      "response.simulatedExternalReference",
      "Adapter response must not include external references.",
    ));
  }
  if (response.provesExecution !== false || response.grantsExecutionPermission !== false) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      "response",
      "Adapter response must not prove execution or grant permission.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function evaluateSocialPublicationExecutionAdapterPreflightRequirements(
  contract: SocialPublicationExecutionAdapterContract,
  input: Readonly<{
    ownerApprovalPresent: boolean;
    publisherAuthorityPresent: boolean;
    preflightPassed: boolean;
    publicationTargetPresent: boolean;
    publisherRequestPresent: boolean;
    schedulerIntentPresent: boolean;
    ledgerEvidencePresent: boolean;
    manifestReferencePresent: boolean;
  }>,
): Readonly<{
  status: "pass" | "block";
  missingRequirements: readonly string[];
  diagnostics: readonly SocialPublicationExecutionAdapterError[];
}> {
  const diagnostics: SocialPublicationExecutionAdapterError[] = [];
  const missingRequirements: string[] = [];

  const checks: readonly [boolean, string, string][] = [
    [input.ownerApprovalPresent, "owner_approval", "Owner approval evidence is required."],
    [input.publisherAuthorityPresent, "publisher_authority", "Publisher authority evidence is required."],
    [input.preflightPassed, "preflight_pass", "Preflight pass is required."],
    [input.publicationTargetPresent, "publication_target", "Publication target reference is required."],
    [input.publisherRequestPresent, "publisher_request", "Publisher request reference is required."],
    [input.schedulerIntentPresent, "scheduler_intent", "Scheduler intent reference is required."],
    [input.ledgerEvidencePresent, "ledger_evidence", "Ledger evidence reference is required."],
    [input.manifestReferencePresent, "publication_manifest", "Publication manifest reference is required."],
  ];

  for (const [present, label, message] of checks) {
    if (present) continue;
    missingRequirements.push(label);
    diagnostics.push(blockDiagnostic(
      "preflight_requirements_invalid",
      `contract.preflight.${label}`,
      message,
    ));
  }

  if (!contract.preflight.requiresOwnerApproval) {
    diagnostics.push(blockDiagnostic(
      "preflight_requirements_invalid",
      "contract.preflight.requiresOwnerApproval",
      "Adapter preflight contract must require owner approval.",
    ));
  }

  return {
    status: diagnostics.length === 0 ? "pass" : "block",
    missingRequirements,
    diagnostics,
  };
}

export function serializeSocialPublicationExecutionAdapterContract(
  contract: SocialPublicationExecutionAdapterContract,
): string {
  return JSON.stringify(toStableValue(contract));
}

export function hydrateSocialPublicationExecutionAdapterContract(
  serialized: string,
): Readonly<{
  ok: true;
  value: SocialPublicationExecutionAdapterContract;
}> | Readonly<{
  ok: false;
  diagnostics: readonly SocialPublicationExecutionAdapterError[];
}> {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const validation = validateSocialPublicationExecutionAdapterContract(parsed);
    if (!validation.valid || !isRecord(parsed)) {
      return { ok: false, diagnostics: validation.diagnostics };
    }
    return { ok: true, value: deepFreeze(parsed as SocialPublicationExecutionAdapterContract) };
  } catch {
    return {
      ok: false,
      diagnostics: [
        errorDiagnostic(
          "serialization_invalid",
          "serialized",
          "Adapter contract serialization must be valid JSON.",
        ),
      ],
    };
  }
}

export function adapterSupportsPlatform(
  contract: SocialPublicationExecutionAdapterContract,
  platform: SocialPublicationExecutionAdapterPlatform,
): boolean {
  return contract.capabilities.supportedPlatforms.includes(platform);
}

export function adapterSupportsChannelType(
  contract: SocialPublicationExecutionAdapterContract,
  channelType: SocialPublicationExecutionAdapterChannelType,
): boolean {
  return contract.capabilities.supportedChannelTypes.includes(channelType);
}

function validateIdentity(
  identity: unknown,
  path: string,
  diagnostics: SocialPublicationExecutionAdapterError[],
): void {
  if (!isRecord(identity)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", path, "Adapter identity must be an object."));
    return;
  }
  requireText(identity.adapterId, `${path}.adapterId`, "adapter_id_required", diagnostics);
  if (
    identity.adapterKind !== "reference" &&
    identity.adapterKind !== "platform_contract"
  ) {
    diagnostics.push(errorDiagnostic("adapter_kind_unknown", `${path}.adapterKind`, "Adapter kind is not supported."));
  }
  if (
    identity.contractOnly !== true ||
    identity.implementsNothing !== true ||
    identity.containsCredentials !== false ||
    identity.containsOAuthFlow !== false ||
    identity.containsNetworkClient !== false ||
    identity.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "Adapter identity must remain contract-only and non-executing.",
    ));
  }
}

function validateCapabilities(
  capabilities: unknown,
  path: string,
  diagnostics: SocialPublicationExecutionAdapterError[],
): void {
  if (!isRecord(capabilities)) {
    diagnostics.push(errorDiagnostic("capabilities_invalid", path, "Adapter capabilities must be an object."));
    return;
  }
  if (!Array.isArray(capabilities.supportedPlatforms)) {
    diagnostics.push(errorDiagnostic("capabilities_invalid", `${path}.supportedPlatforms`, "Supported platforms must be an array."));
  } else {
    capabilities.supportedPlatforms.forEach((platform, index) => {
      if (!isSocialPublicationExecutionAdapterPlatform(platform)) {
        diagnostics.push(errorDiagnostic(
          "channel_platform_unknown",
          `${path}.supportedPlatforms.${index}`,
          "Supported platform is not recognized.",
        ));
      }
    });
  }
  if (!Array.isArray(capabilities.supportedChannelTypes)) {
    diagnostics.push(errorDiagnostic("capabilities_invalid", `${path}.supportedChannelTypes`, "Supported channel types must be an array."));
  } else {
    capabilities.supportedChannelTypes.forEach((channelType, index) => {
      if (!isSocialPublicationExecutionAdapterChannelType(channelType)) {
        diagnostics.push(errorDiagnostic(
          "channel_type_unknown",
          `${path}.supportedChannelTypes.${index}`,
          "Supported channel type is not recognized.",
        ));
      }
    });
  }
  if (
    capabilities.allowsNetwork !== false ||
    capabilities.allowsOAuth !== false ||
    capabilities.allowsCredentials !== false ||
    capabilities.allowsExternalApiCall !== false ||
    capabilities.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "capabilities_invalid",
      path,
      "Adapter capabilities must forbid network, OAuth, credentials, and execution permission.",
    ));
  }
}

function validateSafety(
  safety: unknown,
  path: string,
  diagnostics: SocialPublicationExecutionAdapterError[],
): void {
  if (!isRecord(safety)) {
    diagnostics.push(errorDiagnostic("safety_requirements_invalid", path, "Adapter safety requirements must be an object."));
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
        "Adapter safety requirement invariant failed.",
      ));
    }
  }
}

function validatePreflightRequirements(
  preflight: unknown,
  path: string,
  diagnostics: SocialPublicationExecutionAdapterError[],
): void {
  if (!isRecord(preflight)) {
    diagnostics.push(errorDiagnostic(
      "preflight_requirements_invalid",
      path,
      "Adapter preflight requirements must be an object.",
    ));
    return;
  }
  const requiredTrue = [
    "requiresOwnerApproval",
    "requiresPublisherAuthority",
    "requiresPreflightPass",
    "requiresPublicationTarget",
    "requiresPublisherRequest",
    "requiresSchedulerIntent",
    "requiresLedgerEvidence",
    "requiresManifestReference",
  ] as const;
  for (const flag of requiredTrue) {
    if (preflight[flag] !== true) {
      diagnostics.push(errorDiagnostic(
        "preflight_requirements_invalid",
        `${path}.${flag}`,
        "Adapter preflight requirement must remain enabled.",
      ));
    }
  }
}

function validateDryRunSupport(
  dryRun: unknown,
  path: string,
  diagnostics: SocialPublicationExecutionAdapterError[],
): void {
  if (!isRecord(dryRun)) {
    diagnostics.push(errorDiagnostic("dry_run_support_invalid", path, "Adapter dry-run support must be an object."));
    return;
  }
  if (typeof dryRun.dryRunSupported !== "boolean") {
    diagnostics.push(errorDiagnostic(
      "dry_run_support_invalid",
      `${path}.dryRunSupported`,
      "Adapter dry-run support flag is required.",
    ));
  }
  if (
    dryRun.simulatesResponse !== true ||
    dryRun.persistsNothing !== true ||
    dryRun.callsNoExternalApis !== true ||
    dryRun.usesNoNetwork !== true ||
    dryRun.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "dry_run_support_invalid",
      path,
      "Adapter dry-run support must remain simulated-only and non-executing.",
    ));
  }
}

function validateChannelIdentity(
  channel: unknown,
  path: string,
  diagnostics: SocialPublicationExecutionAdapterError[],
): void {
  if (!isRecord(channel)) {
    diagnostics.push(errorDiagnostic("channel_identity_invalid", path, "Adapter channel identity must be an object."));
    return;
  }
  requireText(channel.channelId, `${path}.channelId`, "channel_id_required", diagnostics);
  requireText(channel.publicationTargetId, `${path}.publicationTargetId`, "publication_target_id_required", diagnostics);
  if (!isSocialPublicationExecutionAdapterPlatform(channel.platform)) {
    diagnostics.push(errorDiagnostic("channel_platform_unknown", `${path}.platform`, "Adapter channel platform is not supported."));
  }
  if (!isSocialPublicationExecutionAdapterChannelType(channel.channelType)) {
    diagnostics.push(errorDiagnostic("channel_type_unknown", `${path}.channelType`, "Adapter channel type is not supported."));
  } else if (
    isSocialPublicationExecutionAdapterPlatform(channel.platform) &&
    CHANNEL_TYPE_PLATFORM[channel.channelType] !== channel.platform
  ) {
    diagnostics.push(errorDiagnostic(
      "channel_identity_invalid",
      path,
      "Adapter channel type must match platform.",
    ));
  }
  if (
    channel.identityOnly !== true ||
    channel.containsCredentials !== false ||
    channel.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "channel_identity_invalid",
      path,
      "Adapter channel identity must remain reference-only.",
    ));
  }
}

function assertForbiddenFlags(
  value: Record<string, unknown>,
  path: string,
  diagnostics: SocialPublicationExecutionAdapterError[],
): void {
  if (value.usesNoCredentials === false) {
    diagnostics.push(errorDiagnostic("credential_forbidden", path, "Adapter request must not use credentials."));
  }
  if (value.usesNoOAuth === false) {
    diagnostics.push(errorDiagnostic("oauth_forbidden", path, "Adapter request must not use OAuth."));
  }
  if (value.callsNoExternalApis === false) {
    diagnostics.push(errorDiagnostic("external_api_forbidden", path, "Adapter request must not call external APIs."));
  }
  if (value.usesNoNetwork === false) {
    diagnostics.push(errorDiagnostic("network_forbidden", path, "Adapter request must not use network."));
  }
  if (value.grantsExecutionPermission !== false) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "Adapter request must not grant execution permission.",
    ));
  }
}

function requireText(
  value: unknown,
  path: string,
  code: SocialPublicationExecutionAdapterErrorCode,
  diagnostics: SocialPublicationExecutionAdapterError[],
): void {
  if (hasText(value)) return;
  diagnostics.push(errorDiagnostic(code, path, "Required adapter text field is missing."));
}

function errorDiagnostic(
  code: SocialPublicationExecutionAdapterErrorCode,
  path: string,
  message: string,
): SocialPublicationExecutionAdapterError {
  return { code, path, message, severity: "error" };
}

function blockDiagnostic(
  code: SocialPublicationExecutionAdapterErrorCode,
  path: string,
  message: string,
): SocialPublicationExecutionAdapterError {
  return { code, path, message, severity: "block" };
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidTimestamp(value: unknown): value is string {
  return hasText(value) && Number.isFinite(Date.parse(value));
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
