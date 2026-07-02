import type {
  SocialPublicationExecutionAdapterContract,
  SocialPublicationExecutionAdapterPlatform,
} from "./social-publication-execution-adapter";
import { createDryRunSocialPublicationExecutionAdapter } from "./social-publication-execution-adapter-dry-run";
import {
  discoverSocialPlatformAdapterByDiscoveryKey,
  discoverSocialPlatformAdaptersByPlatform,
  isSocialPlatformAdapterSupportedPlatform,
  type SocialPlatformAdapterImplementationKind,
  type SocialPlatformAdapterPlatform,
  type SocialPlatformAdapterRegistryEntry,
  type SocialPlatformAdapterSupportedPlatform,
} from "./social-platform-adapter-registry";

export const SOCIAL_PLATFORM_ADAPTER_FACTORY_VERSION = "d11-m2-v1" as const;

export type SocialPlatformAdapterFactoryDiagnosticCode =
  | "platform_unknown"
  | "implementation_kind_unknown"
  | "registry_entry_missing"
  | "unsupported_platform"
  | "channel_platform_mismatch"
  | "channel_unsupported";

export type SocialPlatformAdapterFactoryDiagnostic = Readonly<{
  code: SocialPlatformAdapterFactoryDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPlatformAdapterFactoryResult = Readonly<{
  ok: true;
  value: SocialPlatformAdapterFactorySelection;
}> | Readonly<{
  ok: false;
  diagnostics: readonly SocialPlatformAdapterFactoryDiagnostic[];
}>;

export type SocialPlatformAdapterFactorySelection = Readonly<{
  factoryVersion: typeof SOCIAL_PLATFORM_ADAPTER_FACTORY_VERSION;
  platform: SocialPlatformAdapterPlatform;
  implementationKind: SocialPlatformAdapterImplementationKind;
  registryEntry: SocialPlatformAdapterRegistryEntry;
  executionAdapterContract: SocialPublicationExecutionAdapterContract | null;
  supported: boolean;
  dryRunAvailable: boolean;
  executionCapable: false;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  usesNoNetwork: true;
  usesNoOAuth: true;
  usesNoCredentials: true;
  callsNoExternalApis: true;
}>;

function isExecutionAdapterPlatform(
  platform: SocialPlatformAdapterSupportedPlatform,
): platform is SocialPublicationExecutionAdapterPlatform {
  return platform === "facebook" || platform === "instagram";
}

function createReferenceExecutionAdapterContract(
  platform: SocialPublicationExecutionAdapterPlatform,
): SocialPublicationExecutionAdapterContract {
  const dryRun = createDryRunSocialPublicationExecutionAdapter(platform);

  return {
    ...dryRun,
    identity: {
      ...dryRun.identity,
      adapterId: `execution-adapter-${platform}-reference`,
      adapterKind: "platform_contract",
      displayName: `${platform} reference platform adapter contract`,
    },
    dryRun: {
      ...dryRun.dryRun,
      dryRunSupported: false,
      dryRunOnly: false,
    },
    capabilities: {
      ...dryRun.capabilities,
      supportsDryRun: false,
    },
  };
}

function resolveRegistryEntry(
  platform: SocialPlatformAdapterPlatform,
  implementationKind: SocialPlatformAdapterImplementationKind,
): SocialPlatformAdapterRegistryEntry | null {
  return discoverSocialPlatformAdapterByDiscoveryKey(
    `${platform}:${implementationKind}`,
  );
}

function buildSelection(
  platform: SocialPlatformAdapterPlatform,
  implementationKind: SocialPlatformAdapterImplementationKind,
  registryEntry: SocialPlatformAdapterRegistryEntry,
  executionAdapterContract: SocialPublicationExecutionAdapterContract | null,
): SocialPlatformAdapterFactorySelection {
  return deepFreeze({
    factoryVersion: SOCIAL_PLATFORM_ADAPTER_FACTORY_VERSION,
    platform,
    implementationKind,
    registryEntry,
    executionAdapterContract,
    supported: registryEntry.implementationKind !== "unsupported",
    dryRunAvailable: registryEntry.capabilities.supportsDryRun,
    executionCapable: false,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    usesNoNetwork: true,
    usesNoOAuth: true,
    usesNoCredentials: true,
    callsNoExternalApis: true,
  });
}

export function createSocialPlatformAdapter(input: Readonly<{
  platform: SocialPlatformAdapterPlatform;
  implementationKind: SocialPlatformAdapterImplementationKind;
}>): SocialPlatformAdapterFactoryResult {
  const diagnostics: SocialPlatformAdapterFactoryDiagnostic[] = [];

  if (!isKnownPlatform(input.platform)) {
    diagnostics.push({
      code: "platform_unknown",
      path: "platform",
      message: "Platform is not part of the D11 adapter registry.",
      severity: "error",
    });
    return { ok: false, diagnostics };
  }

  if (
    input.implementationKind !== "reference" &&
    input.implementationKind !== "dry_run" &&
    input.implementationKind !== "unsupported"
  ) {
    diagnostics.push({
      code: "implementation_kind_unknown",
      path: "implementationKind",
      message: "Platform adapter implementation kind is not supported.",
      severity: "error",
    });
    return { ok: false, diagnostics };
  }

  const registryEntry = resolveRegistryEntry(input.platform, input.implementationKind);
  if (!registryEntry) {
    diagnostics.push({
      code: "registry_entry_missing",
      path: "registryEntry",
      message: "No registry entry exists for the requested platform adapter.",
      severity: "error",
    });
    return { ok: false, diagnostics };
  }

  if (input.implementationKind === "unsupported") {
    return {
      ok: true,
      value: buildSelection(input.platform, "unsupported", registryEntry, null),
    };
  }

  if (!isSocialPlatformAdapterSupportedPlatform(input.platform)) {
    diagnostics.push({
      code: "unsupported_platform",
      path: "platform",
      message: "Supported adapter implementations are unavailable for this platform.",
      severity: "error",
    });
    return { ok: false, diagnostics };
  }

  const executionAdapterContract = isExecutionAdapterPlatform(input.platform)
    ? input.implementationKind === "dry_run"
      ? createDryRunSocialPublicationExecutionAdapter(input.platform)
      : createReferenceExecutionAdapterContract(input.platform)
    : null;

  return {
    ok: true,
    value: buildSelection(
      input.platform,
      input.implementationKind,
      registryEntry,
      executionAdapterContract,
    ),
  };
}

export function resolveSocialPlatformAdapter(input: Readonly<{
  platform: SocialPlatformAdapterPlatform;
  preferDryRun?: boolean;
}>): SocialPlatformAdapterFactoryResult {
  const platformEntries = discoverSocialPlatformAdaptersByPlatform(input.platform);
  if (platformEntries.length === 0) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "platform_unknown",
          path: "platform",
          message: "Platform is not part of the D11 adapter registry.",
          severity: "error",
        },
      ],
    };
  }

  const unsupportedOnly = platformEntries.every(
    (entry) => entry.implementationKind === "unsupported",
  );
  if (unsupportedOnly) {
    return createSocialPlatformAdapter({
      platform: input.platform,
      implementationKind: "unsupported",
    });
  }

  const implementationKind: SocialPlatformAdapterImplementationKind =
    input.preferDryRun === false ? "reference" : "dry_run";

  return createSocialPlatformAdapter({
    platform: input.platform,
    implementationKind,
  });
}

export function createUnsupportedSocialPlatformAdapter(
  platform: SocialPlatformAdapterPlatform,
): SocialPlatformAdapterFactoryResult {
  return createSocialPlatformAdapter({
    platform,
    implementationKind: "unsupported",
  });
}

function isKnownPlatform(
  platform: SocialPlatformAdapterPlatform,
): platform is SocialPlatformAdapterPlatform {
  return discoverSocialPlatformAdaptersByPlatform(platform).length > 0;
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return Object.freeze(value);
}
