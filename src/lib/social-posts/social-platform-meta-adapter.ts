import {
  SOCIAL_PUBLICATION_EXECUTION_ADAPTER_CHANNEL_TYPES,
  type SocialPublicationExecutionAdapterChannelType,
  type SocialPublicationExecutionAdapterPlatform,
} from "./social-publication-execution-adapter";

export const SOCIAL_PLATFORM_META_ADAPTER_VERSION = "d11-m4-v1" as const;

export const SOCIAL_PLATFORM_META_ADAPTER_PLATFORMS = [
  "facebook",
  "instagram",
] as const;

export const SOCIAL_PLATFORM_META_ADAPTER_CHANNEL_TYPES = [
  ...SOCIAL_PUBLICATION_EXECUTION_ADAPTER_CHANNEL_TYPES,
] as const;

export const SOCIAL_PLATFORM_META_ADAPTER_POST_KINDS = [
  "feed_post",
  "story_post",
] as const;

export const SOCIAL_PLATFORM_META_ADAPTER_MEDIA_KINDS = [
  "image_ref",
  "video_ref",
  "carousel_ref",
] as const;

export const SOCIAL_PLATFORM_META_ADAPTER_CAPABILITY_FLAGS = [
  "feed_post_supported",
  "story_post_supported",
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

export const SOCIAL_PLATFORM_META_ADAPTER_ERROR_CODES = [
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

export type SocialPlatformMetaAdapterPlatform =
  (typeof SOCIAL_PLATFORM_META_ADAPTER_PLATFORMS)[number];

export type SocialPlatformMetaAdapterChannelType =
  (typeof SOCIAL_PLATFORM_META_ADAPTER_CHANNEL_TYPES)[number];

export type SocialPlatformMetaAdapterPostKind =
  (typeof SOCIAL_PLATFORM_META_ADAPTER_POST_KINDS)[number];

export type SocialPlatformMetaAdapterMediaKind =
  (typeof SOCIAL_PLATFORM_META_ADAPTER_MEDIA_KINDS)[number];

export type SocialPlatformMetaAdapterCapabilityFlag =
  (typeof SOCIAL_PLATFORM_META_ADAPTER_CAPABILITY_FLAGS)[number];

export type SocialPlatformMetaAdapterErrorCode =
  (typeof SOCIAL_PLATFORM_META_ADAPTER_ERROR_CODES)[number];

export type SocialPlatformMetaAdapterDiagnostic = Readonly<{
  code: SocialPlatformMetaAdapterErrorCode;
  path: string;
  message: string;
  severity: "block" | "error" | "warning";
}>;

export type SocialPlatformMetaAdapterValidationResult = Readonly<{
  valid: boolean;
  diagnostics: readonly SocialPlatformMetaAdapterDiagnostic[];
}>;

export type SocialPlatformMetaAdapterChannelIdentity = Readonly<{
  channelId: string;
  platform: SocialPlatformMetaAdapterPlatform;
  channelType: SocialPlatformMetaAdapterChannelType;
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

export type SocialPlatformMetaAdapterMediaRef = Readonly<{
  mediaRefId: string;
  kind: SocialPlatformMetaAdapterMediaKind;
  storageReference: string;
  displayHint: string | null;
  referencesOnly: true;
  containsCredentials: false;
  containsNetworkUrl: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformMetaAdapterPostRequest = Readonly<{
  requestId: string;
  adapterId: string;
  channel: SocialPlatformMetaAdapterChannelIdentity;
  postKind: SocialPlatformMetaAdapterPostKind;
  captionText: string | null;
  mediaRefs: readonly SocialPlatformMetaAdapterMediaRef[];
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

export type SocialPlatformMetaAdapterCapabilities = Readonly<{
  supportedPlatforms: readonly SocialPlatformMetaAdapterPlatform[];
  supportedChannelTypes: readonly SocialPlatformMetaAdapterChannelType[];
  supportedPostKinds: readonly SocialPlatformMetaAdapterPostKind[];
  supportedMediaKinds: readonly SocialPlatformMetaAdapterMediaKind[];
  capabilityFlags: readonly SocialPlatformMetaAdapterCapabilityFlag[];
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

export type SocialPlatformMetaAdapterSafetyRequirements = Readonly<{
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

export type SocialPlatformMetaAdapterIdentity = Readonly<{
  adapterId: string;
  adapterVersion: typeof SOCIAL_PLATFORM_META_ADAPTER_VERSION;
  displayName: string;
  provider: "meta";
  contractOnly: true;
  implementsNothing: true;
  containsCredentials: false;
  containsOAuthFlow: false;
  containsNetworkClient: false;
  containsGraphApiClient: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformMetaAdapterContract = Readonly<{
  identity: SocialPlatformMetaAdapterIdentity;
  capabilities: SocialPlatformMetaAdapterCapabilities;
  safety: SocialPlatformMetaAdapterSafetyRequirements;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

const PLATFORM_SET = new Set<string>(SOCIAL_PLATFORM_META_ADAPTER_PLATFORMS);
const CHANNEL_TYPE_SET = new Set<string>(SOCIAL_PLATFORM_META_ADAPTER_CHANNEL_TYPES);
const POST_KIND_SET = new Set<string>(SOCIAL_PLATFORM_META_ADAPTER_POST_KINDS);
const MEDIA_KIND_SET = new Set<string>(SOCIAL_PLATFORM_META_ADAPTER_MEDIA_KINDS);

const CHANNEL_TYPE_PLATFORM: Readonly<
  Record<SocialPlatformMetaAdapterChannelType, SocialPlatformMetaAdapterPlatform>
> = {
  facebook_page: "facebook",
  instagram_business_account: "instagram",
};

const SHARED_SAFETY: SocialPlatformMetaAdapterSafetyRequirements = {
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

const FACEBOOK_CAPABILITY_FLAGS: readonly SocialPlatformMetaAdapterCapabilityFlag[] = [
  "feed_post_supported",
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

const INSTAGRAM_CAPABILITY_FLAGS: readonly SocialPlatformMetaAdapterCapabilityFlag[] = [
  "feed_post_supported",
  "story_post_supported",
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

function createMetaAdapterContract(
  platform: SocialPlatformMetaAdapterPlatform,
): SocialPlatformMetaAdapterContract {
  const channelType: SocialPlatformMetaAdapterChannelType =
    platform === "facebook" ? "facebook_page" : "instagram_business_account";
  const supportsStory = platform === "instagram";

  return deepFreeze({
    identity: {
      adapterId: `meta-platform-adapter-${platform}-contract`,
      adapterVersion: SOCIAL_PLATFORM_META_ADAPTER_VERSION,
      displayName: `Meta ${platform} platform adapter contract`,
      provider: "meta",
      contractOnly: true,
      implementsNothing: true,
      containsCredentials: false,
      containsOAuthFlow: false,
      containsNetworkClient: false,
      containsGraphApiClient: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    capabilities: {
      supportedPlatforms: [platform],
      supportedChannelTypes: [channelType],
      supportedPostKinds: supportsStory
        ? ["feed_post", "story_post"]
        : ["feed_post"],
      supportedMediaKinds: ["image_ref", "video_ref", "carousel_ref"],
      capabilityFlags: platform === "facebook"
        ? FACEBOOK_CAPABILITY_FLAGS
        : INSTAGRAM_CAPABILITY_FLAGS,
      supportsDryRun: true,
      supportsFeedPost: true,
      supportsStoryPost: supportsStory,
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

export const SOCIAL_PLATFORM_META_ADAPTER_CONTRACTS = Object.freeze([
  createMetaAdapterContract("facebook"),
  createMetaAdapterContract("instagram"),
]);

export function isSocialPlatformMetaAdapterPlatform(
  value: unknown,
): value is SocialPlatformMetaAdapterPlatform {
  return typeof value === "string" && PLATFORM_SET.has(value);
}

export function isSocialPlatformMetaAdapterChannelType(
  value: unknown,
): value is SocialPlatformMetaAdapterChannelType {
  return typeof value === "string" && CHANNEL_TYPE_SET.has(value);
}

export function isSocialPlatformMetaAdapterPostKind(
  value: unknown,
): value is SocialPlatformMetaAdapterPostKind {
  return typeof value === "string" && POST_KIND_SET.has(value);
}

export function isSocialPlatformMetaAdapterMediaKind(
  value: unknown,
): value is SocialPlatformMetaAdapterMediaKind {
  return typeof value === "string" && MEDIA_KIND_SET.has(value);
}

export function createSocialPlatformMetaAdapterContract(
  platform: SocialPlatformMetaAdapterPlatform,
): SocialPlatformMetaAdapterContract {
  const contract = SOCIAL_PLATFORM_META_ADAPTER_CONTRACTS.find((candidate) =>
    candidate.capabilities.supportedPlatforms.includes(platform),
  );
  if (!contract) {
    throw new Error(`Meta adapter contract is unavailable for platform: ${platform}`);
  }
  return contract;
}

export function metaAdapterSupportsPlatform(
  contract: SocialPlatformMetaAdapterContract,
  platform: SocialPlatformMetaAdapterPlatform,
): boolean {
  return contract.capabilities.supportedPlatforms.includes(platform);
}

export function metaAdapterSupportsChannelType(
  contract: SocialPlatformMetaAdapterContract,
  channelType: SocialPlatformMetaAdapterChannelType,
): boolean {
  return contract.capabilities.supportedChannelTypes.includes(channelType);
}

export function metaAdapterSupportsPostKind(
  contract: SocialPlatformMetaAdapterContract,
  postKind: SocialPlatformMetaAdapterPostKind,
): boolean {
  return contract.capabilities.supportedPostKinds.includes(postKind);
}

export function metaAdapterSupportsMediaKind(
  contract: SocialPlatformMetaAdapterContract,
  mediaKind: SocialPlatformMetaAdapterMediaKind,
): boolean {
  return contract.capabilities.supportedMediaKinds.includes(mediaKind);
}

export function toExecutionAdapterPlatform(
  platform: SocialPlatformMetaAdapterPlatform,
): SocialPublicationExecutionAdapterPlatform {
  return platform;
}

export function toExecutionAdapterChannelType(
  channelType: SocialPlatformMetaAdapterChannelType,
): SocialPublicationExecutionAdapterChannelType {
  return channelType;
}

export function validateSocialPlatformMetaAdapterContract(
  contract: unknown,
): SocialPlatformMetaAdapterValidationResult {
  const diagnostics: SocialPlatformMetaAdapterDiagnostic[] = [];
  if (!isRecord(contract)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", "contract", "Meta adapter contract must be an object."),
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
      "Meta adapter contract must not grant execution permission.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialPlatformMetaAdapterChannelIdentity(
  channel: unknown,
  path = "channel",
): SocialPlatformMetaAdapterValidationResult {
  const diagnostics: SocialPlatformMetaAdapterDiagnostic[] = [];
  if (!isRecord(channel)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("channel_identity_invalid", path, "Meta adapter channel identity must be an object."),
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
  if (!isSocialPlatformMetaAdapterPlatform(channel.platform)) {
    diagnostics.push(errorDiagnostic(
      "channel_platform_unknown",
      `${path}.platform`,
      "Meta adapter channel platform is not supported.",
    ));
  }
  if (!isSocialPlatformMetaAdapterChannelType(channel.channelType)) {
    diagnostics.push(errorDiagnostic(
      "channel_type_unknown",
      `${path}.channelType`,
      "Meta adapter channel type is not supported.",
    ));
  } else if (
    isSocialPlatformMetaAdapterPlatform(channel.platform) &&
    CHANNEL_TYPE_PLATFORM[channel.channelType] !== channel.platform
  ) {
    diagnostics.push(errorDiagnostic(
      "channel_platform_mismatch",
      path,
      "Meta adapter channel type must match platform.",
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
      "Meta adapter channel identity must remain reference-only.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialPlatformMetaAdapterMediaRef(
  mediaRef: unknown,
  path: string,
): SocialPlatformMetaAdapterValidationResult {
  const diagnostics: SocialPlatformMetaAdapterDiagnostic[] = [];
  if (!isRecord(mediaRef)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", path, "Meta adapter media ref must be an object."),
      ],
    };
  }

  requireText(mediaRef.mediaRefId, `${path}.mediaRefId`, "media_ref_id_required", diagnostics);
  if (!isSocialPlatformMetaAdapterMediaKind(mediaRef.kind)) {
    diagnostics.push(errorDiagnostic(
      "media_kind_unknown",
      `${path}.kind`,
      "Meta adapter media kind is not supported.",
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
      "Meta adapter media refs must use internal storage references, not network URLs.",
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
      "Meta adapter media ref must remain reference-only.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialPlatformMetaAdapterPostRequest(
  request: unknown,
): SocialPlatformMetaAdapterValidationResult {
  const diagnostics: SocialPlatformMetaAdapterDiagnostic[] = [];
  if (!isRecord(request)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", "request", "Meta adapter post request must be an object."),
      ],
    };
  }

  requireText(request.requestId, "request.requestId", "request_id_required", diagnostics);
  requireText(request.adapterId, "request.adapterId", "adapter_id_required", diagnostics);
  if (!isSocialPlatformMetaAdapterPostKind(request.postKind)) {
    diagnostics.push(errorDiagnostic(
      "post_kind_unknown",
      "request.postKind",
      "Meta adapter post kind is not supported.",
    ));
  }
  if (request.scheduledAt !== null && !isValidTimestamp(request.scheduledAt)) {
    diagnostics.push(errorDiagnostic(
      "timestamp_invalid",
      "request.scheduledAt",
      "Meta adapter scheduledAt must be null or a valid timestamp.",
    ));
  }
  if (request.captionText !== null && typeof request.captionText !== "string") {
    diagnostics.push(errorDiagnostic(
      "caption_invalid",
      "request.captionText",
      "Meta adapter caption must be null or a string.",
    ));
  }

  const channelValidation = validateSocialPlatformMetaAdapterChannelIdentity(request.channel, "request.channel");
  diagnostics.push(...channelValidation.diagnostics);

  if (!Array.isArray(request.mediaRefs)) {
    diagnostics.push(errorDiagnostic(
      "media_ref_required",
      "request.mediaRefs",
      "Meta adapter post request requires a mediaRefs array.",
    ));
  } else {
    request.mediaRefs.forEach((mediaRef, index) => {
      const mediaValidation = validateSocialPlatformMetaAdapterMediaRef(
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

export function detectSocialPlatformMetaAdapterForbiddenStates(
  contract: SocialPlatformMetaAdapterContract,
  request: SocialPlatformMetaAdapterPostRequest,
): SocialPlatformMetaAdapterValidationResult {
  const diagnostics: SocialPlatformMetaAdapterDiagnostic[] = [];

  if (request.adapterId !== contract.identity.adapterId) {
    diagnostics.push(blockDiagnostic(
      "contract_invariant_failed",
      "request.adapterId",
      "Meta adapter post request adapter id does not match contract.",
    ));
  }

  if (!metaAdapterSupportsPlatform(contract, request.channel.platform)) {
    diagnostics.push(blockDiagnostic(
      "unsupported_channel",
      "request.channel.platform",
      "Meta adapter contract does not support this platform.",
    ));
  }

  if (!metaAdapterSupportsChannelType(contract, request.channel.channelType)) {
    diagnostics.push(blockDiagnostic(
      "unsupported_channel",
      "request.channel.channelType",
      "Meta adapter contract does not support this channel type.",
    ));
  }

  if (!metaAdapterSupportsPostKind(contract, request.postKind)) {
    diagnostics.push(blockDiagnostic(
      "unsupported_post_kind",
      "request.postKind",
      "Meta adapter contract does not support this post kind.",
    ));
  }

  for (const [index, mediaRef] of request.mediaRefs.entries()) {
    if (!metaAdapterSupportsMediaKind(contract, mediaRef.kind)) {
      diagnostics.push(blockDiagnostic(
        "unsupported_media_kind",
        `request.mediaRefs.${index}.kind`,
        "Meta adapter contract does not support this media kind.",
      ));
    }
  }

  if (request.mediaRefs.length === 0) {
    diagnostics.push(blockDiagnostic(
      "media_ref_required",
      "request.mediaRefs",
      "Meta adapter post request requires at least one media reference.",
    ));
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

export function serializeSocialPlatformMetaAdapterContract(
  contract: SocialPlatformMetaAdapterContract,
): string {
  return JSON.stringify(toStableValue(contract));
}

export function hydrateSocialPlatformMetaAdapterContract(
  serialized: string,
): Readonly<{
  ok: true;
  value: SocialPlatformMetaAdapterContract;
}> | Readonly<{
  ok: false;
  diagnostics: readonly SocialPlatformMetaAdapterDiagnostic[];
}> {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const validation = validateSocialPlatformMetaAdapterContract(parsed);
    if (!validation.valid || !isRecord(parsed)) {
      return { ok: false, diagnostics: validation.diagnostics };
    }
    return { ok: true, value: deepFreeze(parsed as SocialPlatformMetaAdapterContract) };
  } catch {
    return {
      ok: false,
      diagnostics: [
        errorDiagnostic(
          "serialization_invalid",
          "serialized",
          "Meta adapter contract serialization must be valid JSON.",
        ),
      ],
    };
  }
}

function validateIdentity(
  identity: unknown,
  path: string,
  diagnostics: SocialPlatformMetaAdapterDiagnostic[],
): void {
  if (!isRecord(identity)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", path, "Meta adapter identity must be an object."));
    return;
  }
  requireText(identity.adapterId, `${path}.adapterId`, "adapter_id_required", diagnostics);
  if (identity.adapterVersion !== SOCIAL_PLATFORM_META_ADAPTER_VERSION) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.adapterVersion`,
      "Meta adapter version must match the current contract version.",
    ));
  }
  if (identity.provider !== "meta") {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.provider`,
      "Meta adapter provider must be meta.",
    ));
  }
  if (
    identity.contractOnly !== true ||
    identity.implementsNothing !== true ||
    identity.containsCredentials !== false ||
    identity.containsOAuthFlow !== false ||
    identity.containsNetworkClient !== false ||
    identity.containsGraphApiClient !== false ||
    identity.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "Meta adapter identity must remain contract-only and non-executing.",
    ));
  }
}

function validateCapabilities(
  capabilities: unknown,
  path: string,
  diagnostics: SocialPlatformMetaAdapterDiagnostic[],
): void {
  if (!isRecord(capabilities)) {
    diagnostics.push(errorDiagnostic("capabilities_invalid", path, "Meta adapter capabilities must be an object."));
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
      if (!isSocialPlatformMetaAdapterPlatform(platform)) {
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
      "Meta adapter capabilities must forbid network, OAuth, credentials, and execution permission.",
    ));
  }
}

function validateSafety(
  safety: unknown,
  path: string,
  diagnostics: SocialPlatformMetaAdapterDiagnostic[],
): void {
  if (!isRecord(safety)) {
    diagnostics.push(errorDiagnostic(
      "safety_requirements_invalid",
      path,
      "Meta adapter safety requirements must be an object.",
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
        "Meta adapter safety requirement invariant failed.",
      ));
    }
  }
}

function assertForbiddenFlags(
  value: Record<string, unknown>,
  path: string,
  diagnostics: SocialPlatformMetaAdapterDiagnostic[],
): void {
  if (value.usesNoCredentials === false) {
    diagnostics.push(errorDiagnostic("credential_forbidden", path, "Meta adapter request must not use credentials."));
  }
  if (value.usesNoOAuth === false) {
    diagnostics.push(errorDiagnostic("oauth_forbidden", path, "Meta adapter request must not use OAuth."));
  }
  if (value.callsNoExternalApis === false) {
    diagnostics.push(errorDiagnostic("external_api_forbidden", path, "Meta adapter request must not call external APIs."));
  }
  if (value.usesNoNetwork === false) {
    diagnostics.push(errorDiagnostic("network_forbidden", path, "Meta adapter request must not use network."));
  }
  if (value.grantsExecutionPermission !== false) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "Meta adapter request must not grant execution permission.",
    ));
  }
}

function requireText(
  value: unknown,
  path: string,
  code: SocialPlatformMetaAdapterErrorCode,
  diagnostics: SocialPlatformMetaAdapterDiagnostic[],
): void {
  if (hasText(value)) return;
  diagnostics.push(errorDiagnostic(code, path, "Required Meta adapter text field is missing."));
}

function errorDiagnostic(
  code: SocialPlatformMetaAdapterErrorCode,
  path: string,
  message: string,
): SocialPlatformMetaAdapterDiagnostic {
  return { code, path, message, severity: "error" };
}

function blockDiagnostic(
  code: SocialPlatformMetaAdapterErrorCode,
  path: string,
  message: string,
): SocialPlatformMetaAdapterDiagnostic {
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
