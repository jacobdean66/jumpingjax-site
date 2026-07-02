import { replaySocialPublicationExecutionAdapters } from "./social-publication-execution-adapter-replay";
import type { SocialPublicationExecutionPersistenceModel } from "./social-publication-execution-repository";
import {
  createSocialPlatformAdapter,
  resolveSocialPlatformAdapter,
  type SocialPlatformAdapterFactorySelection,
} from "./social-platform-adapter-factory";
import {
  getSocialPlatformAdapterRegistrySnapshot,
  listRegisteredSocialPlatformAdapters,
  listSupportedSocialPlatformAdapterChannels,
  listUnsupportedSocialPlatformAdapterChannels,
  type SocialPlatformAdapterChannelRegistration,
  type SocialPlatformAdapterFeatureFlag,
  type SocialPlatformAdapterPlatform,
  type SocialPlatformAdapterRegistryEntry,
  type SocialPlatformAdapterRegistrySnapshot,
  type SocialPlatformAdapterSupportedPlatform,
  isSocialPlatformAdapterSupportedPlatform,
} from "./social-platform-adapter-registry";

export const SOCIAL_PLATFORM_ADAPTER_CAPABILITY_REPLAY_VERSION = "d11-m3-v1" as const;

export const SOCIAL_PLATFORM_ADAPTER_CAPABILITY_REPLAY_DIAGNOSTIC_CODES = [
  "factory_resolution_failed",
  "registry_entry_missing",
  "execution_projection_error",
] as const;

export type SocialPlatformAdapterCapabilityReplayDiagnosticCode =
  (typeof SOCIAL_PLATFORM_ADAPTER_CAPABILITY_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPlatformAdapterCapabilityReplayDiagnostic = Readonly<{
  code: SocialPlatformAdapterCapabilityReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPlatformAdapterPlatformReadiness = Readonly<{
  platform: SocialPlatformAdapterPlatform;
  supported: boolean;
  adapterRegistered: boolean;
  dryRunAvailable: boolean;
  executionCapable: false;
  referenceAdapterId: string | null;
  dryRunAdapterId: string | null;
  unsupportedAdapterId: string | null;
  supportedChannels: readonly SocialPlatformAdapterChannelRegistration[];
  unsupportedChannels: readonly SocialPlatformAdapterChannelRegistration[];
  featureFlags: readonly SocialPlatformAdapterFeatureFlag[];
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformAdapterCapabilityReadModel = Readonly<{
  replayVersion: typeof SOCIAL_PLATFORM_ADAPTER_CAPABILITY_REPLAY_VERSION;
  registry: SocialPlatformAdapterRegistrySnapshot;
  registeredAdapters: readonly SocialPlatformAdapterRegistryEntry[];
  availableAdapterSelections: readonly SocialPlatformAdapterFactorySelection[];
  supportedPlatforms: readonly SocialPlatformAdapterSupportedPlatform[];
  unsupportedPlatforms: readonly SocialPlatformAdapterPlatform[];
  supportedChannels: readonly SocialPlatformAdapterChannelRegistration[];
  unsupportedChannels: readonly SocialPlatformAdapterChannelRegistration[];
  dryRunAvailability: Readonly<Record<SocialPlatformAdapterSupportedPlatform, boolean>>;
  executionCapability: Readonly<{
    executionCapable: false;
    modeledOnly: true;
    realExecutionBlocked: true;
    oauthBlocked: true;
    credentialsBlocked: true;
    networkBlocked: true;
    sdkBlocked: true;
    externalApiBlocked: true;
  }>;
  platformReadiness: readonly SocialPlatformAdapterPlatformReadiness[];
  featureFlags: readonly SocialPlatformAdapterFeatureFlag[];
  executionProjection: Readonly<{
    availableAdapterCount: number;
    missingAdapterCount: number;
    dryRunCapableJobCount: number;
    unsupportedChannelJobCount: number;
    adapterReadyJobCount: number;
    adapterBlockedJobCount: number;
    diagnosticCount: number;
    errorCount: number;
  }> | null;
  diagnostics: readonly SocialPlatformAdapterCapabilityReplayDiagnostic[];
  summary: Readonly<{
    registeredAdapterCount: number;
    supportedPlatformCount: number;
    unsupportedPlatformCount: number;
    dryRunPlatformCount: number;
    unsupportedChannelCount: number;
    platformReadyCount: number;
    platformBlockedCount: number;
    diagnosticCount: number;
    errorCount: number;
    computedOnly: true;
    readOnly: true;
    authoritative: false;
    grantsExecutionPermission: false;
    executesNothing: true;
    publishesNothing: true;
  }>;
  replayIntegrity: Readonly<{
    valid: boolean;
    deterministic: true;
    source: "social_platform_adapter_capability_replay";
    computedOnly: true;
    authoritative: false;
  }>;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformAdapterCapabilityReplayResult = Readonly<{
  ok: true;
  value: SocialPlatformAdapterCapabilityReadModel;
}>;

const EMPTY_EXECUTION_MODEL: SocialPublicationExecutionPersistenceModel = Object.freeze({
  intents: [],
  results: [],
});

export function replaySocialPlatformAdapterCapabilities(
  model: SocialPublicationExecutionPersistenceModel = EMPTY_EXECUTION_MODEL,
  input: Readonly<{
    includeExecutionProjection?: boolean;
  }> = {},
): SocialPlatformAdapterCapabilityReplayResult {
  const diagnostics: SocialPlatformAdapterCapabilityReplayDiagnostic[] = [];
  const registry = getSocialPlatformAdapterRegistrySnapshot();
  const registeredAdapters = listRegisteredSocialPlatformAdapters();
  const supportedChannels = listSupportedSocialPlatformAdapterChannels();
  const unsupportedChannels = listUnsupportedSocialPlatformAdapterChannels();

  const availableAdapterSelections: SocialPlatformAdapterFactorySelection[] = [];
  for (const entry of registeredAdapters) {
    const selection = createSocialPlatformAdapter({
      platform: entry.platform,
      implementationKind: entry.implementationKind,
    });
    if (!selection.ok) {
      diagnostics.push({
        code: "factory_resolution_failed",
        path: `registeredAdapters.${entry.adapterId}`,
        message: "Registry entry could not be resolved through the platform adapter factory.",
        severity: "error",
      });
      continue;
    }
    availableAdapterSelections.push(selection.value);
  }

  const platformReadiness = registry.entries
    .map((entry) => entry.platform)
    .filter((platform, index, values) => values.indexOf(platform) === index)
    .map((platform) => projectPlatformReadiness(platform, diagnostics));

  const dryRunAvailability = platformReadiness.reduce<
    Record<SocialPlatformAdapterSupportedPlatform, boolean>
  >((output, readiness) => {
    if (readiness.platform === "facebook" || readiness.platform === "instagram") {
      output[readiness.platform] = readiness.dryRunAvailable;
    }
    return output;
  }, {
    facebook: false,
    instagram: false,
  });

  const executionProjection = input.includeExecutionProjection === false
    ? null
    : projectExecutionCapabilities(model, diagnostics);

  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const platformReadyCount = platformReadiness.filter(
    (readiness) =>
      readiness.supported &&
      readiness.adapterRegistered &&
      readiness.blockingReasons.length === 0,
  ).length;
  const platformBlockedCount = platformReadiness.length - platformReadyCount;

  return {
    ok: true,
    value: deepFreeze({
      replayVersion: SOCIAL_PLATFORM_ADAPTER_CAPABILITY_REPLAY_VERSION,
      registry,
      registeredAdapters,
      availableAdapterSelections,
      supportedPlatforms: [...registry.supportedPlatforms],
      unsupportedPlatforms: [...registry.unsupportedPlatforms],
      supportedChannels,
      unsupportedChannels,
      dryRunAvailability,
      executionCapability: {
        executionCapable: false,
        modeledOnly: true,
        realExecutionBlocked: true,
        oauthBlocked: true,
        credentialsBlocked: true,
        networkBlocked: true,
        sdkBlocked: true,
        externalApiBlocked: true,
      },
      platformReadiness,
      featureFlags: [...registry.featureFlags],
      executionProjection,
      diagnostics,
      summary: {
        registeredAdapterCount: registeredAdapters.length,
        supportedPlatformCount: registry.supportedPlatforms.length,
        unsupportedPlatformCount: registry.unsupportedPlatforms.length,
        dryRunPlatformCount: platformReadiness.filter((item) => item.dryRunAvailable).length,
        unsupportedChannelCount: unsupportedChannels.length,
        platformReadyCount,
        platformBlockedCount,
        diagnosticCount: diagnostics.length,
        errorCount,
        computedOnly: true,
        readOnly: true,
        authoritative: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
      replayIntegrity: {
        valid: errorCount === 0,
        deterministic: true,
        source: "social_platform_adapter_capability_replay",
        computedOnly: true,
        authoritative: false,
      },
      computedOnly: true,
      readOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    }),
  };
}

function projectPlatformReadiness(
  platform: SocialPlatformAdapterPlatform,
  diagnostics: SocialPlatformAdapterCapabilityReplayDiagnostic[],
): SocialPlatformAdapterPlatformReadiness {
  const reference = resolveSocialPlatformAdapter({ platform, preferDryRun: false });
  const dryRun = resolveSocialPlatformAdapter({ platform, preferDryRun: true });
  const unsupported = createSocialPlatformAdapter({
    platform,
    implementationKind: "unsupported",
  });

  const blockingReasons: string[] = [];
  if (!reference.ok) blockingReasons.push("reference_adapter_unavailable");
  if (!dryRun.ok && platform !== "tiktok" && platform !== "linkedin") {
    blockingReasons.push("dry_run_adapter_unavailable");
  }
  if (!unsupported.ok) {
    diagnostics.push({
      code: "registry_entry_missing",
      path: `platformReadiness.${platform}`,
      message: "Unsupported adapter registry entry is missing.",
      severity: "warning",
    });
  }

  const referenceEntry = reference.ok && reference.value.supported
    ? reference.value.registryEntry
    : null;
  const dryRunEntry = dryRun.ok && dryRun.value.implementationKind === "dry_run"
    ? dryRun.value.registryEntry
    : null;
  const unsupportedEntry = unsupported.ok ? unsupported.value.registryEntry : null;
  const supported = isSocialPlatformAdapterSupportedPlatform(platform);

  const platformChannels = listSupportedSocialPlatformAdapterChannels().filter(
    (channel) => channel.platform === platform,
  );
  const platformUnsupportedChannels = listUnsupportedSocialPlatformAdapterChannels().filter(
    (channel) => channel.platform === platform,
  );

  if (!supported) blockingReasons.push("platform_unsupported");

  return {
    platform,
    supported,
    adapterRegistered: Boolean(referenceEntry || dryRunEntry || unsupportedEntry),
    dryRunAvailable: Boolean(dryRunEntry?.capabilities.supportsDryRun),
    executionCapable: false,
    referenceAdapterId: referenceEntry?.adapterId ?? null,
    dryRunAdapterId: dryRunEntry?.adapterId ?? null,
    unsupportedAdapterId: unsupportedEntry?.adapterId ?? null,
    supportedChannels: platformChannels,
    unsupportedChannels: platformUnsupportedChannels,
    featureFlags: dryRunEntry?.featureFlags ?? unsupportedEntry?.featureFlags ?? [],
    blockingReasons,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function projectExecutionCapabilities(
  model: SocialPublicationExecutionPersistenceModel,
  diagnostics: SocialPlatformAdapterCapabilityReplayDiagnostic[],
): SocialPlatformAdapterCapabilityReadModel["executionProjection"] {
  const executionReplay = replaySocialPublicationExecutionAdapters(model);
  for (const diagnostic of executionReplay.value.diagnostics) {
    if (diagnostic.severity !== "error") continue;
    diagnostics.push({
      code: "execution_projection_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: "warning",
    });
  }

  return {
    availableAdapterCount: executionReplay.value.summary.availableAdapterCount,
    missingAdapterCount: executionReplay.value.summary.missingAdapterCount,
    dryRunCapableJobCount: executionReplay.value.summary.dryRunCapableJobCount,
    unsupportedChannelJobCount: executionReplay.value.summary.unsupportedChannelJobCount,
    adapterReadyJobCount: executionReplay.value.summary.adapterReadyJobCount,
    adapterBlockedJobCount: executionReplay.value.summary.adapterBlockedJobCount,
    diagnosticCount: executionReplay.value.summary.diagnosticCount,
    errorCount: executionReplay.value.summary.errorCount,
  };
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return Object.freeze(value);
}
