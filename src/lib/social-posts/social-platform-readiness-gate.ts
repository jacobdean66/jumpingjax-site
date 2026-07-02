import {
  SOCIAL_PLATFORM_ADAPTER_SUPPORTED_PLATFORMS,
  type SocialPlatformAdapterPlatform,
  type SocialPlatformAdapterSupportedPlatform,
} from "./social-platform-adapter-registry";
import type { SocialPlatformCredentialProvider } from "./social-platform-credential-boundary";

export const SOCIAL_PLATFORM_READINESS_GATE_VERSION = "d11-m16-v1" as const;

export const SOCIAL_PLATFORM_READINESS_REQUIREMENTS = [
  "architecturally_complete",
  "credential_boundary_aware",
  "capability_modeled",
  "dry_run_capable",
  "execution_blocked",
] as const;

export const SOCIAL_PLATFORM_READINESS_STATES = [
  "architecturally_ready",
  "architecturally_blocked",
] as const;

export const SOCIAL_PLATFORM_READINESS_REASON_CODES = [
  "registry_reference_adapter_missing",
  "registry_dry_run_adapter_missing",
  "adapter_contract_missing",
  "credential_contract_missing",
  "oauth_contract_missing",
  "capability_not_modeled",
  "dry_run_unavailable",
  "platform_unsupported",
  "provider_unresolved",
  "execution_still_blocked",
  "live_oauth_blocked",
  "live_credentials_blocked",
  "authorization_not_modeled",
] as const;

export type SocialPlatformReadinessRequirement =
  (typeof SOCIAL_PLATFORM_READINESS_REQUIREMENTS)[number];

export type SocialPlatformReadinessState =
  (typeof SOCIAL_PLATFORM_READINESS_STATES)[number];

export type SocialPlatformReadinessReasonCode =
  (typeof SOCIAL_PLATFORM_READINESS_REASON_CODES)[number];

export type SocialPlatformReadinessReason = Readonly<{
  code: SocialPlatformReadinessReasonCode;
  requirement: SocialPlatformReadinessRequirement;
  message: string;
  referenceId: string | null;
  satisfied: boolean;
}>;

export type SocialPlatformReadinessGateInput = Readonly<{
  platform: SocialPlatformAdapterSupportedPlatform;
  provider: SocialPlatformCredentialProvider | null;
  referenceAdapterId: string | null;
  dryRunAdapterId: string | null;
  adapterContractId: string | null;
  credentialContractId: string | null;
  oauthContractId: string | null;
  capabilityModeled: boolean;
  dryRunAvailable: boolean;
  platformSupported: boolean;
  liveOAuthBlocked: boolean;
  liveCredentialsBlocked: boolean;
  authorizationModeled: boolean;
}>;

export type SocialPlatformReadinessDiagnostic = Readonly<{
  platform: SocialPlatformAdapterPlatform;
  provider: SocialPlatformCredentialProvider | null;
  state: SocialPlatformReadinessState;
  architecturallyComplete: boolean;
  credentialBoundaryAware: boolean;
  capabilityModeled: boolean;
  dryRunCapable: boolean;
  executionBlocked: true;
  referenceAdapterId: string | null;
  dryRunAdapterId: string | null;
  adapterContractId: string | null;
  credentialContractId: string | null;
  oauthContractId: string | null;
  readinessReasons: readonly SocialPlatformReadinessReason[];
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformReadinessGateVerdict = Readonly<{
  gateVersion: typeof SOCIAL_PLATFORM_READINESS_GATE_VERSION;
  platforms: readonly SocialPlatformReadinessDiagnostic[];
  architecturallyReadyCount: number;
  architecturallyBlockedCount: number;
  allArchitecturallyReady: boolean;
  allExecutionBlocked: true;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

const PLATFORM_PROVIDER: Readonly<
  Record<SocialPlatformAdapterSupportedPlatform, SocialPlatformCredentialProvider>
> = {
  facebook: "meta",
  instagram: "meta",
  tiktok: "tiktok",
  linkedin: "linkedin",
};

const ADAPTER_CONTRACT_IDS: Readonly<
  Record<SocialPlatformAdapterSupportedPlatform, string>
> = {
  facebook: "meta-adapter-facebook-reference",
  instagram: "meta-adapter-instagram-reference",
  tiktok: "tiktok-adapter-reference",
  linkedin: "linkedin-adapter-reference",
};

function reason(
  code: SocialPlatformReadinessReasonCode,
  requirement: SocialPlatformReadinessRequirement,
  message: string,
  referenceId: string | null,
  satisfied: boolean,
): SocialPlatformReadinessReason {
  return { code, requirement, message, referenceId, satisfied };
}

export function evaluatePlatformReadinessDiagnostic(
  input: SocialPlatformReadinessGateInput,
): SocialPlatformReadinessDiagnostic {
  const readinessReasons: SocialPlatformReadinessReason[] = [];
  const blockingReasons: string[] = [];

  const architecturallyComplete =
    input.platformSupported &&
    Boolean(input.referenceAdapterId) &&
    Boolean(input.dryRunAdapterId) &&
    Boolean(input.adapterContractId);

  const hasReferenceAdapter = Boolean(input.referenceAdapterId);
  const hasDryRunAdapter = Boolean(input.dryRunAdapterId);
  const hasAdapterContract = Boolean(input.adapterContractId);

  readinessReasons.push(
    reason(
      hasReferenceAdapter
        ? "execution_still_blocked"
        : "registry_reference_adapter_missing",
      "architecturally_complete",
      hasReferenceAdapter
        ? `Reference adapter registered: ${input.referenceAdapterId}`
        : "Reference adapter is not registered in the platform adapter registry.",
      input.referenceAdapterId,
      hasReferenceAdapter,
    ),
  );
  readinessReasons.push(
    reason(
      hasDryRunAdapter
        ? "execution_still_blocked"
        : "registry_dry_run_adapter_missing",
      "architecturally_complete",
      hasDryRunAdapter
        ? `Dry-run adapter registered: ${input.dryRunAdapterId}`
        : "Dry-run adapter is not registered in the platform adapter registry.",
      input.dryRunAdapterId,
      hasDryRunAdapter,
    ),
  );
  readinessReasons.push(
    reason(
      hasAdapterContract ? "execution_still_blocked" : "adapter_contract_missing",
      "architecturally_complete",
      hasAdapterContract
        ? `Adapter contract resolved: ${input.adapterContractId}`
        : "Platform adapter contract shell is missing.",
      input.adapterContractId,
      hasAdapterContract,
    ),
  );
  if (!input.platformSupported) {
    readinessReasons.push(
      reason(
        "platform_unsupported",
        "architecturally_complete",
        `Platform ${input.platform} is not supported by the adapter registry.`,
        null,
        false,
      ),
    );
    blockingReasons.push("platform_unsupported");
  }

  const credentialBoundaryAware =
    Boolean(input.provider) &&
    Boolean(input.credentialContractId) &&
    Boolean(input.oauthContractId);

  readinessReasons.push(
    reason(
      input.provider ? "execution_still_blocked" : "provider_unresolved",
      "credential_boundary_aware",
      input.provider
        ? `Credential provider resolved: ${input.provider}`
        : "Credential provider could not be resolved for platform.",
      input.provider,
      Boolean(input.provider),
    ),
  );
  readinessReasons.push(
    reason(
      input.credentialContractId
        ? "execution_still_blocked"
        : "credential_contract_missing",
      "credential_boundary_aware",
      input.credentialContractId
        ? `Credential boundary contract resolved: ${input.credentialContractId}`
        : "Credential boundary contract is missing for provider.",
      input.credentialContractId,
      Boolean(input.credentialContractId),
    ),
  );
  readinessReasons.push(
    reason(
      input.oauthContractId ? "execution_still_blocked" : "oauth_contract_missing",
      "credential_boundary_aware",
      input.oauthContractId
        ? `OAuth boundary contract resolved: ${input.oauthContractId}`
        : "OAuth boundary contract is missing for provider.",
      input.oauthContractId,
      Boolean(input.oauthContractId),
    ),
  );
  readinessReasons.push(
    reason(
      "live_oauth_blocked",
      "credential_boundary_aware",
      "Live OAuth remains blocked by design.",
      input.oauthContractId,
      input.liveOAuthBlocked,
    ),
  );
  readinessReasons.push(
    reason(
      "live_credentials_blocked",
      "credential_boundary_aware",
      "Live credentials remain blocked by design.",
      input.credentialContractId,
      input.liveCredentialsBlocked,
    ),
  );
  readinessReasons.push(
    reason(
      "authorization_not_modeled",
      "credential_boundary_aware",
      "Authorization state is reference-only and not modeled with stored credentials.",
      input.credentialContractId,
      !input.authorizationModeled,
    ),
  );

  const capabilityModeled = input.capabilityModeled && input.platformSupported;
  readinessReasons.push(
    reason(
      capabilityModeled ? "execution_still_blocked" : "capability_not_modeled",
      "capability_modeled",
      capabilityModeled
        ? `Capability replay models platform ${input.platform}.`
        : "Capability replay does not model this platform.",
      input.referenceAdapterId,
      capabilityModeled,
    ),
  );

  const dryRunCapable = input.dryRunAvailable && Boolean(input.dryRunAdapterId);
  readinessReasons.push(
    reason(
      dryRunCapable ? "execution_still_blocked" : "dry_run_unavailable",
      "dry_run_capable",
      dryRunCapable
        ? `Dry-run adapter available: ${input.dryRunAdapterId}`
        : "Dry-run adapter is unavailable for this platform.",
      input.dryRunAdapterId,
      dryRunCapable,
    ),
  );

  readinessReasons.push(
    reason(
      "execution_still_blocked",
      "execution_blocked",
      "Real execution remains blocked by design until explicitly approved.",
      null,
      true,
    ),
  );

  if (!architecturallyComplete) blockingReasons.push("architecturally_incomplete");
  if (!credentialBoundaryAware) blockingReasons.push("credential_boundary_incomplete");
  if (!capabilityModeled) blockingReasons.push("capability_not_modeled");
  if (!dryRunCapable) blockingReasons.push("dry_run_unavailable");
  blockingReasons.push("execution_blocked");

  const state: SocialPlatformReadinessState =
    architecturallyComplete &&
    credentialBoundaryAware &&
    capabilityModeled &&
    dryRunCapable
      ? "architecturally_ready"
      : "architecturally_blocked";

  return {
    platform: input.platform,
    provider: input.provider,
    state,
    architecturallyComplete,
    credentialBoundaryAware,
    capabilityModeled,
    dryRunCapable,
    executionBlocked: true,
    referenceAdapterId: input.referenceAdapterId,
    dryRunAdapterId: input.dryRunAdapterId,
    adapterContractId: input.adapterContractId,
    credentialContractId: input.credentialContractId,
    oauthContractId: input.oauthContractId,
    readinessReasons,
    blockingReasons: unique(blockingReasons),
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

export function evaluatePlatformReadinessGate(
  inputs: readonly SocialPlatformReadinessGateInput[],
): SocialPlatformReadinessGateVerdict {
  const platforms = inputs.map((input) => evaluatePlatformReadinessDiagnostic(input));
  const architecturallyReadyCount = platforms.filter(
    (diagnostic) => diagnostic.state === "architecturally_ready",
  ).length;

  return {
    gateVersion: SOCIAL_PLATFORM_READINESS_GATE_VERSION,
    platforms,
    architecturallyReadyCount,
    architecturallyBlockedCount: platforms.length - architecturallyReadyCount,
    allArchitecturallyReady:
      platforms.length > 0 && architecturallyReadyCount === platforms.length,
    allExecutionBlocked: true,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

export function defaultAdapterContractIdForPlatform(
  platform: SocialPlatformAdapterSupportedPlatform,
): string {
  return ADAPTER_CONTRACT_IDS[platform];
}

export function defaultProviderForPlatform(
  platform: SocialPlatformAdapterSupportedPlatform,
): SocialPlatformCredentialProvider {
  return PLATFORM_PROVIDER[platform];
}

export function listReadinessGatePlatforms(): readonly SocialPlatformAdapterSupportedPlatform[] {
  return [...SOCIAL_PLATFORM_ADAPTER_SUPPORTED_PLATFORMS];
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}
