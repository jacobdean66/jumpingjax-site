import {
  SOCIAL_PUBLICATION_EXECUTION_ADAPTER_CHANNEL_TYPES,
  SOCIAL_PUBLICATION_EXECUTION_ADAPTER_PLATFORMS,
  type SocialPublicationExecutionAdapterChannelType,
  type SocialPublicationExecutionAdapterPlatform,
} from "./social-publication-execution-adapter";
import {
  PUBLICATION_TARGET_PLATFORMS,
  PUBLICATION_TARGET_TYPES,
  type PublicationTargetPlatform,
} from "./social-publication-targets";

export const SOCIAL_PLATFORM_ADAPTER_REGISTRY_VERSION = "d11-m1-v1" as const;

export const SOCIAL_PLATFORM_ADAPTER_PLATFORMS = [
  ...PUBLICATION_TARGET_PLATFORMS,
  "tiktok",
  "linkedin",
] as const;

export const SOCIAL_PLATFORM_ADAPTER_CONTRACT_SHELL_PLATFORMS = [
  "tiktok",
  "linkedin",
] as const;

export const SOCIAL_PLATFORM_ADAPTER_SUPPORTED_PLATFORMS = [
  ...SOCIAL_PUBLICATION_EXECUTION_ADAPTER_PLATFORMS,
  ...SOCIAL_PLATFORM_ADAPTER_CONTRACT_SHELL_PLATFORMS,
] as const;

export const SOCIAL_PLATFORM_ADAPTER_UNSUPPORTED_PLATFORMS = [] as const;

export const SOCIAL_PLATFORM_ADAPTER_CHANNEL_TYPES = [
  ...PUBLICATION_TARGET_TYPES,
  "tiktok_business_account",
  "linkedin_company_page",
] as const;

export const SOCIAL_PLATFORM_ADAPTER_SUPPORTED_CHANNEL_TYPES = [
  ...SOCIAL_PUBLICATION_EXECUTION_ADAPTER_CHANNEL_TYPES,
  "tiktok_business_account",
  "linkedin_company_page",
] as const;

export const SOCIAL_PLATFORM_ADAPTER_IMPLEMENTATION_KINDS = [
  "reference",
  "dry_run",
  "unsupported",
] as const;

export const SOCIAL_PLATFORM_ADAPTER_FEATURE_FLAGS = [
  "dry_run_enabled",
  "reference_contract_only",
  "execution_blocked",
  "oauth_blocked",
  "credentials_blocked",
  "network_blocked",
  "sdk_blocked",
  "external_api_blocked",
] as const;

export type SocialPlatformAdapterPlatform =
  (typeof SOCIAL_PLATFORM_ADAPTER_PLATFORMS)[number];

export type SocialPlatformAdapterContractShellPlatform =
  (typeof SOCIAL_PLATFORM_ADAPTER_CONTRACT_SHELL_PLATFORMS)[number];

export type SocialPlatformAdapterSupportedPlatform =
  (typeof SOCIAL_PLATFORM_ADAPTER_SUPPORTED_PLATFORMS)[number];

export type SocialPlatformAdapterUnsupportedPlatform =
  (typeof SOCIAL_PLATFORM_ADAPTER_UNSUPPORTED_PLATFORMS)[number];

export type SocialPlatformAdapterChannelType =
  (typeof SOCIAL_PLATFORM_ADAPTER_CHANNEL_TYPES)[number];

export type SocialPlatformAdapterSupportedChannelType =
  (typeof SOCIAL_PLATFORM_ADAPTER_SUPPORTED_CHANNEL_TYPES)[number];

export type SocialPlatformAdapterImplementationKind =
  (typeof SOCIAL_PLATFORM_ADAPTER_IMPLEMENTATION_KINDS)[number];

export type SocialPlatformAdapterFeatureFlag =
  (typeof SOCIAL_PLATFORM_ADAPTER_FEATURE_FLAGS)[number];

export type SocialPlatformAdapterCapabilityRegistration = Readonly<{
  supportsDryRun: boolean;
  supportsEvidenceCapture: boolean;
  supportsPreflightEvaluation: boolean;
  supportsExecution: false;
  supportedPlatforms: readonly SocialPlatformAdapterSupportedPlatform[];
  supportedChannelTypes: readonly SocialPlatformAdapterSupportedChannelType[];
  allowsNetwork: false;
  allowsOAuth: false;
  allowsCredentials: false;
  allowsExternalApiCall: false;
  allowsSdkUsage: false;
  executesNothing: true;
  publishesNothing: true;
  grantsExecutionPermission: false;
}>;

export type SocialPlatformAdapterChannelRegistration = Readonly<{
  channelType: SocialPlatformAdapterChannelType;
  platform: SocialPlatformAdapterPlatform;
  supported: boolean;
  displayName: string;
  identityOnly: true;
  containsCredentials: false;
  grantsExecutionPermission: false;
}>;

export type SocialPlatformAdapterRegistryEntry = Readonly<{
  adapterId: string;
  adapterVersion: string;
  displayName: string;
  platform: SocialPlatformAdapterPlatform;
  implementationKind: SocialPlatformAdapterImplementationKind;
  discoveryKey: string;
  capabilities: SocialPlatformAdapterCapabilityRegistration;
  channels: readonly SocialPlatformAdapterChannelRegistration[];
  featureFlags: readonly SocialPlatformAdapterFeatureFlag[];
  metadata: Readonly<{
    registryVersion: typeof SOCIAL_PLATFORM_ADAPTER_REGISTRY_VERSION;
    layer: "platform_adapter_registry";
    contractOnly: true;
    implementsNothing: SocialPlatformAdapterImplementationKind extends "unsupported"
      ? true
      : true;
    wiredToExecutionDryRun: boolean;
    notes: string | null;
  }>;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformAdapterRegistrySnapshot = Readonly<{
  registryVersion: typeof SOCIAL_PLATFORM_ADAPTER_REGISTRY_VERSION;
  entries: readonly SocialPlatformAdapterRegistryEntry[];
  supportedPlatforms: readonly SocialPlatformAdapterSupportedPlatform[];
  unsupportedPlatforms: readonly SocialPlatformAdapterUnsupportedPlatform[];
  supportedChannelTypes: readonly SocialPlatformAdapterSupportedChannelType[];
  unsupportedChannelTypes: readonly SocialPlatformAdapterChannelType[];
  featureFlags: readonly SocialPlatformAdapterFeatureFlag[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

const PLATFORM_SET = new Set<string>(SOCIAL_PLATFORM_ADAPTER_PLATFORMS);
const SUPPORTED_PLATFORM_SET = new Set<string>(
  SOCIAL_PLATFORM_ADAPTER_SUPPORTED_PLATFORMS,
);
const CHANNEL_TYPE_SET = new Set<string>(SOCIAL_PLATFORM_ADAPTER_CHANNEL_TYPES);
const SUPPORTED_CHANNEL_TYPE_SET = new Set<string>(
  SOCIAL_PLATFORM_ADAPTER_SUPPORTED_CHANNEL_TYPES,
);

const CHANNEL_TYPE_PLATFORM: Readonly<
  Record<SocialPlatformAdapterChannelType, SocialPlatformAdapterPlatform>
> = {
  facebook_page: "facebook",
  instagram_business_account: "instagram",
  tiktok_business_account: "tiktok",
  linkedin_company_page: "linkedin",
};

const CHANNEL_DISPLAY_NAMES: Readonly<
  Record<SocialPlatformAdapterChannelType, string>
> = {
  facebook_page: "Facebook Page",
  instagram_business_account: "Instagram Business Account",
  tiktok_business_account: "TikTok Business Account",
  linkedin_company_page: "LinkedIn Company Page",
};

const SHARED_CAPABILITY_FLAGS = {
  supportsExecution: false as const,
  allowsNetwork: false as const,
  allowsOAuth: false as const,
  allowsCredentials: false as const,
  allowsExternalApiCall: false as const,
  allowsSdkUsage: false as const,
  executesNothing: true as const,
  publishesNothing: true as const,
  grantsExecutionPermission: false as const,
};

const DRY_RUN_FEATURE_FLAGS: readonly SocialPlatformAdapterFeatureFlag[] = [
  "dry_run_enabled",
  "reference_contract_only",
  "execution_blocked",
  "oauth_blocked",
  "credentials_blocked",
  "network_blocked",
  "sdk_blocked",
  "external_api_blocked",
];

const REFERENCE_FEATURE_FLAGS: readonly SocialPlatformAdapterFeatureFlag[] = [
  "reference_contract_only",
  "execution_blocked",
  "oauth_blocked",
  "credentials_blocked",
  "network_blocked",
  "sdk_blocked",
  "external_api_blocked",
];

function channelRegistration(
  channelType: SocialPlatformAdapterChannelType,
): SocialPlatformAdapterChannelRegistration {
  const platform = CHANNEL_TYPE_PLATFORM[channelType];
  return {
    channelType,
    platform,
    supported: SUPPORTED_CHANNEL_TYPE_SET.has(channelType),
    displayName: CHANNEL_DISPLAY_NAMES[channelType],
    identityOnly: true,
    containsCredentials: false,
    grantsExecutionPermission: false,
  };
}

function supportedChannelTypeForPlatform(
  platform: SocialPlatformAdapterSupportedPlatform,
): SocialPlatformAdapterSupportedChannelType {
  if (platform === "facebook") return "facebook_page";
  if (platform === "instagram") return "instagram_business_account";
  if (platform === "tiktok") return "tiktok_business_account";
  return "linkedin_company_page";
}

function isExecutionDryRunPlatform(
  platform: SocialPlatformAdapterSupportedPlatform,
): platform is SocialPublicationExecutionAdapterPlatform {
  return platform === "facebook" || platform === "instagram";
}

function createSupportedPlatformEntry(
  platform: SocialPlatformAdapterSupportedPlatform,
  implementationKind: "reference" | "dry_run",
): SocialPlatformAdapterRegistryEntry {
  const channelType = supportedChannelTypeForPlatform(platform);
  const dryRun = implementationKind === "dry_run";
  const wiredToExecutionDryRun = dryRun && isExecutionDryRunPlatform(platform);

  return {
    adapterId: `platform-adapter-${platform}-${implementationKind}`,
    adapterVersion: SOCIAL_PLATFORM_ADAPTER_REGISTRY_VERSION,
    displayName: `${platform} ${implementationKind.replace("_", "-")} platform adapter`,
    platform,
    implementationKind,
    discoveryKey: `${platform}:${implementationKind}`,
    capabilities: {
      supportsDryRun: dryRun,
      supportsEvidenceCapture: dryRun,
      supportsPreflightEvaluation: true,
      supportedPlatforms: [platform],
      supportedChannelTypes: [channelType],
      ...SHARED_CAPABILITY_FLAGS,
    },
    channels: [channelRegistration(channelType)],
    featureFlags: dryRun ? DRY_RUN_FEATURE_FLAGS : REFERENCE_FEATURE_FLAGS,
    metadata: {
      registryVersion: SOCIAL_PLATFORM_ADAPTER_REGISTRY_VERSION,
      layer: "platform_adapter_registry",
      contractOnly: true,
      implementsNothing: true,
      wiredToExecutionDryRun,
      notes: dryRun
        ? wiredToExecutionDryRun
          ? "Registry entry maps to D10 dry-run execution adapter contract."
          : `Registry entry maps to D11 ${platform} contract-shell dry-run adapter.`
        : wiredToExecutionDryRun
          ? "Registry entry maps to D10 reference execution adapter contract."
          : `Registry entry maps to D11 ${platform} contract-shell reference adapter.`,
    },
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

const REGISTRY_ENTRIES: readonly SocialPlatformAdapterRegistryEntry[] = Object.freeze([
  createSupportedPlatformEntry("facebook", "reference"),
  createSupportedPlatformEntry("facebook", "dry_run"),
  createSupportedPlatformEntry("instagram", "reference"),
  createSupportedPlatformEntry("instagram", "dry_run"),
  createSupportedPlatformEntry("tiktok", "reference"),
  createSupportedPlatformEntry("tiktok", "dry_run"),
  createSupportedPlatformEntry("linkedin", "reference"),
  createSupportedPlatformEntry("linkedin", "dry_run"),
]);

const REGISTRY_BY_ID = new Map(
  REGISTRY_ENTRIES.map((entry) => [entry.adapterId, entry]),
);
const REGISTRY_BY_DISCOVERY_KEY = new Map(
  REGISTRY_ENTRIES.map((entry) => [entry.discoveryKey, entry]),
);
const REGISTRY_BY_PLATFORM = REGISTRY_ENTRIES.reduce<
  Map<SocialPlatformAdapterPlatform, SocialPlatformAdapterRegistryEntry[]>
>((output, entry) => {
  const existing = output.get(entry.platform) ?? [];
  existing.push(entry);
  output.set(entry.platform, existing);
  return output;
}, new Map());

export function isSocialPlatformAdapterPlatform(
  value: unknown,
): value is SocialPlatformAdapterPlatform {
  return typeof value === "string" && PLATFORM_SET.has(value);
}

export function isSocialPlatformAdapterSupportedPlatform(
  value: unknown,
): value is SocialPlatformAdapterSupportedPlatform {
  return typeof value === "string" && SUPPORTED_PLATFORM_SET.has(value);
}

export function isSocialPlatformAdapterChannelType(
  value: unknown,
): value is SocialPlatformAdapterChannelType {
  return typeof value === "string" && CHANNEL_TYPE_SET.has(value);
}

export function isSocialPlatformAdapterSupportedChannelType(
  value: unknown,
): value is SocialPlatformAdapterSupportedChannelType {
  return typeof value === "string" && SUPPORTED_CHANNEL_TYPE_SET.has(value);
}

export function isSocialPlatformAdapterImplementationKind(
  value: unknown,
): value is SocialPlatformAdapterImplementationKind {
  return (
    value === "reference" ||
    value === "dry_run" ||
    value === "unsupported"
  );
}

export function toPublicationTargetPlatform(
  platform: SocialPlatformAdapterSupportedPlatform,
): PublicationTargetPlatform {
  if (platform === "tiktok" || platform === "linkedin") {
    throw new Error(`Publication target mapping is unavailable for platform: ${platform}`);
  }
  return platform;
}

export function toExecutionAdapterPlatform(
  platform: SocialPlatformAdapterSupportedPlatform,
): SocialPublicationExecutionAdapterPlatform {
  if (!isExecutionDryRunPlatform(platform)) {
    throw new Error(`Execution adapter mapping is unavailable for platform: ${platform}`);
  }
  return platform;
}

export function toExecutionAdapterChannelType(
  channelType: SocialPlatformAdapterSupportedChannelType,
): SocialPublicationExecutionAdapterChannelType {
  if (
    channelType === "tiktok_business_account" ||
    channelType === "linkedin_company_page"
  ) {
    throw new Error(`Execution adapter mapping is unavailable for channel: ${channelType}`);
  }
  return channelType;
}

export function getSocialPlatformAdapterRegistrySnapshot(): SocialPlatformAdapterRegistrySnapshot {
  const unsupportedChannelTypes = SOCIAL_PLATFORM_ADAPTER_CHANNEL_TYPES.filter(
    (channelType) => !SUPPORTED_CHANNEL_TYPE_SET.has(channelType),
  );

  return deepFreeze({
    registryVersion: SOCIAL_PLATFORM_ADAPTER_REGISTRY_VERSION,
    entries: REGISTRY_ENTRIES,
    supportedPlatforms: [...SOCIAL_PLATFORM_ADAPTER_SUPPORTED_PLATFORMS],
    unsupportedPlatforms: [...SOCIAL_PLATFORM_ADAPTER_UNSUPPORTED_PLATFORMS],
    supportedChannelTypes: [...SOCIAL_PLATFORM_ADAPTER_SUPPORTED_CHANNEL_TYPES],
    unsupportedChannelTypes,
    featureFlags: [...SOCIAL_PLATFORM_ADAPTER_FEATURE_FLAGS],
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
}

export function listRegisteredSocialPlatformAdapters(): readonly SocialPlatformAdapterRegistryEntry[] {
  return REGISTRY_ENTRIES;
}

export function discoverSocialPlatformAdapterById(
  adapterId: string,
): SocialPlatformAdapterRegistryEntry | null {
  return REGISTRY_BY_ID.get(adapterId) ?? null;
}

export function discoverSocialPlatformAdapterByDiscoveryKey(
  discoveryKey: string,
): SocialPlatformAdapterRegistryEntry | null {
  return REGISTRY_BY_DISCOVERY_KEY.get(discoveryKey) ?? null;
}

export function discoverSocialPlatformAdaptersByPlatform(
  platform: SocialPlatformAdapterPlatform,
): readonly SocialPlatformAdapterRegistryEntry[] {
  return REGISTRY_BY_PLATFORM.get(platform) ?? [];
}

export function listSupportedSocialPlatformAdapterPlatforms(): readonly SocialPlatformAdapterSupportedPlatform[] {
  return [...SOCIAL_PLATFORM_ADAPTER_SUPPORTED_PLATFORMS];
}

export function listUnsupportedSocialPlatformAdapterPlatforms(): readonly SocialPlatformAdapterUnsupportedPlatform[] {
  return [...SOCIAL_PLATFORM_ADAPTER_UNSUPPORTED_PLATFORMS];
}

export function listRegisteredSocialPlatformAdapterChannels(): readonly SocialPlatformAdapterChannelRegistration[] {
  return REGISTRY_ENTRIES.flatMap((entry) => [...entry.channels]);
}

export function listSupportedSocialPlatformAdapterChannels(): readonly SocialPlatformAdapterChannelRegistration[] {
  return listRegisteredSocialPlatformAdapterChannels().filter(
    (channel) => channel.supported,
  );
}

export function listUnsupportedSocialPlatformAdapterChannels(): readonly SocialPlatformAdapterChannelRegistration[] {
  return listRegisteredSocialPlatformAdapterChannels().filter(
    (channel) => !channel.supported,
  );
}

export function getSocialPlatformAdapterVersion(
  adapterId: string,
): string | null {
  return discoverSocialPlatformAdapterById(adapterId)?.adapterVersion ?? null;
}

export function getSocialPlatformAdapterFeatureFlags(
  adapterId: string,
): readonly SocialPlatformAdapterFeatureFlag[] {
  return discoverSocialPlatformAdapterById(adapterId)?.featureFlags ?? [];
}

export function getSocialPlatformAdapterMetadata(
  adapterId: string,
): SocialPlatformAdapterRegistryEntry["metadata"] | null {
  return discoverSocialPlatformAdapterById(adapterId)?.metadata ?? null;
}

export function getSocialPlatformAdapterCapabilityRegistration(
  adapterId: string,
): SocialPlatformAdapterCapabilityRegistration | null {
  return discoverSocialPlatformAdapterById(adapterId)?.capabilities ?? null;
}

export function isSocialPlatformAdapterChannelSupported(
  platform: SocialPlatformAdapterPlatform,
  channelType: SocialPlatformAdapterChannelType,
): boolean {
  if (CHANNEL_TYPE_PLATFORM[channelType] !== platform) return false;
  return SUPPORTED_CHANNEL_TYPE_SET.has(channelType);
}

export function adapterRegistrySupportsPlatform(
  entry: SocialPlatformAdapterRegistryEntry,
  platform: SocialPlatformAdapterPlatform,
): boolean {
  return entry.capabilities.supportedPlatforms.includes(
    platform as SocialPlatformAdapterSupportedPlatform,
  );
}

export function adapterRegistrySupportsChannelType(
  entry: SocialPlatformAdapterRegistryEntry,
  channelType: SocialPlatformAdapterChannelType,
): boolean {
  return entry.capabilities.supportedChannelTypes.includes(
    channelType as SocialPlatformAdapterSupportedChannelType,
  );
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return Object.freeze(value);
}
