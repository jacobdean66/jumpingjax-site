import { replaySocialPlatformAdapterCapabilities } from "./social-platform-adapter-capability-replay";
import {
  SOCIAL_PLATFORM_LINKEDIN_ADAPTER_CONTRACTS,
} from "./social-platform-linkedin-adapter";
import { replaySocialPlatformLinkedinAdapter } from "./social-platform-linkedin-adapter-replay";
import {
  SOCIAL_PLATFORM_META_ADAPTER_CONTRACTS,
} from "./social-platform-meta-adapter";
import { replaySocialPlatformMetaAdapter } from "./social-platform-meta-adapter-replay";
import {
  SOCIAL_PLATFORM_TIKTOK_ADAPTER_CONTRACTS,
} from "./social-platform-tiktok-adapter";
import { replaySocialPlatformTiktokAdapter } from "./social-platform-tiktok-adapter-replay";
import { replaySocialPlatformCredentialBoundary } from "./social-platform-credential-boundary-replay";
import {
  defaultAdapterContractIdForPlatform,
  defaultProviderForPlatform,
  evaluatePlatformReadinessDiagnostic,
  evaluatePlatformReadinessGate,
  listReadinessGatePlatforms,
  SOCIAL_PLATFORM_READINESS_GATE_VERSION,
  type SocialPlatformReadinessDiagnostic,
  type SocialPlatformReadinessGateVerdict,
  type SocialPlatformReadinessReason,
} from "./social-platform-readiness-gate";
import {
  getSocialPlatformAdapterRegistrySnapshot,
  type SocialPlatformAdapterSupportedPlatform,
} from "./social-platform-adapter-registry";
import type { SocialPublicationExecutionPersistenceModel } from "./social-publication-execution-repository";

export const SOCIAL_PLATFORM_READINESS_GATE_REPLAY_VERSION = "d11-m14-v1" as const;

export const SOCIAL_PLATFORM_READINESS_GATE_REPLAY_DIAGNOSTIC_CODES = [
  "capability_replay_error",
  "credential_boundary_replay_error",
  "meta_replay_error",
  "tiktok_replay_error",
  "linkedin_replay_error",
  "adapter_contract_missing",
  "provider_contract_missing",
] as const;

export type SocialPlatformReadinessGateReplayDiagnosticCode =
  (typeof SOCIAL_PLATFORM_READINESS_GATE_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPlatformReadinessGateReplayDiagnostic = Readonly<{
  code: SocialPlatformReadinessGateReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPlatformReadinessGateReadModel = Readonly<{
  replayVersion: typeof SOCIAL_PLATFORM_READINESS_GATE_REPLAY_VERSION;
  gateVersion: typeof SOCIAL_PLATFORM_READINESS_GATE_VERSION;
  verdict: SocialPlatformReadinessGateVerdict;
  architecturallyReadyPlatforms: readonly SocialPlatformReadinessDiagnostic[];
  architecturallyBlockedPlatforms: readonly SocialPlatformReadinessDiagnostic[];
  readinessReasons: readonly SocialPlatformReadinessReason[];
  capabilityImpact: Readonly<{
    platformReadyCount: number;
    platformBlockedCount: number;
    dryRunPlatformCount: number;
    credentialBlockedPlatformCount: number;
    metaReadyJobCount: number;
    tiktokReadyJobCount: number;
    linkedinReadyJobCount: number;
    executionCapable: false;
    liveOAuthBlocked: true;
    liveCredentialsBlocked: true;
  }>;
  registryVersion: string;
  diagnostics: readonly SocialPlatformReadinessGateReplayDiagnostic[];
  summary: Readonly<{
    totalPlatformCount: number;
    architecturallyReadyCount: number;
    architecturallyBlockedCount: number;
    allArchitecturallyReady: boolean;
    allExecutionBlocked: true;
    dryRunCapableCount: number;
    credentialBoundaryAwareCount: number;
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
    source: "social_platform_readiness_gate_replay";
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

export type SocialPlatformReadinessGateReplayResult = Readonly<{
  ok: true;
  value: SocialPlatformReadinessGateReadModel;
}>;

const EMPTY_EXECUTION_MODEL: SocialPublicationExecutionPersistenceModel = Object.freeze({
  intents: [],
  results: [],
});

function adapterContractIdForPlatform(
  platform: SocialPlatformAdapterSupportedPlatform,
  diagnostics: SocialPlatformReadinessGateReplayDiagnostic[],
): string | null {
  if (platform === "facebook" || platform === "instagram") {
    const contract = SOCIAL_PLATFORM_META_ADAPTER_CONTRACTS.find((candidate) =>
      candidate.capabilities.supportedPlatforms.includes(platform),
    );
    if (!contract) {
      diagnostics.push({
        code: "adapter_contract_missing",
        path: `platformDiagnostics.${platform}.adapterContract`,
        message: `Meta adapter contract is missing for platform ${platform}.`,
        severity: "warning",
      });
      return null;
    }
    return contract.identity.adapterId;
  }

  if (platform === "tiktok") {
    const contract = SOCIAL_PLATFORM_TIKTOK_ADAPTER_CONTRACTS[0];
    if (!contract) {
      diagnostics.push({
        code: "adapter_contract_missing",
        path: `platformDiagnostics.${platform}.adapterContract`,
        message: "TikTok adapter contract is missing.",
        severity: "warning",
      });
      return null;
    }
    return contract.identity.adapterId;
  }

  const contract = SOCIAL_PLATFORM_LINKEDIN_ADAPTER_CONTRACTS[0];
  if (!contract) {
    diagnostics.push({
      code: "adapter_contract_missing",
      path: `platformDiagnostics.${platform}.adapterContract`,
      message: "LinkedIn adapter contract is missing.",
      severity: "warning",
    });
    return defaultAdapterContractIdForPlatform(platform);
  }
  return contract.identity.adapterId;
}

function buildPlatformGateInput(
  platform: SocialPlatformAdapterSupportedPlatform,
  capabilityReplay: ReturnType<typeof replaySocialPlatformAdapterCapabilities>["value"],
  credentialReplay: ReturnType<typeof replaySocialPlatformCredentialBoundary>["value"],
  diagnostics: SocialPlatformReadinessGateReplayDiagnostic[],
): Parameters<typeof evaluatePlatformReadinessDiagnostic>[0] {
  const capabilityReadiness = capabilityReplay.platformReadiness.find(
    (item) => item.platform === platform,
  );
  const provider = defaultProviderForPlatform(platform);
  const providerReadiness = credentialReplay.providerReadiness.find(
    (item) => item.provider === provider,
  );

  if (!providerReadiness) {
    diagnostics.push({
      code: "provider_contract_missing",
      path: `platformDiagnostics.${platform}.provider`,
      message: `Credential provider readiness is missing for ${provider}.`,
      severity: "warning",
    });
  }

  return {
    platform,
    provider,
    referenceAdapterId: capabilityReadiness?.referenceAdapterId ?? null,
    dryRunAdapterId: capabilityReadiness?.dryRunAdapterId ?? null,
    adapterContractId: adapterContractIdForPlatform(platform, diagnostics),
    credentialContractId: providerReadiness?.credentialContractId ?? null,
    oauthContractId: providerReadiness?.oauthContractId ?? null,
    capabilityModeled: Boolean(
      capabilityReadiness?.supported &&
        capabilityReadiness.adapterRegistered &&
        capabilityReadiness.blockingReasons.length === 0,
    ),
    dryRunAvailable: capabilityReadiness?.dryRunAvailable ?? false,
    platformSupported: capabilityReadiness?.supported ?? false,
    liveOAuthBlocked: providerReadiness?.liveOAuthBlocked ?? true,
    liveCredentialsBlocked: providerReadiness?.liveCredentialsBlocked ?? true,
    authorizationModeled: providerReadiness?.authorizationModeled ?? false,
  };
}

export function replaySocialPlatformReadinessGate(
  model: SocialPublicationExecutionPersistenceModel = EMPTY_EXECUTION_MODEL,
): SocialPlatformReadinessGateReplayResult {
  const diagnostics: SocialPlatformReadinessGateReplayDiagnostic[] = [];
  const registry = getSocialPlatformAdapterRegistrySnapshot();

  const capabilityReplay = replaySocialPlatformAdapterCapabilities(model).value;
  for (const diagnostic of capabilityReplay.diagnostics) {
    if (diagnostic.severity !== "error") continue;
    diagnostics.push({
      code: "capability_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: "warning",
    });
  }

  const credentialReplay = replaySocialPlatformCredentialBoundary(model).value;
  for (const diagnostic of credentialReplay.diagnostics) {
    if (diagnostic.severity !== "error") continue;
    diagnostics.push({
      code: "credential_boundary_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: "warning",
    });
  }

  const metaReplay = replaySocialPlatformMetaAdapter(model).value;
  for (const diagnostic of metaReplay.diagnostics) {
    if (diagnostic.severity !== "error") continue;
    diagnostics.push({
      code: "meta_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: "warning",
    });
  }

  const tiktokReplay = replaySocialPlatformTiktokAdapter(model).value;
  for (const diagnostic of tiktokReplay.diagnostics) {
    if (diagnostic.severity !== "error") continue;
    diagnostics.push({
      code: "tiktok_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: "warning",
    });
  }

  const linkedinReplay = replaySocialPlatformLinkedinAdapter(model).value;
  for (const diagnostic of linkedinReplay.diagnostics) {
    if (diagnostic.severity !== "error") continue;
    diagnostics.push({
      code: "linkedin_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: "warning",
    });
  }

  const gateInputs = listReadinessGatePlatforms().map((platform) =>
    buildPlatformGateInput(platform, capabilityReplay, credentialReplay, diagnostics),
  );
  const verdict = evaluatePlatformReadinessGate(gateInputs);
  const platformDiagnostics = verdict.platforms;

  const architecturallyReadyPlatforms = platformDiagnostics.filter(
    (diagnostic) => diagnostic.state === "architecturally_ready",
  );
  const architecturallyBlockedPlatforms = platformDiagnostics.filter(
    (diagnostic) => diagnostic.state === "architecturally_blocked",
  );
  const readinessReasons = platformDiagnostics.flatMap(
    (diagnostic) => diagnostic.readinessReasons,
  );
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;

  return {
    ok: true,
    value: deepFreeze({
      replayVersion: SOCIAL_PLATFORM_READINESS_GATE_REPLAY_VERSION,
      gateVersion: SOCIAL_PLATFORM_READINESS_GATE_VERSION,
      verdict,
      architecturallyReadyPlatforms,
      architecturallyBlockedPlatforms,
      readinessReasons,
      capabilityImpact: {
        platformReadyCount: capabilityReplay.summary.platformReadyCount,
        platformBlockedCount: capabilityReplay.summary.platformBlockedCount,
        dryRunPlatformCount: capabilityReplay.summary.dryRunPlatformCount,
        credentialBlockedPlatformCount: credentialReplay.capabilityImpact.credentialBlockedPlatformCount,
        metaReadyJobCount: metaReplay.summary.metaReadyJobCount,
        tiktokReadyJobCount: tiktokReplay.summary.tiktokReadyJobCount,
        linkedinReadyJobCount: linkedinReplay.summary.linkedinReadyJobCount,
        executionCapable: false,
        liveOAuthBlocked: true,
        liveCredentialsBlocked: true,
      },
      registryVersion: registry.registryVersion,
      diagnostics,
      summary: {
        totalPlatformCount: platformDiagnostics.length,
        architecturallyReadyCount: verdict.architecturallyReadyCount,
        architecturallyBlockedCount: verdict.architecturallyBlockedCount,
        allArchitecturallyReady: verdict.allArchitecturallyReady,
        allExecutionBlocked: true,
        dryRunCapableCount: platformDiagnostics.filter((item) => item.dryRunCapable).length,
        credentialBoundaryAwareCount: platformDiagnostics.filter(
          (item) => item.credentialBoundaryAware,
        ).length,
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
        source: "social_platform_readiness_gate_replay",
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

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return Object.freeze(value);
}
