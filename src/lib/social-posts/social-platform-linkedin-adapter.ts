export const SOCIAL_PLATFORM_LINKEDIN_ADAPTER_VERSION = "d11-m11-v1" as const;

export const SOCIAL_PLATFORM_LINKEDIN_ADAPTER_PLATFORMS = [
  "linkedin",
] as const;

export const SOCIAL_PLATFORM_LINKEDIN_ADAPTER_CHANNEL_TYPES = [
  "linkedin_company_page",
] as const;

export const SOCIAL_PLATFORM_LINKEDIN_ADAPTER_POST_KINDS = [
  "feed_post",
  "article_post",
] as const;

export const SOCIAL_PLATFORM_LINKEDIN_ADAPTER_MEDIA_KINDS = [
  "image_ref",
  "video_ref",
  "carousel_ref",
] as const;

export const SOCIAL_PLATFORM_LINKEDIN_ADAPTER_CAPABILITY_FLAGS = [
  "feed_post_supported",
  "article_post_supported",
  "image_media_supported",
  "video_media_supported",
  "carousel_media_supported",
  "dry_run_supported",
  "execution_blocked",
  "oauth_blocked",
  "credentials_blocked",
  "network_blocked",
  "sdk_blocked",
  "external_api_blocked",
] as const;

export const SOCIAL_PLATFORM_LINKEDIN_ADAPTER_ERROR_CODES = [
  "adapter_id_required",
  "channel_id_required",
  "channel_platform_unknown",
  "channel_type_unknown",
  "channel_platform_mismatch",
  "channel_identity_invalid",
  "request_id_required",
  "post_kind_unknown",
  "media_kind_unknown",
  "media_ref_id_required",
  "media_ref_required",
  "storage_reference_required",
  "storage_reference_forbidden_url",
  "caption_invalid",
  "timestamp_invalid",
  "capabilities_invalid",
  "safety_requirements_invalid",
  "contract_invariant_failed",
  "secret_forbidden",
  "credential_forbidden",
  "oauth_forbidden",
  "external_api_forbidden",
  "sdk_forbidden",
  "network_forbidden",
  "serialization_invalid",
  "unsupported_channel",
  "unsupported_post_kind",
  "unsupported_media_kind",
] as const;

export type SocialPlatformLinkedinAdapterPlatform =
  (typeof SOCIAL_PLATFORM_LINKEDIN_ADAPTER_PLATFORMS)[number];

export type SocialPlatformLinkedinAdapterChannelType =
  (typeof SOCIAL_PLATFORM_LINKEDIN_ADAPTER_CHANNEL_TYPES)[number];

export type SocialPlatformLinkedinAdapterPostKind =
  (typeof SOCIAL_PLATFORM_LINKEDIN_ADAPTER_POST_KINDS)[number];

export type SocialPlatformLinkedinAdapterMediaKind =
  (typeof SOCIAL_PLATFORM_LINKEDIN_ADAPTER_MEDIA_KINDS)[number];

export type SocialPlatformLinkedinAdapterCapabilityFlag =
  (typeof SOCIAL_PLATFORM_LINKEDIN_ADAPTER_CAPABILITY_FLAGS)[number];

export type SocialPlatformLinkedinAdapterErrorCode =
  (typeof SOCIAL_PLATFORM_LINKEDIN_ADAPTER_ERROR_CODES)[number];

export type SocialPlatformLinkedinAdapterDiagnostic = Readonly<{
  code: SocialPlatformLinkedinAdapterErrorCode;
  path: string;
  message: string;
  severity: "block" | "error" | "warning";
}>;

export type SocialPlatformLinkedinAdapterValidationResult = Readonly<{
  valid: boolean;
  diagnostics: readonly SocialPlatformLinkedinAdapterDiagnostic[];
}>;

export type SocialPlatformLinkedinAdapterChannelIdentity = Readonly<{
  channelId: string;
  platform: SocialPlatformLinkedinAdapterPlatform;
  channelType: SocialPlatformLinkedinAdapterChannelType;
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

export type SocialPlatformLinkedinAdapterMediaRef = Readonly<{
  mediaRefId: string;
  kind: SocialPlatformLinkedinAdapterMediaKind;
  storageReference: string;
  displayHint: string | null;
  referencesOnly: true;
  containsCredentials: false;
  containsNetworkUrl: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformLinkedinAdapterPostRequest = Readonly<{
  requestId: string;
  adapterId: string;
  channel: SocialPlatformLinkedinAdapterChannelIdentity;
  postKind: SocialPlatformLinkedinAdapterPostKind;
  captionText: string | null;
  mediaRefs: readonly SocialPlatformLinkedinAdapterMediaRef[];
  scheduledAt: string | null;
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

export type SocialPlatformLinkedinAdapterCapabilities = Readonly<{
  supportedPlatforms: readonly SocialPlatformLinkedinAdapterPlatform[];
  supportedChannelTypes: readonly SocialPlatformLinkedinAdapterChannelType[];
  supportedPostKinds: readonly SocialPlatformLinkedinAdapterPostKind[];
  supportedMediaKinds: readonly SocialPlatformLinkedinAdapterMediaKind[];
  capabilityFlags: readonly SocialPlatformLinkedinAdapterCapabilityFlag[];
  supportsDryRun: boolean;
  supportsFeedPost: boolean;
  supportsStoryPost: boolean;
  supportsImageMedia: boolean;
  supportsVideoMedia: boolean;
  supportsCarouselMedia: boolean;
  allowsNetwork: false;
  allowsOAuth: false;
  allowsCredentials: false;
  allowsExternalApiCall: false;
  allowsSdkUsage: false;
  executesNothing: true;
  publishesNothing: true;
  grantsExecutionPermission: false;
}>;

export type SocialPlatformLinkedinAdapterSafetyRequirements = Readonly<{
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

export type SocialPlatformLinkedinAdapterIdentity = Readonly<{
  adapterId: string;
  adapterVersion: typeof SOCIAL_PLATFORM_LINKEDIN_ADAPTER_VERSION;
  displayName: string;
  provider: "linkedin";
  contractOnly: true;
  implementsNothing: true;
  containsCredentials: false;
  containsOAuthFlow: false;
  containsNetworkClient: false;
  containsLinkedInApiClient: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformLinkedinAdapterContract = Readonly<{
  identity: SocialPlatformLinkedinAdapterIdentity;
  capabilities: SocialPlatformLinkedinAdapterCapabilities;
  safety: SocialPlatformLinkedinAdapterSafetyRequirements;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

const PLATFORM_SET = new Set<string>(SOCIAL_PLATFORM_LINKEDIN_ADAPTER_PLATFORMS);
const CHANNEL_TYPE_SET = new Set<string>(SOCIAL_PLATFORM_LINKEDIN_ADAPTER_CHANNEL_TYPES);
const POST_KIND_SET = new Set<string>(SOCIAL_PLATFORM_LINKEDIN_ADAPTER_POST_KINDS);
const MEDIA_KIND_SET = new Set<string>(SOCIAL_PLATFORM_LINKEDIN_ADAPTER_MEDIA_KINDS);

const CHANNEL_TYPE_PLATFORM: Readonly<
  Record<SocialPlatformLinkedinAdapterChannelType, SocialPlatformLinkedinAdapterPlatform>
> = {
  linkedin_company_page: "linkedin",
};

const SHARED_SAFETY: SocialPlatformLinkedinAdapterSafetyRequirements = {
  contractOnly: true,
  modelAuthorityOnly: true,
  referencesOnly: true,
  callsNoExternalApis: true,
  usesNoSdks: true,
  usesNoNetwork: true,
  usesNoOAuth: true,
  usesNoCredentials: true,
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

const LINKEDIN_CAPABILITY_FLAGS: readonly SocialPlatformLinkedinAdapterCapabilityFlag[] = [
  "feed_post_supported",
  "article_post_supported",
  "image_media_supported",
  "video_media_supported",
  "carousel_media_supported",
  "dry_run_supported",
  "execution_blocked",
  "oauth_blocked",
  "credentials_blocked",
  "network_blocked",
  "sdk_blocked",
  "external_api_blocked",
];

function createLinkedinAdapterContract(): SocialPlatformLinkedinAdapterContract {
  const channelType: SocialPlatformLinkedinAdapterChannelType = "linkedin_company_page";

  return deepFreeze({
    identity: {
      adapterId: "linkedin-platform-adapter-linkedin-contract",
      adapterVersion: SOCIAL_PLATFORM_LINKEDIN_ADAPTER_VERSION,
      displayName: "LinkedIn platform adapter contract",
      provider: "linkedin",
      contractOnly: true,
      implementsNothing: true,
      containsCredentials: false,
      containsOAuthFlow: false,
      containsNetworkClient: false,
      containsLinkedInApiClient: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    capabilities: {
      supportedPlatforms: ["linkedin"],
      supportedChannelTypes: [channelType],
      supportedPostKinds: ["feed_post", "article_post"],
      supportedMediaKinds: ["image_ref", "video_ref", "carousel_ref"],
      capabilityFlags: LINKEDIN_CAPABILITY_FLAGS,
      supportsDryRun: true,
      supportsFeedPost: true,
      supportsStoryPost: false,
      supportsImageMedia: true,
      supportsVideoMedia: true,
      supportsCarouselMedia: true,
      allowsNetwork: false,
      allowsOAuth: false,
      allowsCredentials: false,
      allowsExternalApiCall: false,
      allowsSdkUsage: false,
      executesNothing: true,
      publishesNothing: true,
      grantsExecutionPermission: false,
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

export const SOCIAL_PLATFORM_LINKEDIN_ADAPTER_CONTRACTS = Object.freeze([
  createLinkedinAdapterContract(),
]);

export function isSocialPlatformLinkedinAdapterPlatform(
  value: unknown,
): value is SocialPlatformLinkedinAdapterPlatform {
  return typeof value === "string" && PLATFORM_SET.has(value);
}

export function isSocialPlatformLinkedinAdapterChannelType(
  value: unknown,
): value is SocialPlatformLinkedinAdapterChannelType {
  return typeof value === "string" && CHANNEL_TYPE_SET.has(value);
}

export function isSocialPlatformLinkedinAdapterPostKind(
  value: unknown,
): value is SocialPlatformLinkedinAdapterPostKind {
  return typeof value === "string" && POST_KIND_SET.has(value);
}

export function isSocialPlatformLinkedinAdapterMediaKind(
  value: unknown,
): value is SocialPlatformLinkedinAdapterMediaKind {
  return typeof value === "string" && MEDIA_KIND_SET.has(value);
}

export function createSocialPlatformLinkedinAdapterContract(): SocialPlatformLinkedinAdapterContract {
  const contract = SOCIAL_PLATFORM_LINKEDIN_ADAPTER_CONTRACTS[0];
  if (!contract) {
    throw new Error("LinkedIn adapter contract is unavailable.");
  }
  return contract;
}

export function linkedinAdapterSupportsPlatform(
  contract: SocialPlatformLinkedinAdapterContract,
  platform: SocialPlatformLinkedinAdapterPlatform,
): boolean {
  return contract.capabilities.supportedPlatforms.includes(platform);
}

export function linkedinAdapterSupportsChannelType(
  contract: SocialPlatformLinkedinAdapterContract,
  channelType: SocialPlatformLinkedinAdapterChannelType,
): boolean {
  return contract.capabilities.supportedChannelTypes.includes(channelType);
}

export function linkedinAdapterSupportsPostKind(
  contract: SocialPlatformLinkedinAdapterContract,
  postKind: SocialPlatformLinkedinAdapterPostKind,
): boolean {
  return contract.capabilities.supportedPostKinds.includes(postKind);
}

export function linkedinAdapterSupportsMediaKind(
  contract: SocialPlatformLinkedinAdapterContract,
  mediaKind: SocialPlatformLinkedinAdapterMediaKind,
): boolean {
  return contract.capabilities.supportedMediaKinds.includes(mediaKind);
}

export function validateSocialPlatformLinkedinAdapterContract(
  contract: unknown,
): SocialPlatformLinkedinAdapterValidationResult {
  const diagnostics: SocialPlatformLinkedinAdapterDiagnostic[] = [];
  if (!isRecord(contract)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", "contract", "LinkedIn adapter contract must be an object."),
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
      "LinkedIn adapter contract must not grant execution permission.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialPlatformLinkedinAdapterChannelIdentity(
  channel: unknown,
  path = "channel",
): SocialPlatformLinkedinAdapterValidationResult {
  const diagnostics: SocialPlatformLinkedinAdapterDiagnostic[] = [];
  if (!isRecord(channel)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("channel_identity_invalid", path, "LinkedIn adapter channel identity must be an object."),
      ],
    };
  }

  requireText(channel.channelId, `${path}.channelId`, "channel_id_required", diagnostics);
  requireText(
    channel.publicationTargetId,
    `${path}.publicationTargetId`,
    "channel_id_required",
    diagnostics,
  );
  if (!isSocialPlatformLinkedinAdapterPlatform(channel.platform)) {
    diagnostics.push(errorDiagnostic(
      "channel_platform_unknown",
      `${path}.platform`,
      "LinkedIn adapter channel platform is not supported.",
    ));
  }
  if (!isSocialPlatformLinkedinAdapterChannelType(channel.channelType)) {
    diagnostics.push(errorDiagnostic(
      "channel_type_unknown",
      `${path}.channelType`,
      "LinkedIn adapter channel type is not supported.",
    ));
  } else if (
    isSocialPlatformLinkedinAdapterPlatform(channel.platform) &&
    CHANNEL_TYPE_PLATFORM[channel.channelType] !== channel.platform
  ) {
    diagnostics.push(errorDiagnostic(
      "channel_platform_mismatch",
      path,
      "LinkedIn adapter channel type must match platform.",
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
      "LinkedIn adapter channel identity must remain reference-only.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialPlatformLinkedinAdapterMediaRef(
  mediaRef: unknown,
  path: string,
): SocialPlatformLinkedinAdapterValidationResult {
  const diagnostics: SocialPlatformLinkedinAdapterDiagnostic[] = [];
  if (!isRecord(mediaRef)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", path, "LinkedIn adapter media ref must be an object."),
      ],
    };
  }

  requireText(mediaRef.mediaRefId, `${path}.mediaRefId`, "media_ref_id_required", diagnostics);
  if (!isSocialPlatformLinkedinAdapterMediaKind(mediaRef.kind)) {
    diagnostics.push(errorDiagnostic(
      "media_kind_unknown",
      `${path}.kind`,
      "LinkedIn adapter media kind is not supported.",
    ));
  }
  requireText(
    mediaRef.storageReference,
    `${path}.storageReference`,
    "storage_reference_required",
    diagnostics,
  );
  if (
    hasText(mediaRef.storageReference) &&
    looksLikeNetworkUrl(mediaRef.storageReference)
  ) {
    diagnostics.push(errorDiagnostic(
      "storage_reference_forbidden_url",
      `${path}.storageReference`,
      "LinkedIn adapter media refs must use internal storage references, not network URLs.",
    ));
  }
  if (
    mediaRef.referencesOnly !== true ||
    mediaRef.containsCredentials !== false ||
    mediaRef.containsNetworkUrl !== false ||
    mediaRef.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "LinkedIn adapter media ref must remain reference-only.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialPlatformLinkedinAdapterPostRequest(
  request: unknown,
): SocialPlatformLinkedinAdapterValidationResult {
  const diagnostics: SocialPlatformLinkedinAdapterDiagnostic[] = [];
  if (!isRecord(request)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", "request", "LinkedIn adapter post request must be an object."),
      ],
    };
  }

  requireText(request.requestId, "request.requestId", "request_id_required", diagnostics);
  requireText(request.adapterId, "request.adapterId", "adapter_id_required", diagnostics);
  if (!isSocialPlatformLinkedinAdapterPostKind(request.postKind)) {
    diagnostics.push(errorDiagnostic(
      "post_kind_unknown",
      "request.postKind",
      "LinkedIn adapter post kind is not supported.",
    ));
  }
  if (request.scheduledAt !== null && !isValidTimestamp(request.scheduledAt)) {
    diagnostics.push(errorDiagnostic(
      "timestamp_invalid",
      "request.scheduledAt",
      "LinkedIn adapter scheduledAt must be null or a valid timestamp.",
    ));
  }
  if (request.captionText !== null && typeof request.captionText !== "string") {
    diagnostics.push(errorDiagnostic(
      "caption_invalid",
      "request.captionText",
      "LinkedIn adapter caption must be null or a string.",
    ));
  }

  const channelValidation = validateSocialPlatformLinkedinAdapterChannelIdentity(request.channel, "request.channel");
  diagnostics.push(...channelValidation.diagnostics);

  if (!Array.isArray(request.mediaRefs)) {
    diagnostics.push(errorDiagnostic(
      "media_ref_required",
      "request.mediaRefs",
      "LinkedIn adapter post request requires a mediaRefs array.",
    ));
  } else {
    request.mediaRefs.forEach((mediaRef, index) => {
      const mediaValidation = validateSocialPlatformLinkedinAdapterMediaRef(
        mediaRef,
        `request.mediaRefs.${index}`,
      );
      diagnostics.push(...mediaValidation.diagnostics);
    });
  }

  assertForbiddenFlags(request, "request", diagnostics);

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function detectSocialPlatformLinkedinAdapterForbiddenStates(
  contract: SocialPlatformLinkedinAdapterContract,
  request: SocialPlatformLinkedinAdapterPostRequest,
): SocialPlatformLinkedinAdapterValidationResult {
  const diagnostics: SocialPlatformLinkedinAdapterDiagnostic[] = [];

  if (request.adapterId !== contract.identity.adapterId) {
    diagnostics.push(blockDiagnostic(
      "contract_invariant_failed",
      "request.adapterId",
      "LinkedIn adapter post request adapter id does not match contract.",
    ));
  }

  if (!linkedinAdapterSupportsPlatform(contract, request.channel.platform)) {
    diagnostics.push(blockDiagnostic(
      "unsupported_channel",
      "request.channel.platform",
      "LinkedIn adapter contract does not support this platform.",
    ));
  }

  if (!linkedinAdapterSupportsChannelType(contract, request.channel.channelType)) {
    diagnostics.push(blockDiagnostic(
      "unsupported_channel",
      "request.channel.channelType",
      "LinkedIn adapter contract does not support this channel type.",
    ));
  }

  if (!linkedinAdapterSupportsPostKind(contract, request.postKind)) {
    diagnostics.push(blockDiagnostic(
      "unsupported_post_kind",
      "request.postKind",
      "LinkedIn adapter contract does not support this post kind.",
    ));
  }

  for (const [index, mediaRef] of request.mediaRefs.entries()) {
    if (!linkedinAdapterSupportsMediaKind(contract, mediaRef.kind)) {
      diagnostics.push(blockDiagnostic(
        "unsupported_media_kind",
        `request.mediaRefs.${index}.kind`,
        "LinkedIn adapter contract does not support this media kind.",
      ));
    }
  }

  if (request.mediaRefs.length === 0) {
    diagnostics.push(blockDiagnostic(
      "media_ref_required",
      "request.mediaRefs",
      "LinkedIn adapter post request requires at least one media reference.",
    ));
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

export function serializeSocialPlatformLinkedinAdapterContract(
  contract: SocialPlatformLinkedinAdapterContract,
): string {
  return JSON.stringify(toStableValue(contract));
}

export function hydrateSocialPlatformLinkedinAdapterContract(
  serialized: string,
): Readonly<{
  ok: true;
  value: SocialPlatformLinkedinAdapterContract;
}> | Readonly<{
  ok: false;
  diagnostics: readonly SocialPlatformLinkedinAdapterDiagnostic[];
}> {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const validation = validateSocialPlatformLinkedinAdapterContract(parsed);
    if (!validation.valid || !isRecord(parsed)) {
      return { ok: false, diagnostics: validation.diagnostics };
    }
    return { ok: true, value: deepFreeze(parsed as SocialPlatformLinkedinAdapterContract) };
  } catch {
    return {
      ok: false,
      diagnostics: [
        errorDiagnostic(
          "serialization_invalid",
          "serialized",
          "LinkedIn adapter contract serialization must be valid JSON.",
        ),
      ],
    };
  }
}

function validateIdentity(
  identity: unknown,
  path: string,
  diagnostics: SocialPlatformLinkedinAdapterDiagnostic[],
): void {
  if (!isRecord(identity)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", path, "LinkedIn adapter identity must be an object."));
    return;
  }
  requireText(identity.adapterId, `${path}.adapterId`, "adapter_id_required", diagnostics);
  if (identity.adapterVersion !== SOCIAL_PLATFORM_LINKEDIN_ADAPTER_VERSION) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.adapterVersion`,
      "LinkedIn adapter version must match the current contract version.",
    ));
  }
  if (identity.provider !== "linkedin") {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.provider`,
      "LinkedIn adapter provider must be linkedin.",
    ));
  }
  if (
    identity.contractOnly !== true ||
    identity.implementsNothing !== true ||
    identity.containsCredentials !== false ||
    identity.containsOAuthFlow !== false ||
    identity.containsNetworkClient !== false ||
    identity.containsLinkedInApiClient !== false ||
    identity.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "LinkedIn adapter identity must remain contract-only and non-executing.",
    ));
  }
}

function validateCapabilities(
  capabilities: unknown,
  path: string,
  diagnostics: SocialPlatformLinkedinAdapterDiagnostic[],
): void {
  if (!isRecord(capabilities)) {
    diagnostics.push(errorDiagnostic("capabilities_invalid", path, "LinkedIn adapter capabilities must be an object."));
    return;
  }
  if (!Array.isArray(capabilities.supportedPlatforms)) {
    diagnostics.push(errorDiagnostic(
      "capabilities_invalid",
      `${path}.supportedPlatforms`,
      "Supported platforms must be an array.",
    ));
  } else {
    capabilities.supportedPlatforms.forEach((platform, index) => {
      if (!isSocialPlatformLinkedinAdapterPlatform(platform)) {
        diagnostics.push(errorDiagnostic(
          "channel_platform_unknown",
          `${path}.supportedPlatforms.${index}`,
          "Supported platform is not recognized.",
        ));
      }
    });
  }
  if (
    capabilities.allowsNetwork !== false ||
    capabilities.allowsOAuth !== false ||
    capabilities.allowsCredentials !== false ||
    capabilities.allowsExternalApiCall !== false ||
    capabilities.allowsSdkUsage !== false ||
    capabilities.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "capabilities_invalid",
      path,
      "LinkedIn adapter capabilities must forbid network, OAuth, credentials, and execution permission.",
    ));
  }
}

function validateSafety(
  safety: unknown,
  path: string,
  diagnostics: SocialPlatformLinkedinAdapterDiagnostic[],
): void {
  if (!isRecord(safety)) {
    diagnostics.push(errorDiagnostic(
      "safety_requirements_invalid",
      path,
      "LinkedIn adapter safety requirements must be an object.",
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
        "LinkedIn adapter safety requirement invariant failed.",
      ));
    }
  }
}

function assertForbiddenFlags(
  value: Record<string, unknown>,
  path: string,
  diagnostics: SocialPlatformLinkedinAdapterDiagnostic[],
): void {
  if (value.usesNoCredentials === false) {
    diagnostics.push(errorDiagnostic("credential_forbidden", path, "LinkedIn adapter request must not use credentials."));
  }
  if (value.usesNoOAuth === false) {
    diagnostics.push(errorDiagnostic("oauth_forbidden", path, "LinkedIn adapter request must not use OAuth."));
  }
  if (value.callsNoExternalApis === false) {
    diagnostics.push(errorDiagnostic("external_api_forbidden", path, "LinkedIn adapter request must not call external APIs."));
  }
  if (value.usesNoNetwork === false) {
    diagnostics.push(errorDiagnostic("network_forbidden", path, "LinkedIn adapter request must not use network."));
  }
  if (value.grantsExecutionPermission !== false) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "LinkedIn adapter request must not grant execution permission.",
    ));
  }
}

function requireText(
  value: unknown,
  path: string,
  code: SocialPlatformLinkedinAdapterErrorCode,
  diagnostics: SocialPlatformLinkedinAdapterDiagnostic[],
): void {
  if (hasText(value)) return;
  diagnostics.push(errorDiagnostic(code, path, "Required LinkedIn adapter text field is missing."));
}

function errorDiagnostic(
  code: SocialPlatformLinkedinAdapterErrorCode,
  path: string,
  message: string,
): SocialPlatformLinkedinAdapterDiagnostic {
  return { code, path, message, severity: "error" };
}

function blockDiagnostic(
  code: SocialPlatformLinkedinAdapterErrorCode,
  path: string,
  message: string,
): SocialPlatformLinkedinAdapterDiagnostic {
  return { code, path, message, severity: "block" };
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidTimestamp(value: unknown): value is string {
  return hasText(value) && Number.isFinite(Date.parse(value));
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
