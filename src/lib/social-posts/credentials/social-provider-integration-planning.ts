import {
  SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
  SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS,
  platformsForProvider,
  type SocialPlatformCredentialProvider,
  isSocialPlatformCredentialProvider,
} from "../social-platform-credential-boundary";
import { SOCIAL_PLATFORM_OAUTH_BOUNDARY_VERSION } from "../social-platform-oauth-boundary";
import type { SocialPlatformAdapterPlatform } from "../social-platform-adapter-registry";
import { SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION } from "./social-credential-runtime-orchestrator";

export const SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION = "d15-w2-v1" as const;

export const SOCIAL_PROVIDER_INTEGRATION_INTENT_KINDS = [
  "connection_planning",
  "capability_assessment",
  "authorization_boundary_review",
  "communication_boundary_review",
  "orchestration_compatibility_review",
] as const;

export const SOCIAL_PROVIDER_INTEGRATION_INTENT_STATUSES = [
  "planned",
  "waiting",
  "blocked",
  "forbidden",
] as const;

export const SOCIAL_PROVIDER_CONNECTION_STATES = [
  "not_connected",
  "connection_planned",
  "connection_blocked",
  "connection_forbidden",
] as const;

export const SOCIAL_PROVIDER_CONNECTION_CAPABILITY_FLAGS = [
  "connection_reference_only",
  "live_connection_blocked",
  "sdk_integration_blocked",
  "network_blocked",
  "execution_blocked",
] as const;

export const SOCIAL_PROVIDER_INTEGRATION_CAPABILITIES = [
  "profile_read_modeled",
  "media_validate_modeled",
  "publish_simulation_modeled",
  "token_refresh_modeled",
  "webhook_receive_modeled",
  "rate_limit_probe_modeled",
] as const;

export const SOCIAL_PROVIDER_CAPABILITY_STATUSES = [
  "supported",
  "unsupported",
  "forbidden",
] as const;

export const SOCIAL_PROVIDER_AUTHORIZATION_MODES = [
  "reference_only",
  "modeled_oauth_only",
  "live_authorization_forbidden",
] as const;

export const SOCIAL_PROVIDER_AUTHORIZATION_BOUNDARY_FLAGS = [
  "authorization_reference_only",
  "oauth_flow_blocked",
  "token_exchange_blocked",
  "callback_route_blocked",
  "live_authorization_forbidden",
  "execution_blocked",
] as const;

export const SOCIAL_PROVIDER_COMMUNICATION_MODES = [
  "none",
  "modeled_only",
  "live_communication_forbidden",
] as const;

export const SOCIAL_PROVIDER_COMMUNICATION_CHANNEL_KINDS = [
  "http_request_blocked",
  "webhook_blocked",
  "streaming_blocked",
  "sdk_call_blocked",
] as const;

export const SOCIAL_PROVIDER_COMMUNICATION_BOUNDARY_FLAGS = [
  "communication_reference_only",
  "http_blocked",
  "webhook_blocked",
  "sdk_blocked",
  "network_blocked",
  "live_communication_forbidden",
  "execution_blocked",
] as const;

export const SOCIAL_PROVIDER_INTEGRATION_PLANNING_ERROR_CODES = [
  "provider_unknown",
  "intent_kind_unknown",
  "intent_status_unknown",
  "intent_id_required",
  "connection_state_unknown",
  "capability_unknown",
  "capability_status_unknown",
  "authorization_mode_unknown",
  "communication_mode_unknown",
  "communication_channel_unknown",
  "contract_invariant_failed",
  "forbidden_live_connection",
  "forbidden_live_authorization",
  "forbidden_live_communication",
  "forbidden_execution_permission",
  "forbidden_network_flag",
  "serialization_invalid",
  "capabilities_invalid",
  "safety_requirements_invalid",
  "orchestrator_version_mismatch",
] as const;

export type SocialProviderIntegrationIntentKind =
  (typeof SOCIAL_PROVIDER_INTEGRATION_INTENT_KINDS)[number];

export type SocialProviderIntegrationIntentStatus =
  (typeof SOCIAL_PROVIDER_INTEGRATION_INTENT_STATUSES)[number];

export type SocialProviderConnectionState =
  (typeof SOCIAL_PROVIDER_CONNECTION_STATES)[number];

export type SocialProviderConnectionCapabilityFlag =
  (typeof SOCIAL_PROVIDER_CONNECTION_CAPABILITY_FLAGS)[number];

export type SocialProviderIntegrationCapability =
  (typeof SOCIAL_PROVIDER_INTEGRATION_CAPABILITIES)[number];

export type SocialProviderCapabilityStatus =
  (typeof SOCIAL_PROVIDER_CAPABILITY_STATUSES)[number];

export type SocialProviderAuthorizationMode =
  (typeof SOCIAL_PROVIDER_AUTHORIZATION_MODES)[number];

export type SocialProviderAuthorizationBoundaryFlag =
  (typeof SOCIAL_PROVIDER_AUTHORIZATION_BOUNDARY_FLAGS)[number];

export type SocialProviderCommunicationMode =
  (typeof SOCIAL_PROVIDER_COMMUNICATION_MODES)[number];

export type SocialProviderCommunicationChannelKind =
  (typeof SOCIAL_PROVIDER_COMMUNICATION_CHANNEL_KINDS)[number];

export type SocialProviderCommunicationBoundaryFlag =
  (typeof SOCIAL_PROVIDER_COMMUNICATION_BOUNDARY_FLAGS)[number];

export type SocialProviderIntegrationPlanningErrorCode =
  (typeof SOCIAL_PROVIDER_INTEGRATION_PLANNING_ERROR_CODES)[number];

export type SocialProviderIntegrationPlanningDiagnostic = Readonly<{
  code: SocialProviderIntegrationPlanningErrorCode;
  path: string;
  message: string;
  severity: "block" | "error" | "warning";
}>;

export type SocialProviderIntegrationPlanningValidationResult = Readonly<{
  valid: boolean;
  diagnostics: readonly SocialProviderIntegrationPlanningDiagnostic[];
}>;

export type SocialProviderIntegrationIntent = Readonly<{
  intentId: string;
  provider: SocialPlatformCredentialProvider;
  kind: SocialProviderIntegrationIntentKind;
  status: SocialProviderIntegrationIntentStatus;
  label: string;
  description: string;
  orchestratorVersion: typeof SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION;
  planningVersion: typeof SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION;
  blockingReasons: readonly string[];
  contractOnly: true;
  planningOnly: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialProviderConnectionBoundaryCapabilities = Readonly<{
  connectionState: SocialProviderConnectionState;
  capabilityFlags: readonly SocialProviderConnectionCapabilityFlag[];
  allowsLiveConnection: false;
  allowsSdkIntegration: false;
  allowsNetwork: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialProviderConnectionBoundaryContract = Readonly<{
  connectionContractId: string;
  provider: SocialPlatformCredentialProvider;
  planningVersion: typeof SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION;
  credentialBoundaryVersion: typeof SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION;
  platforms: readonly SocialPlatformAdapterPlatform[];
  capabilities: SocialProviderConnectionBoundaryCapabilities;
  contractOnly: true;
  implementsNothing: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialProviderCapabilityEntry = Readonly<{
  capability: SocialProviderIntegrationCapability;
  status: SocialProviderCapabilityStatus;
  rationale: string;
}>;

export type SocialProviderCapabilityBoundaryContract = Readonly<{
  capabilityContractId: string;
  provider: SocialPlatformCredentialProvider;
  planningVersion: typeof SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION;
  entries: readonly SocialProviderCapabilityEntry[];
  supportedCapabilities: readonly SocialProviderIntegrationCapability[];
  unsupportedCapabilities: readonly SocialProviderIntegrationCapability[];
  forbiddenCapabilities: readonly SocialProviderIntegrationCapability[];
  contractOnly: true;
  implementsNothing: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialProviderAuthorizationBoundaryCapabilities = Readonly<{
  authorizationMode: SocialProviderAuthorizationMode;
  capabilityFlags: readonly SocialProviderAuthorizationBoundaryFlag[];
  allowsLiveAuthorization: false;
  allowsTokenExchange: false;
  allowsCallbackRoute: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialProviderAuthorizationBoundaryContract = Readonly<{
  authorizationContractId: string;
  provider: SocialPlatformCredentialProvider;
  planningVersion: typeof SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION;
  credentialBoundaryVersion: typeof SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION;
  oauthBoundaryVersion: typeof SOCIAL_PLATFORM_OAUTH_BOUNDARY_VERSION;
  capabilities: SocialProviderAuthorizationBoundaryCapabilities;
  contractOnly: true;
  implementsNothing: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialProviderCommunicationBoundaryCapabilities = Readonly<{
  communicationMode: SocialProviderCommunicationMode;
  blockedChannels: readonly SocialProviderCommunicationChannelKind[];
  capabilityFlags: readonly SocialProviderCommunicationBoundaryFlag[];
  allowsHttpRequests: false;
  allowsWebhooks: false;
  allowsSdkCalls: false;
  allowsNetwork: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialProviderCommunicationBoundaryContract = Readonly<{
  communicationContractId: string;
  provider: SocialPlatformCredentialProvider;
  planningVersion: typeof SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION;
  capabilities: SocialProviderCommunicationBoundaryCapabilities;
  contractOnly: true;
  implementsNothing: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialProviderIntegrationPlanningSafetyRequirements = Readonly<{
  contractOnly: true;
  planningOnly: true;
  referencesOnly: true;
  callsNoExternalApis: true;
  usesNoSdks: true;
  usesNoNetwork: true;
  usesNoOAuth: true;
  usesNoCredentials: true;
  storesNoSecrets: true;
  storesNoTokens: true;
  startsNoWorkers: true;
  createsNoQueues: true;
  exposesNoApiRoutes: true;
  mutatesNoSql: true;
  mutatesNoStorage: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialProviderIntegrationPlanningBundle = Readonly<{
  bundleId: string;
  provider: SocialPlatformCredentialProvider;
  planningVersion: typeof SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION;
  orchestratorVersion: typeof SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION;
  intents: readonly SocialProviderIntegrationIntent[];
  connectionContract: SocialProviderConnectionBoundaryContract;
  capabilityContract: SocialProviderCapabilityBoundaryContract;
  authorizationContract: SocialProviderAuthorizationBoundaryContract;
  communicationContract: SocialProviderCommunicationBoundaryContract;
  safety: SocialProviderIntegrationPlanningSafetyRequirements;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

const INTENT_KIND_SET = new Set<string>(SOCIAL_PROVIDER_INTEGRATION_INTENT_KINDS);
const INTENT_STATUS_SET = new Set<string>(SOCIAL_PROVIDER_INTEGRATION_INTENT_STATUSES);
const CONNECTION_STATE_SET = new Set<string>(SOCIAL_PROVIDER_CONNECTION_STATES);
const CAPABILITY_SET = new Set<string>(SOCIAL_PROVIDER_INTEGRATION_CAPABILITIES);
const CAPABILITY_STATUS_SET = new Set<string>(SOCIAL_PROVIDER_CAPABILITY_STATUSES);
const AUTHORIZATION_MODE_SET = new Set<string>(SOCIAL_PROVIDER_AUTHORIZATION_MODES);
const COMMUNICATION_MODE_SET = new Set<string>(SOCIAL_PROVIDER_COMMUNICATION_MODES);

const SHARED_SAFETY: SocialProviderIntegrationPlanningSafetyRequirements = {
  contractOnly: true,
  planningOnly: true,
  referencesOnly: true,
  callsNoExternalApis: true,
  usesNoSdks: true,
  usesNoNetwork: true,
  usesNoOAuth: true,
  usesNoCredentials: true,
  storesNoSecrets: true,
  storesNoTokens: true,
  startsNoWorkers: true,
  createsNoQueues: true,
  exposesNoApiRoutes: true,
  mutatesNoSql: true,
  mutatesNoStorage: true,
  grantsExecutionPermission: false,
  executesNothing: true,
  publishesNothing: true,
};

const SHARED_CONNECTION_FLAGS: readonly SocialProviderConnectionCapabilityFlag[] = [
  "connection_reference_only",
  "live_connection_blocked",
  "sdk_integration_blocked",
  "network_blocked",
  "execution_blocked",
];

const SHARED_AUTHORIZATION_FLAGS: readonly SocialProviderAuthorizationBoundaryFlag[] = [
  "authorization_reference_only",
  "oauth_flow_blocked",
  "token_exchange_blocked",
  "callback_route_blocked",
  "live_authorization_forbidden",
  "execution_blocked",
];

const SHARED_COMMUNICATION_FLAGS: readonly SocialProviderCommunicationBoundaryFlag[] = [
  "communication_reference_only",
  "http_blocked",
  "webhook_blocked",
  "sdk_blocked",
  "network_blocked",
  "live_communication_forbidden",
  "execution_blocked",
];

const PROVIDER_SUPPORTED_CAPABILITIES: Readonly<
  Record<SocialPlatformCredentialProvider, readonly SocialProviderIntegrationCapability[]>
> = {
  meta: [
    "profile_read_modeled",
    "media_validate_modeled",
    "publish_simulation_modeled",
    "token_refresh_modeled",
    "rate_limit_probe_modeled",
  ],
  tiktok: [
    "profile_read_modeled",
    "media_validate_modeled",
    "publish_simulation_modeled",
    "token_refresh_modeled",
    "rate_limit_probe_modeled",
  ],
  linkedin: [
    "profile_read_modeled",
    "media_validate_modeled",
    "publish_simulation_modeled",
    "token_refresh_modeled",
    "webhook_receive_modeled",
    "rate_limit_probe_modeled",
  ],
};

const PROVIDER_FORBIDDEN_CAPABILITIES: Readonly<
  Record<SocialPlatformCredentialProvider, readonly SocialProviderIntegrationCapability[]>
> = {
  meta: ["webhook_receive_modeled"],
  tiktok: ["webhook_receive_modeled"],
  linkedin: [],
};

function createIntegrationIntents(
  provider: SocialPlatformCredentialProvider,
): readonly SocialProviderIntegrationIntent[] {
  const specs: readonly [SocialProviderIntegrationIntentKind, string, string][] = [
    [
      "connection_planning",
      "Connection planning",
      `Model future ${provider} provider connection boundary without live SDK or network calls.`,
    ],
    [
      "capability_assessment",
      "Capability assessment",
      `Assess modeled-only capability compatibility for ${provider} integration planning.`,
    ],
    [
      "authorization_boundary_review",
      "Authorization boundary review",
      `Review reference-only authorization boundaries for ${provider} without OAuth execution.`,
    ],
    [
      "communication_boundary_review",
      "Communication boundary review",
      `Review forbidden live communication channels for ${provider} integration planning.`,
    ],
    [
      "orchestration_compatibility_review",
      "Orchestration compatibility review",
      `Verify ${provider} integration contracts remain compatible with D15 Wave 1 orchestration.`,
    ],
  ];

  return specs.map(([kind, label, description]) =>
    deepFreeze({
      intentId: `integration-intent-${provider}-${kind}`,
      provider,
      kind,
      status: "planned" as const,
      label,
      description,
      orchestratorVersion: SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION,
      planningVersion: SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION,
      blockingReasons: [],
      contractOnly: true as const,
      planningOnly: true as const,
      grantsExecutionPermission: false as const,
      executesNothing: true as const,
      publishesNothing: true as const,
    }),
  );
}

function createCapabilityEntries(
  provider: SocialPlatformCredentialProvider,
): readonly SocialProviderCapabilityEntry[] {
  const supported = new Set(PROVIDER_SUPPORTED_CAPABILITIES[provider]);
  const forbidden = new Set(PROVIDER_FORBIDDEN_CAPABILITIES[provider]);

  return SOCIAL_PROVIDER_INTEGRATION_CAPABILITIES.map((capability) => {
    const status: SocialProviderCapabilityStatus = forbidden.has(capability)
      ? "forbidden"
      : supported.has(capability)
        ? "supported"
        : "unsupported";
    const rationale =
      status === "forbidden"
        ? `${capability} is forbidden for ${provider} in D15 Wave 2 planning.`
        : status === "supported"
          ? `${capability} is modeled-only supported for ${provider}.`
          : `${capability} is not planned for ${provider} in D15 Wave 2.`;

    return deepFreeze({ capability, status, rationale });
  });
}

function createProviderIntegrationPlanningBundle(
  provider: SocialPlatformCredentialProvider,
): SocialProviderIntegrationPlanningBundle {
  const capabilityEntries = createCapabilityEntries(provider);
  const supportedCapabilities = capabilityEntries
    .filter((entry) => entry.status === "supported")
    .map((entry) => entry.capability);
  const unsupportedCapabilities = capabilityEntries
    .filter((entry) => entry.status === "unsupported")
    .map((entry) => entry.capability);
  const forbiddenCapabilities = capabilityEntries
    .filter((entry) => entry.status === "forbidden")
    .map((entry) => entry.capability);

  return deepFreeze({
    bundleId: `provider-integration-planning-${provider}`,
    provider,
    planningVersion: SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION,
    orchestratorVersion: SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION,
    intents: createIntegrationIntents(provider),
    connectionContract: {
      connectionContractId: `connection-boundary-${provider}`,
      provider,
      planningVersion: SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION,
      credentialBoundaryVersion: SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
      platforms: [...platformsForProvider(provider)],
      capabilities: {
        connectionState: "connection_planned",
        capabilityFlags: SHARED_CONNECTION_FLAGS,
        allowsLiveConnection: false,
        allowsSdkIntegration: false,
        allowsNetwork: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
      contractOnly: true,
      implementsNothing: true,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    capabilityContract: {
      capabilityContractId: `capability-boundary-${provider}`,
      provider,
      planningVersion: SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION,
      entries: capabilityEntries,
      supportedCapabilities,
      unsupportedCapabilities,
      forbiddenCapabilities,
      contractOnly: true,
      implementsNothing: true,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    authorizationContract: {
      authorizationContractId: `authorization-boundary-${provider}`,
      provider,
      planningVersion: SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION,
      credentialBoundaryVersion: SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
      oauthBoundaryVersion: SOCIAL_PLATFORM_OAUTH_BOUNDARY_VERSION,
      capabilities: {
        authorizationMode: "modeled_oauth_only",
        capabilityFlags: SHARED_AUTHORIZATION_FLAGS,
        allowsLiveAuthorization: false,
        allowsTokenExchange: false,
        allowsCallbackRoute: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
      contractOnly: true,
      implementsNothing: true,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    communicationContract: {
      communicationContractId: `communication-boundary-${provider}`,
      provider,
      planningVersion: SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION,
      capabilities: {
        communicationMode: "modeled_only",
        blockedChannels: [...SOCIAL_PROVIDER_COMMUNICATION_CHANNEL_KINDS],
        capabilityFlags: SHARED_COMMUNICATION_FLAGS,
        allowsHttpRequests: false,
        allowsWebhooks: false,
        allowsSdkCalls: false,
        allowsNetwork: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
      contractOnly: true,
      implementsNothing: true,
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

export const SOCIAL_PROVIDER_INTEGRATION_PLANNING_BUNDLES = Object.freeze(
  SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS.map(createProviderIntegrationPlanningBundle),
);

export function isSocialProviderIntegrationIntentKind(
  value: unknown,
): value is SocialProviderIntegrationIntentKind {
  return typeof value === "string" && INTENT_KIND_SET.has(value);
}

export function isSocialProviderIntegrationIntentStatus(
  value: unknown,
): value is SocialProviderIntegrationIntentStatus {
  return typeof value === "string" && INTENT_STATUS_SET.has(value);
}

export function isSocialProviderConnectionState(
  value: unknown,
): value is SocialProviderConnectionState {
  return typeof value === "string" && CONNECTION_STATE_SET.has(value);
}

export function isSocialProviderIntegrationCapability(
  value: unknown,
): value is SocialProviderIntegrationCapability {
  return typeof value === "string" && CAPABILITY_SET.has(value);
}

export function isSocialProviderCapabilityStatus(
  value: unknown,
): value is SocialProviderCapabilityStatus {
  return typeof value === "string" && CAPABILITY_STATUS_SET.has(value);
}

export function isSocialProviderAuthorizationMode(
  value: unknown,
): value is SocialProviderAuthorizationMode {
  return typeof value === "string" && AUTHORIZATION_MODE_SET.has(value);
}

export function isSocialProviderCommunicationMode(
  value: unknown,
): value is SocialProviderCommunicationMode {
  return typeof value === "string" && COMMUNICATION_MODE_SET.has(value);
}

export function createSocialProviderIntegrationPlanningBundle(
  provider: SocialPlatformCredentialProvider,
): SocialProviderIntegrationPlanningBundle {
  const bundle = SOCIAL_PROVIDER_INTEGRATION_PLANNING_BUNDLES.find(
    (candidate) => candidate.provider === provider,
  );
  if (!bundle) {
    throw new Error(`Provider integration planning bundle is unavailable for provider: ${provider}`);
  }
  return bundle;
}

export function validateSocialProviderIntegrationPlanningBundle(
  bundle: unknown,
): SocialProviderIntegrationPlanningValidationResult {
  const diagnostics: SocialProviderIntegrationPlanningDiagnostic[] = [];

  if (!isRecord(bundle)) {
    return invalidResult(diagnostics, errorDiagnostic(
      "serialization_invalid",
      "bundle",
      "Provider integration planning bundle must be an object.",
      "error",
    ));
  }

  if (!isSocialPlatformCredentialProvider(bundle.provider)) {
    diagnostics.push(errorDiagnostic("provider_unknown", "bundle.provider", "Provider is not supported.", "error"));
  }
  if (bundle.planningVersion !== SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      "bundle.planningVersion",
      "Planning version must match the current contract version.",
      "error",
    ));
  }
  if (bundle.orchestratorVersion !== SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION) {
    diagnostics.push(errorDiagnostic(
      "orchestrator_version_mismatch",
      "bundle.orchestratorVersion",
      "Orchestrator version must match D15 Wave 1 orchestrator version.",
      "error",
    ));
  }
  if (bundle.grantsExecutionPermission !== false) {
    diagnostics.push(errorDiagnostic(
      "forbidden_execution_permission",
      "bundle.grantsExecutionPermission",
      "Planning bundle must not grant execution permission.",
      "block",
    ));
  }

  validateIntents(bundle.intents, "bundle.intents", diagnostics);
  validateConnectionContract(bundle.connectionContract, "bundle.connectionContract", diagnostics);
  validateCapabilityContract(bundle.capabilityContract, "bundle.capabilityContract", diagnostics);
  validateAuthorizationContract(bundle.authorizationContract, "bundle.authorizationContract", diagnostics);
  validateCommunicationContract(bundle.communicationContract, "bundle.communicationContract", diagnostics);
  validateSafety(bundle.safety, "bundle.safety", diagnostics);

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function detectForbiddenProviderIntegrationState(
  bundle: SocialProviderIntegrationPlanningBundle,
): SocialProviderIntegrationPlanningValidationResult {
  const diagnostics: SocialProviderIntegrationPlanningDiagnostic[] = [];

  if (bundle.connectionContract.capabilities.allowsLiveConnection !== false) {
    diagnostics.push(errorDiagnostic(
      "forbidden_live_connection",
      "bundle.connectionContract.capabilities.allowsLiveConnection",
      "Live provider connection is forbidden in D15 Wave 2 planning.",
      "block",
    ));
  }
  if (bundle.authorizationContract.capabilities.allowsLiveAuthorization !== false) {
    diagnostics.push(errorDiagnostic(
      "forbidden_live_authorization",
      "bundle.authorizationContract.capabilities.allowsLiveAuthorization",
      "Live authorization is forbidden in D15 Wave 2 planning.",
      "block",
    ));
  }
  if (bundle.communicationContract.capabilities.allowsNetwork !== false) {
    diagnostics.push(errorDiagnostic(
      "forbidden_live_communication",
      "bundle.communicationContract.capabilities",
      "Live provider communication is forbidden in D15 Wave 2 planning.",
      "block",
    ));
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

export function serializeSocialProviderIntegrationPlanningBundle(
  bundle: SocialProviderIntegrationPlanningBundle,
): string {
  return JSON.stringify(toStableValue(bundle));
}

export function hydrateSocialProviderIntegrationPlanningBundle(
  serialized: string,
): Readonly<{ ok: true; value: SocialProviderIntegrationPlanningBundle }> | Readonly<{
  ok: false;
  diagnostics: readonly SocialProviderIntegrationPlanningDiagnostic[];
}> {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const validation = validateSocialProviderIntegrationPlanningBundle(parsed);
    if (!validation.valid || !isRecord(parsed)) {
      return { ok: false, diagnostics: validation.diagnostics };
    }
    return { ok: true, value: deepFreeze(parsed as SocialProviderIntegrationPlanningBundle) };
  } catch {
    return {
      ok: false,
      diagnostics: [
        errorDiagnostic(
          "serialization_invalid",
          "serialized",
          "Provider integration planning bundle serialization must be valid JSON.",
          "error",
        ),
      ],
    };
  }
}

function validateIntents(
  intents: unknown,
  path: string,
  diagnostics: SocialProviderIntegrationPlanningDiagnostic[],
): void {
  if (!Array.isArray(intents)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", path, "Integration intents must be an array.", "error"));
    return;
  }
  intents.forEach((intent, index) => {
    const intentPath = `${path}.${index}`;
    if (!isRecord(intent)) {
      diagnostics.push(errorDiagnostic("serialization_invalid", intentPath, "Integration intent must be an object.", "error"));
      return;
    }
    if (!hasText(intent.intentId)) {
      diagnostics.push(errorDiagnostic("intent_id_required", `${intentPath}.intentId`, "Integration intent id is required.", "error"));
    }
    if (!isSocialProviderIntegrationIntentKind(intent.kind)) {
      diagnostics.push(errorDiagnostic("intent_kind_unknown", `${intentPath}.kind`, "Integration intent kind is not supported.", "error"));
    }
    if (!isSocialProviderIntegrationIntentStatus(intent.status)) {
      diagnostics.push(errorDiagnostic("intent_status_unknown", `${intentPath}.status`, "Integration intent status is not supported.", "error"));
    }
  });
}

function validateConnectionContract(
  contract: unknown,
  path: string,
  diagnostics: SocialProviderIntegrationPlanningDiagnostic[],
): void {
  if (!isRecord(contract)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", path, "Connection contract must be an object.", "error"));
    return;
  }
  const capabilities = contract.capabilities;
  if (!isRecord(capabilities)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", `${path}.capabilities`, "Connection capabilities must be an object.", "error"));
    return;
  }
  if (!isSocialProviderConnectionState(capabilities.connectionState)) {
    diagnostics.push(errorDiagnostic("connection_state_unknown", `${path}.capabilities.connectionState`, "Connection state is not supported.", "error"));
  }
  if (capabilities.allowsLiveConnection !== false) {
    diagnostics.push(errorDiagnostic("forbidden_live_connection", `${path}.capabilities.allowsLiveConnection`, "Live connection must remain forbidden.", "block"));
  }
}

function validateCapabilityContract(
  contract: unknown,
  path: string,
  diagnostics: SocialProviderIntegrationPlanningDiagnostic[],
): void {
  if (!isRecord(contract) || !Array.isArray(contract.entries)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", path, "Capability contract must be an object with entries.", "error"));
    return;
  }
  contract.entries.forEach((entry, index) => {
    const entryPath = `${path}.entries.${index}`;
    if (!isRecord(entry)) {
      diagnostics.push(errorDiagnostic("serialization_invalid", entryPath, "Capability entry must be an object.", "error"));
      return;
    }
    if (!isSocialProviderIntegrationCapability(entry.capability)) {
      diagnostics.push(errorDiagnostic("capability_unknown", `${entryPath}.capability`, "Capability is not supported.", "error"));
    }
    if (!isSocialProviderCapabilityStatus(entry.status)) {
      diagnostics.push(errorDiagnostic("capability_status_unknown", `${entryPath}.status`, "Capability status is not supported.", "error"));
    }
  });
}

function validateAuthorizationContract(
  contract: unknown,
  path: string,
  diagnostics: SocialProviderIntegrationPlanningDiagnostic[],
): void {
  if (!isRecord(contract)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", path, "Authorization contract must be an object.", "error"));
    return;
  }
  const capabilities = contract.capabilities;
  if (!isRecord(capabilities)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", `${path}.capabilities`, "Authorization capabilities must be an object.", "error"));
    return;
  }
  if (!isSocialProviderAuthorizationMode(capabilities.authorizationMode)) {
    diagnostics.push(errorDiagnostic("authorization_mode_unknown", `${path}.capabilities.authorizationMode`, "Authorization mode is not supported.", "error"));
  }
  if (capabilities.allowsLiveAuthorization !== false) {
    diagnostics.push(errorDiagnostic("forbidden_live_authorization", `${path}.capabilities.allowsLiveAuthorization`, "Live authorization must remain forbidden.", "block"));
  }
}

function validateCommunicationContract(
  contract: unknown,
  path: string,
  diagnostics: SocialProviderIntegrationPlanningDiagnostic[],
): void {
  if (!isRecord(contract)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", path, "Communication contract must be an object.", "error"));
    return;
  }
  const capabilities = contract.capabilities;
  if (!isRecord(capabilities)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", `${path}.capabilities`, "Communication capabilities must be an object.", "error"));
    return;
  }
  if (!isSocialProviderCommunicationMode(capabilities.communicationMode)) {
    diagnostics.push(errorDiagnostic("communication_mode_unknown", `${path}.capabilities.communicationMode`, "Communication mode is not supported.", "error"));
  }
  if (capabilities.allowsNetwork !== false) {
    diagnostics.push(errorDiagnostic("forbidden_network_flag", `${path}.capabilities.allowsNetwork`, "Network usage must remain forbidden.", "block"));
  }
}

function validateSafety(
  safety: unknown,
  path: string,
  diagnostics: SocialProviderIntegrationPlanningDiagnostic[],
): void {
  if (!isRecord(safety)) {
    diagnostics.push(errorDiagnostic("safety_requirements_invalid", path, "Safety requirements must be an object.", "error"));
    return;
  }
  if (safety.grantsExecutionPermission !== false || safety.usesNoNetwork !== true) {
    diagnostics.push(errorDiagnostic("safety_requirements_invalid", path, "Safety requirements invariants failed.", "block"));
  }
}

function invalidResult(
  diagnostics: SocialProviderIntegrationPlanningDiagnostic[],
  diagnostic: SocialProviderIntegrationPlanningDiagnostic,
): SocialProviderIntegrationPlanningValidationResult {
  diagnostics.push(diagnostic);
  return {
    valid: false,
    diagnostics,
  };
}

function errorDiagnostic(
  code: SocialProviderIntegrationPlanningErrorCode,
  path: string,
  message: string,
  severity: "block" | "error" | "warning",
): SocialProviderIntegrationPlanningDiagnostic {
  return { code, path, message, severity };
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
