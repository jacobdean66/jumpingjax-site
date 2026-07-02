import { resolveSocialPlatformAdapter } from "./social-platform-adapter-factory";
import {
  isSocialPlatformAdapterSupportedPlatform,
  type SocialPlatformAdapterSupportedPlatform,
} from "./social-platform-adapter-registry";
import {
  createSocialPlatformMetaAdapterContract,
  detectSocialPlatformMetaAdapterForbiddenStates,
  validateSocialPlatformMetaAdapterPostRequest,
  type SocialPlatformMetaAdapterChannelIdentity,
  type SocialPlatformMetaAdapterContract,
  type SocialPlatformMetaAdapterDiagnostic,
  type SocialPlatformMetaAdapterMediaRef,
  type SocialPlatformMetaAdapterPlatform,
  type SocialPlatformMetaAdapterPostKind,
  type SocialPlatformMetaAdapterPostRequest,
} from "./social-platform-meta-adapter";

export const SOCIAL_PLATFORM_META_ADAPTER_DRY_RUN_VERSION = "d11-m5-v1" as const;

export type SocialPlatformMetaAdapterDryRunBlockedReason =
  | "factory_resolution_failed"
  | "registry_platform_unsupported"
  | "request_validation_failed"
  | "forbidden_state_detected"
  | "missing_media_refs"
  | "missing_capability"
  | "unsupported_channel"
  | "unsupported_post_kind"
  | "unsupported_media_kind"
  | "dry_run_unavailable";

export type SocialPlatformMetaAdapterDryRunSimulation = Readonly<{
  dryRunVersion: typeof SOCIAL_PLATFORM_META_ADAPTER_DRY_RUN_VERSION;
  platform: SocialPlatformMetaAdapterPlatform;
  metaContract: SocialPlatformMetaAdapterContract;
  factoryAdapterId: string | null;
  factoryDiscoveryKey: string | null;
  channelUsed: SocialPlatformMetaAdapterChannelIdentity;
  postKind: SocialPlatformMetaAdapterPostKind;
  mediaRefsRequired: readonly SocialPlatformMetaAdapterMediaRef[];
  missingCapabilities: readonly string[];
  blockedReasons: readonly SocialPlatformMetaAdapterDryRunBlockedReason[];
  wouldSendSummary: Readonly<{
    provider: "meta";
    platform: SocialPlatformMetaAdapterPlatform;
    channelType: SocialPlatformMetaAdapterChannelIdentity["channelType"];
    postKind: SocialPlatformMetaAdapterPostKind;
    mediaRefCount: number;
    captionPresent: boolean;
    scheduled: boolean;
    simulatedOnly: true;
  }>;
  diagnostics: readonly SocialPlatformMetaAdapterDiagnostic[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  callsNoExternalApis: true;
  usesNoNetwork: true;
  usesNoOAuth: true;
  usesNoCredentials: true;
  persistsNothing: true;
}>;

export type SocialPlatformMetaAdapterDryRunResult = Readonly<{
  ok: true;
  value: SocialPlatformMetaAdapterDryRunSimulation;
}> | Readonly<{
  ok: false;
  blockedReasons: readonly SocialPlatformMetaAdapterDryRunBlockedReason[];
  diagnostics: readonly SocialPlatformMetaAdapterDiagnostic[];
}>;

export function buildSocialPlatformMetaAdapterDryRunRequest(input: Readonly<{
  requestId: string;
  platform: SocialPlatformMetaAdapterPlatform;
  channel: SocialPlatformMetaAdapterChannelIdentity;
  postKind?: SocialPlatformMetaAdapterPostKind;
  captionText?: string | null;
  mediaRefs?: readonly SocialPlatformMetaAdapterMediaRef[];
  scheduledAt?: string | null;
}>): SocialPlatformMetaAdapterPostRequest {
  const contract = createSocialPlatformMetaAdapterContract(input.platform);
  return {
    requestId: input.requestId,
    adapterId: contract.identity.adapterId,
    channel: input.channel,
    postKind: input.postKind ?? "feed_post",
    captionText: input.captionText ?? null,
    mediaRefs: input.mediaRefs ?? [],
    scheduledAt: input.scheduledAt ?? null,
    contractOnly: true,
    modelAuthorityOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    callsNoExternalApis: true,
    usesNoNetwork: true,
    usesNoOAuth: true,
    usesNoCredentials: true,
  };
}

export function simulateSocialPlatformMetaAdapterDryRun(input: Readonly<{
  platform: SocialPlatformMetaAdapterPlatform;
  request: SocialPlatformMetaAdapterPostRequest;
  preferFactoryDryRun?: boolean;
}>): SocialPlatformMetaAdapterDryRunResult {
  const blockedReasons: SocialPlatformMetaAdapterDryRunBlockedReason[] = [];
  const diagnostics: SocialPlatformMetaAdapterDiagnostic[] = [];
  const missingCapabilities: string[] = [];

  if (!isSocialPlatformAdapterSupportedPlatform(input.platform)) {
    blockedReasons.push("registry_platform_unsupported");
    return { ok: false, blockedReasons, diagnostics };
  }

  const factory = resolveSocialPlatformAdapter({
    platform: input.platform as SocialPlatformAdapterSupportedPlatform,
    preferDryRun: input.preferFactoryDryRun !== false,
  });
  if (!factory.ok) {
    blockedReasons.push("factory_resolution_failed");
    return { ok: false, blockedReasons, diagnostics };
  }
  if (!factory.value.dryRunAvailable && input.preferFactoryDryRun !== false) {
    blockedReasons.push("dry_run_unavailable");
  }

  const metaContract = createSocialPlatformMetaAdapterContract(input.platform);
  const requestValidation = validateSocialPlatformMetaAdapterPostRequest(input.request);
  if (!requestValidation.valid) {
    blockedReasons.push("request_validation_failed");
    diagnostics.push(...requestValidation.diagnostics);
    return { ok: false, blockedReasons, diagnostics };
  }

  const forbidden = detectSocialPlatformMetaAdapterForbiddenStates(metaContract, input.request);
  if (!forbidden.valid) {
    blockedReasons.push("forbidden_state_detected");
    diagnostics.push(...forbidden.diagnostics);
    if (forbidden.diagnostics.some((d) => d.code === "unsupported_channel")) {
      blockedReasons.push("unsupported_channel");
    }
    if (forbidden.diagnostics.some((d) => d.code === "unsupported_post_kind")) {
      blockedReasons.push("unsupported_post_kind");
    }
    if (forbidden.diagnostics.some((d) => d.code === "unsupported_media_kind")) {
      blockedReasons.push("unsupported_media_kind");
    }
    if (forbidden.diagnostics.some((d) => d.code === "media_ref_required")) {
      blockedReasons.push("missing_media_refs");
    }
    return {
      ok: false,
      blockedReasons: uniqueBlockedReasons(blockedReasons),
      diagnostics,
    };
  }

  if (input.request.mediaRefs.length === 0) {
    blockedReasons.push("missing_media_refs");
    return { ok: false, blockedReasons, diagnostics };
  }

  if (!metaContract.capabilities.supportsDryRun) {
    missingCapabilities.push("dry_run");
    blockedReasons.push("missing_capability");
  }
  if (!metaContract.capabilities.supportedPostKinds.includes(input.request.postKind)) {
    missingCapabilities.push(`post_kind:${input.request.postKind}`);
    blockedReasons.push("missing_capability");
  }

  if (blockedReasons.length > 0) {
    return {
      ok: false,
      blockedReasons: uniqueBlockedReasons(blockedReasons),
      diagnostics,
    };
  }

  return {
    ok: true,
    value: deepFreeze({
      dryRunVersion: SOCIAL_PLATFORM_META_ADAPTER_DRY_RUN_VERSION,
      platform: input.platform,
      metaContract,
      factoryAdapterId: factory.value.registryEntry.adapterId,
      factoryDiscoveryKey: factory.value.registryEntry.discoveryKey,
      channelUsed: input.request.channel,
      postKind: input.request.postKind,
      mediaRefsRequired: [...input.request.mediaRefs],
      missingCapabilities,
      blockedReasons: [],
      wouldSendSummary: {
        provider: "meta",
        platform: input.platform,
        channelType: input.request.channel.channelType,
        postKind: input.request.postKind,
        mediaRefCount: input.request.mediaRefs.length,
        captionPresent: input.request.captionText !== null,
        scheduled: input.request.scheduledAt !== null,
        simulatedOnly: true,
      },
      diagnostics,
      computedOnly: true,
      readOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
      callsNoExternalApis: true,
      usesNoNetwork: true,
      usesNoOAuth: true,
      usesNoCredentials: true,
      persistsNothing: true,
    }),
  };
}

function uniqueBlockedReasons(
  reasons: readonly SocialPlatformMetaAdapterDryRunBlockedReason[],
): readonly SocialPlatformMetaAdapterDryRunBlockedReason[] {
  return [...new Set(reasons)];
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return Object.freeze(value);
}
