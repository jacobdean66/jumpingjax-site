export const SOCIAL_PLATFORM_TIKTOK_ADAPTER_VERSION = "d11-m10-v1" as const;

export const SOCIAL_PLATFORM_TIKTOK_ADAPTER_PLATFORMS = [
  "tiktok",
] as const;

export const SOCIAL_PLATFORM_TIKTOK_ADAPTER_CHANNEL_TYPES = [
  "tiktok_business_account",
] as const;

export const SOCIAL_PLATFORM_TIKTOK_ADAPTER_POST_KINDS = [
  "feed_post",
  "video_post",
] as const;

export const SOCIAL_PLATFORM_TIKTOK_ADAPTER_MEDIA_KINDS = [
  "image_ref",
  "video_ref",
  "carousel_ref",
] as const;

export const SOCIAL_PLATFORM_TIKTOK_ADAPTER_CAPABILITY_FLAGS = [
  "feed_post_supported",
  "video_post_supported",
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

export const SOCIAL_PLATFORM_TIKTOK_ADAPTER_ERROR_CODES = [
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

export type SocialPlatformTiktokAdapterPlatform =
  (typeof SOCIAL_PLATFORM_TIKTOK_ADAPTER_PLATFORMS)[number];

export type SocialPlatformTiktokAdapterChannelType =
  (typeof SOCIAL_PLATFORM_TIKTOK_ADAPTER_CHANNEL_TYPES)[number];

export type SocialPlatformTiktokAdapterPostKind =
  (typeof SOCIAL_PLATFORM_TIKTOK_ADAPTER_POST_KINDS)[number];

export type SocialPlatformTiktokAdapterMediaKind =
  (typeof SOCIAL_PLATFORM_TIKTOK_ADAPTER_MEDIA_KINDS)[number];

export type SocialPlatformTiktokAdapterCapabilityFlag =
  (typeof SOCIAL_PLATFORM_TIKTOK_ADAPTER_CAPABILITY_FLAGS)[number];

export type SocialPlatformTiktokAdapterErrorCode =
  (typeof SOCIAL_PLATFORM_TIKTOK_ADAPTER_ERROR_CODES)[number];

export type SocialPlatformTiktokAdapterDiagnostic = Readonly<{
  code: SocialPlatformTiktokAdapterErrorCode;
  path: string;
  message: string;
  severity: "block" | "error" | "warning";
}>;

export type SocialPlatformTiktokAdapterValidationResult = Readonly<{
  valid: boolean;
  diagnostics: readonly SocialPlatformTiktokAdapterDiagnostic[];
}>;

export type SocialPlatformTiktokAdapterChannelIdentity = Readonly<{
  channelId: string;
  platform: SocialPlatformTiktokAdapterPlatform;
  channelType: SocialPlatformTiktokAdapterChannelType;
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

export type SocialPlatformTiktokAdapterMediaRef = Readonly<{
  mediaRefId: string;
  kind: SocialPlatformTiktokAdapterMediaKind;
  storageReference: string;
  displayHint: string | null;
  referencesOnly: true;
  containsCredentials: false;
  containsNetworkUrl: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformTiktokAdapterPostRequest = Readonly<{
  requestId: string;
  adapterId: string;
  channel: SocialPlatformTiktokAdapterChannelIdentity;
  postKind: SocialPlatformTiktokAdapterPostKind;
  captionText: string | null;
  mediaRefs: readonly SocialPlatformTiktokAdapterMediaRef[];
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

export type SocialPlatformTiktokAdapterCapabilities = Readonly<{
  supportedPlatforms: readonly SocialPlatformTiktokAdapterPlatform[];
  supportedChannelTypes: readonly SocialPlatformTiktokAdapterChannelType[];
  supportedPostKinds: readonly SocialPlatformTiktokAdapterPostKind[];
  supportedMediaKinds: readonly SocialPlatformTiktokAdapterMediaKind[];
  capabilityFlags: readonly SocialPlatformTiktokAdapterCapabilityFlag[];
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

export type SocialPlatformTiktokAdapterSafetyRequirements = Readonly<{
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

export type SocialPlatformTiktokAdapterIdentity = Readonly<{
  adapterId: string;
  adapterVersion: typeof SOCIAL_PLATFORM_TIKTOK_ADAPTER_VERSION;
  displayName: string;
  provider: "tiktok";
  contractOnly: true;
  implementsNothing: true;
  containsCredentials: false;
  containsOAuthFlow: false;
  containsNetworkClient: false;
  containsTikTokApiClient: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformTiktokAdapterContract = Readonly<{
  identity: SocialPlatformTiktokAdapterIdentity;
  capabilities: SocialPlatformTiktokAdapterCapabilities;
  safety: SocialPlatformTiktokAdapterSafetyRequirements;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

const PLATFORM_SET = new Set<string>(SOCIAL_PLATFORM_TIKTOK_ADAPTER_PLATFORMS);
const CHANNEL_TYPE_SET = new Set<string>(SOCIAL_PLATFORM_TIKTOK_ADAPTER_CHANNEL_TYPES);
const POST_KIND_SET = new Set<string>(SOCIAL_PLATFORM_TIKTOK_ADAPTER_POST_KINDS);
const MEDIA_KIND_SET = new Set<string>(SOCIAL_PLATFORM_TIKTOK_ADAPTER_MEDIA_KINDS);

const CHANNEL_TYPE_PLATFORM: Readonly<
  Record<SocialPlatformTiktokAdapterChannelType, SocialPlatformTiktokAdapterPlatform>
> = {
  tiktok_business_account: "tiktok",
};

const SHARED_SAFETY: SocialPlatformTiktokAdapterSafetyRequirements = {
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

const TIKTOK_CAPABILITY_FLAGS: readonly SocialPlatformTiktokAdapterCapabilityFlag[] = [
  "feed_post_supported",
  "video_post_supported",
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

function createTiktokAdapterContract(): SocialPlatformTiktokAdapterContract {
  const channelType: SocialPlatformTiktokAdapterChannelType = "tiktok_business_account";

  return deepFreeze({
    identity: {
      adapterId: "tiktok-platform-adapter-tiktok-contract",
      adapterVersion: SOCIAL_PLATFORM_TIKTOK_ADAPTER_VERSION,
      displayName: "TikTok platform adapter contract",
      provider: "tiktok",
      contractOnly: true,
      implementsNothing: true,
      containsCredentials: false,
      containsOAuthFlow: false,
      containsNetworkClient: false,
      containsTikTokApiClient: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    capabilities: {
      supportedPlatforms: ["tiktok"],
      supportedChannelTypes: [channelType],
      supportedPostKinds: ["feed_post", "video_post"],
      supportedMediaKinds: ["image_ref", "video_ref", "carousel_ref"],
      capabilityFlags: TIKTOK_CAPABILITY_FLAGS,
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

export const SOCIAL_PLATFORM_TIKTOK_ADAPTER_CONTRACTS = Object.freeze([
  createTiktokAdapterContract(),
]);

export function isSocialPlatformTiktokAdapterPlatform(
  value: unknown,
): value is SocialPlatformTiktokAdapterPlatform {
  return typeof value === "string" && PLATFORM_SET.has(value);
}

export function isSocialPlatformTiktokAdapterChannelType(
  value: unknown,
): value is SocialPlatformTiktokAdapterChannelType {
  return typeof value === "string" && CHANNEL_TYPE_SET.has(value);
}

export function isSocialPlatformTiktokAdapterPostKind(
  value: unknown,
): value is SocialPlatformTiktokAdapterPostKind {
  return typeof value === "string" && POST_KIND_SET.has(value);
}

export function isSocialPlatformTiktokAdapterMediaKind(
  value: unknown,
): value is SocialPlatformTiktokAdapterMediaKind {
  return typeof value === "string" && MEDIA_KIND_SET.has(value);
}

export function createSocialPlatformTiktokAdapterContract(): SocialPlatformTiktokAdapterContract {
  const contract = SOCIAL_PLATFORM_TIKTOK_ADAPTER_CONTRACTS[0];
  if (!contract) {
    throw new Error("TikTok adapter contract is unavailable.");
  }
  return contract;
}

export function tiktokAdapterSupportsPlatform(
  contract: SocialPlatformTiktokAdapterContract,
  platform: SocialPlatformTiktokAdapterPlatform,
): boolean {
  return contract.capabilities.supportedPlatforms.includes(platform);
}

export function tiktokAdapterSupportsChannelType(
  contract: SocialPlatformTiktokAdapterContract,
  channelType: SocialPlatformTiktokAdapterChannelType,
): boolean {
  return contract.capabilities.supportedChannelTypes.includes(channelType);
}

export function tiktokAdapterSupportsPostKind(
  contract: SocialPlatformTiktokAdapterContract,
  postKind: SocialPlatformTiktokAdapterPostKind,
): boolean {
  return contract.capabilities.supportedPostKinds.includes(postKind);
}

export function tiktokAdapterSupportsMediaKind(
  contract: SocialPlatformTiktokAdapterContract,
  mediaKind: SocialPlatformTiktokAdapterMediaKind,
): boolean {
  return contract.capabilities.supportedMediaKinds.includes(mediaKind);
}

export function validateSocialPlatformTiktokAdapterContract(
  contract: unknown,
): SocialPlatformTiktokAdapterValidationResult {
  const diagnostics: SocialPlatformTiktokAdapterDiagnostic[] = [];
  if (!isRecord(contract)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", "contract", "TikTok adapter contract must be an object."),
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
      "TikTok adapter contract must not grant execution permission.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialPlatformTiktokAdapterChannelIdentity(
  channel: unknown,
  path = "channel",
): SocialPlatformTiktokAdapterValidationResult {
  const diagnostics: SocialPlatformTiktokAdapterDiagnostic[] = [];
  if (!isRecord(channel)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("channel_identity_invalid", path, "TikTok adapter channel identity must be an object."),
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
  if (!isSocialPlatformTiktokAdapterPlatform(channel.platform)) {
    diagnostics.push(errorDiagnostic(
      "channel_platform_unknown",
      `${path}.platform`,
      "TikTok adapter channel platform is not supported.",
    ));
  }
  if (!isSocialPlatformTiktokAdapterChannelType(channel.channelType)) {
    diagnostics.push(errorDiagnostic(
      "channel_type_unknown",
      `${path}.channelType`,
      "TikTok adapter channel type is not supported.",
    ));
  } else if (
    isSocialPlatformTiktokAdapterPlatform(channel.platform) &&
    CHANNEL_TYPE_PLATFORM[channel.channelType] !== channel.platform
  ) {
    diagnostics.push(errorDiagnostic(
      "channel_platform_mismatch",
      path,
      "TikTok adapter channel type must match platform.",
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
      "TikTok adapter channel identity must remain reference-only.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialPlatformTiktokAdapterMediaRef(
  mediaRef: unknown,
  path: string,
): SocialPlatformTiktokAdapterValidationResult {
  const diagnostics: SocialPlatformTiktokAdapterDiagnostic[] = [];
  if (!isRecord(mediaRef)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", path, "TikTok adapter media ref must be an object."),
      ],
    };
  }

  requireText(mediaRef.mediaRefId, `${path}.mediaRefId`, "media_ref_id_required", diagnostics);
  if (!isSocialPlatformTiktokAdapterMediaKind(mediaRef.kind)) {
    diagnostics.push(errorDiagnostic(
      "media_kind_unknown",
      `${path}.kind`,
      "TikTok adapter media kind is not supported.",
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
      "TikTok adapter media refs must use internal storage references, not network URLs.",
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
      "TikTok adapter media ref must remain reference-only.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialPlatformTiktokAdapterPostRequest(
  request: unknown,
): SocialPlatformTiktokAdapterValidationResult {
  const diagnostics: SocialPlatformTiktokAdapterDiagnostic[] = [];
  if (!isRecord(request)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", "request", "TikTok adapter post request must be an object."),
      ],
    };
  }

  requireText(request.requestId, "request.requestId", "request_id_required", diagnostics);
  requireText(request.adapterId, "request.adapterId", "adapter_id_required", diagnostics);
  if (!isSocialPlatformTiktokAdapterPostKind(request.postKind)) {
    diagnostics.push(errorDiagnostic(
      "post_kind_unknown",
      "request.postKind",
      "TikTok adapter post kind is not supported.",
    ));
  }
  if (request.scheduledAt !== null && !isValidTimestamp(request.scheduledAt)) {
    diagnostics.push(errorDiagnostic(
      "timestamp_invalid",
      "request.scheduledAt",
      "TikTok adapter scheduledAt must be null or a valid timestamp.",
    ));
  }
  if (request.captionText !== null && typeof request.captionText !== "string") {
    diagnostics.push(errorDiagnostic(
      "caption_invalid",
      "request.captionText",
      "TikTok adapter caption must be null or a string.",
    ));
  }

  const channelValidation = validateSocialPlatformTiktokAdapterChannelIdentity(request.channel, "request.channel");
  diagnostics.push(...channelValidation.diagnostics);

  if (!Array.isArray(request.mediaRefs)) {
    diagnostics.push(errorDiagnostic(
      "media_ref_required",
      "request.mediaRefs",
      "TikTok adapter post request requires a mediaRefs array.",
    ));
  } else {
    request.mediaRefs.forEach((mediaRef, index) => {
      const mediaValidation = validateSocialPlatformTiktokAdapterMediaRef(
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

export function detectSocialPlatformTiktokAdapterForbiddenStates(
  contract: SocialPlatformTiktokAdapterContract,
  request: SocialPlatformTiktokAdapterPostRequest,
): SocialPlatformTiktokAdapterValidationResult {
  const diagnostics: SocialPlatformTiktokAdapterDiagnostic[] = [];

  if (request.adapterId !== contract.identity.adapterId) {
    diagnostics.push(blockDiagnostic(
      "contract_invariant_failed",
      "request.adapterId",
      "TikTok adapter post request adapter id does not match contract.",
    ));
  }

  if (!tiktokAdapterSupportsPlatform(contract, request.channel.platform)) {
    diagnostics.push(blockDiagnostic(
      "unsupported_channel",
      "request.channel.platform",
      "TikTok adapter contract does not support this platform.",
    ));
  }

  if (!tiktokAdapterSupportsChannelType(contract, request.channel.channelType)) {
    diagnostics.push(blockDiagnostic(
      "unsupported_channel",
      "request.channel.channelType",
      "TikTok adapter contract does not support this channel type.",
    ));
  }

  if (!tiktokAdapterSupportsPostKind(contract, request.postKind)) {
    diagnostics.push(blockDiagnostic(
      "unsupported_post_kind",
      "request.postKind",
      "TikTok adapter contract does not support this post kind.",
    ));
  }

  for (const [index, mediaRef] of request.mediaRefs.entries()) {
    if (!tiktokAdapterSupportsMediaKind(contract, mediaRef.kind)) {
      diagnostics.push(blockDiagnostic(
        "unsupported_media_kind",
        `request.mediaRefs.${index}.kind`,
        "TikTok adapter contract does not support this media kind.",
      ));
    }
  }

  if (request.mediaRefs.length === 0) {
    diagnostics.push(blockDiagnostic(
      "media_ref_required",
      "request.mediaRefs",
      "TikTok adapter post request requires at least one media reference.",
    ));
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

export function serializeSocialPlatformTiktokAdapterContract(
  contract: SocialPlatformTiktokAdapterContract,
): string {
  return JSON.stringify(toStableValue(contract));
}

export function hydrateSocialPlatformTiktokAdapterContract(
  serialized: string,
): Readonly<{
  ok: true;
  value: SocialPlatformTiktokAdapterContract;
}> | Readonly<{
  ok: false;
  diagnostics: readonly SocialPlatformTiktokAdapterDiagnostic[];
}> {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const validation = validateSocialPlatformTiktokAdapterContract(parsed);
    if (!validation.valid || !isRecord(parsed)) {
      return { ok: false, diagnostics: validation.diagnostics };
    }
    return { ok: true, value: deepFreeze(parsed as SocialPlatformTiktokAdapterContract) };
  } catch {
    return {
      ok: false,
      diagnostics: [
        errorDiagnostic(
          "serialization_invalid",
          "serialized",
          "TikTok adapter contract serialization must be valid JSON.",
        ),
      ],
    };
  }
}

function validateIdentity(
  identity: unknown,
  path: string,
  diagnostics: SocialPlatformTiktokAdapterDiagnostic[],
): void {
  if (!isRecord(identity)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", path, "TikTok adapter identity must be an object."));
    return;
  }
  requireText(identity.adapterId, `${path}.adapterId`, "adapter_id_required", diagnostics);
  if (identity.adapterVersion !== SOCIAL_PLATFORM_TIKTOK_ADAPTER_VERSION) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.adapterVersion`,
      "TikTok adapter version must match the current contract version.",
    ));
  }
  if (identity.provider !== "tiktok") {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.provider`,
      "TikTok adapter provider must be tiktok.",
    ));
  }
  if (
    identity.contractOnly !== true ||
    identity.implementsNothing !== true ||
    identity.containsCredentials !== false ||
    identity.containsOAuthFlow !== false ||
    identity.containsNetworkClient !== false ||
    identity.containsTikTokApiClient !== false ||
    identity.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "TikTok adapter identity must remain contract-only and non-executing.",
    ));
  }
}

function validateCapabilities(
  capabilities: unknown,
  path: string,
  diagnostics: SocialPlatformTiktokAdapterDiagnostic[],
): void {
  if (!isRecord(capabilities)) {
    diagnostics.push(errorDiagnostic("capabilities_invalid", path, "TikTok adapter capabilities must be an object."));
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
      if (!isSocialPlatformTiktokAdapterPlatform(platform)) {
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
      "TikTok adapter capabilities must forbid network, OAuth, credentials, and execution permission.",
    ));
  }
}

function validateSafety(
  safety: unknown,
  path: string,
  diagnostics: SocialPlatformTiktokAdapterDiagnostic[],
): void {
  if (!isRecord(safety)) {
    diagnostics.push(errorDiagnostic(
      "safety_requirements_invalid",
      path,
      "TikTok adapter safety requirements must be an object.",
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
        "TikTok adapter safety requirement invariant failed.",
      ));
    }
  }
}

function assertForbiddenFlags(
  value: Record<string, unknown>,
  path: string,
  diagnostics: SocialPlatformTiktokAdapterDiagnostic[],
): void {
  if (value.usesNoCredentials === false) {
    diagnostics.push(errorDiagnostic("credential_forbidden", path, "TikTok adapter request must not use credentials."));
  }
  if (value.usesNoOAuth === false) {
    diagnostics.push(errorDiagnostic("oauth_forbidden", path, "TikTok adapter request must not use OAuth."));
  }
  if (value.callsNoExternalApis === false) {
    diagnostics.push(errorDiagnostic("external_api_forbidden", path, "TikTok adapter request must not call external APIs."));
  }
  if (value.usesNoNetwork === false) {
    diagnostics.push(errorDiagnostic("network_forbidden", path, "TikTok adapter request must not use network."));
  }
  if (value.grantsExecutionPermission !== false) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "TikTok adapter request must not grant execution permission.",
    ));
  }
}

function requireText(
  value: unknown,
  path: string,
  code: SocialPlatformTiktokAdapterErrorCode,
  diagnostics: SocialPlatformTiktokAdapterDiagnostic[],
): void {
  if (hasText(value)) return;
  diagnostics.push(errorDiagnostic(code, path, "Required TikTok adapter text field is missing."));
}

function errorDiagnostic(
  code: SocialPlatformTiktokAdapterErrorCode,
  path: string,
  message: string,
): SocialPlatformTiktokAdapterDiagnostic {
  return { code, path, message, severity: "error" };
}

function blockDiagnostic(
  code: SocialPlatformTiktokAdapterErrorCode,
  path: string,
  message: string,
): SocialPlatformTiktokAdapterDiagnostic {
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
