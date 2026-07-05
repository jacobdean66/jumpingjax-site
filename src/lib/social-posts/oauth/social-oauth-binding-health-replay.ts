import {
  SOCIAL_OAUTH_TOKEN_LIFECYCLE_VERSION,
} from "./social-oauth-token-expiry-domain";
import { replaySocialMetaAssetBindings, type SocialMetaAssetBindingStatus } from "./social-meta-asset-replay";
import {
  replaySocialOAuthTokenLifecycle,
  type SocialOAuthTokenLifecycleStatus,
} from "./social-oauth-token-lifecycle-replay";

export const SOCIAL_OAUTH_BINDING_HEALTH_REPLAY_VERSION =
  SOCIAL_OAUTH_TOKEN_LIFECYCLE_VERSION;

export type SocialOAuthBindingHealthStatus = Readonly<{
  publicationTargetId: string;
  connected: boolean;
  bound: boolean;
  bindingState: SocialMetaAssetBindingStatus["bindingState"];
  assetKind: SocialMetaAssetBindingStatus["assetKind"];
  expiryState: SocialOAuthTokenLifecycleStatus["expiryAssessment"]["expiryState"];
  refreshEligible: boolean;
  healthState:
    | "healthy"
    | "binding_missing"
    | "token_expired"
    | "token_expiring"
    | "token_unknown"
    | "refresh_blocked"
    | "not_connected";
  blockingReasons: readonly string[];
}>;

export type SocialOAuthBindingHealthReplaySummary = Readonly<{
  replayVersion: typeof SOCIAL_OAUTH_BINDING_HEALTH_REPLAY_VERSION;
  healthyCount: number;
  bindingMissingCount: number;
  tokenExpiredCount: number;
  tokenExpiringCount: number;
  tokenUnknownCount: number;
  refreshBlockedCount: number;
  notConnectedCount: number;
}>;

export type SocialOAuthBindingHealthReplayDiagnostic = Readonly<{
  code: string;
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
}>;

export type SocialOAuthBindingHealthReplayResult = Readonly<{
  replayVersion: typeof SOCIAL_OAUTH_BINDING_HEALTH_REPLAY_VERSION;
  summary: SocialOAuthBindingHealthReplaySummary;
  bindingHealthStatuses: readonly SocialOAuthBindingHealthStatus[];
  diagnostics: readonly SocialOAuthBindingHealthReplayDiagnostic[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export async function replaySocialOAuthBindingHealth(
  now: Date = new Date(),
): Promise<SocialOAuthBindingHealthReplayResult> {
  const [bindingReplay, lifecycleReplay] = await Promise.all([
    replaySocialMetaAssetBindings(),
    replaySocialOAuthTokenLifecycle(now),
  ]);

  const lifecycleByTarget = new Map(
    lifecycleReplay.lifecycleStatuses.map((status) => [status.publicationTargetId, status]),
  );

  const bindingHealthStatuses: SocialOAuthBindingHealthStatus[] = [];
  const diagnostics: SocialOAuthBindingHealthReplayDiagnostic[] = [];

  const targetIds = new Set<string>([
    ...bindingReplay.bindingStatuses.map((status) => status.publicationTargetId),
    ...lifecycleReplay.lifecycleStatuses.map((status) => status.publicationTargetId),
  ]);

  for (const publicationTargetId of targetIds) {
    const binding =
      bindingReplay.bindingStatuses.find(
        (status) => status.publicationTargetId === publicationTargetId,
      ) ?? null;
    const lifecycle = lifecycleByTarget.get(publicationTargetId) ?? null;

    const connected = Boolean(binding?.connected ?? lifecycle?.connected);
    const bound = Boolean(binding?.bound);
    const expiryState = lifecycle?.expiryAssessment.expiryState ?? "unknown";
    const refreshEligible = lifecycle?.refreshEligibility.eligible ?? false;

    const blockingReasons: string[] = [];
    if (!connected) {
      blockingReasons.push("oauth_not_connected");
    }
    if (connected && !bound) {
      blockingReasons.push("binding_missing");
    }
    blockingReasons.push(...(lifecycle?.tokenBlockingReasons ?? []));

    let healthState: SocialOAuthBindingHealthStatus["healthState"] = "healthy";
    if (!connected) {
      healthState = "not_connected";
    } else if (!bound) {
      healthState = "binding_missing";
    } else if (expiryState === "expired") {
      healthState = "token_expired";
    } else if (expiryState === "expiring_soon") {
      healthState = "token_expiring";
    } else if (expiryState === "unknown") {
      healthState = "token_unknown";
    } else if (!refreshEligible && (lifecycle?.refreshEligibility.blockingReasons.length ?? 0) > 0) {
      healthState = "refresh_blocked";
    }

    const diagnosticCode = `binding_health_${healthState}`;
    diagnostics.push({
      code: diagnosticCode,
      severity:
        healthState === "healthy"
          ? "info"
          : healthState === "token_expiring" || healthState === "token_unknown"
            ? "warning"
            : "error",
      path: `d16.w3.binding_health.${publicationTargetId}`,
      message: describeBindingHealth(publicationTargetId, healthState, blockingReasons),
    });

    bindingHealthStatuses.push({
      publicationTargetId,
      connected,
      bound,
      bindingState: binding?.bindingState ?? null,
      assetKind: binding?.assetKind ?? null,
      expiryState,
      refreshEligible,
      healthState,
      blockingReasons,
    });
  }

  const summary: SocialOAuthBindingHealthReplaySummary = {
    replayVersion: SOCIAL_OAUTH_BINDING_HEALTH_REPLAY_VERSION,
    healthyCount: bindingHealthStatuses.filter((status) => status.healthState === "healthy").length,
    bindingMissingCount: bindingHealthStatuses.filter(
      (status) => status.healthState === "binding_missing",
    ).length,
    tokenExpiredCount: bindingHealthStatuses.filter(
      (status) => status.healthState === "token_expired",
    ).length,
    tokenExpiringCount: bindingHealthStatuses.filter(
      (status) => status.healthState === "token_expiring",
    ).length,
    tokenUnknownCount: bindingHealthStatuses.filter(
      (status) => status.healthState === "token_unknown",
    ).length,
    refreshBlockedCount: bindingHealthStatuses.filter(
      (status) => status.healthState === "refresh_blocked",
    ).length,
    notConnectedCount: bindingHealthStatuses.filter(
      (status) => status.healthState === "not_connected",
    ).length,
  };

  return {
    replayVersion: SOCIAL_OAUTH_BINDING_HEALTH_REPLAY_VERSION,
    summary,
    bindingHealthStatuses,
    diagnostics,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function describeBindingHealth(
  publicationTargetId: string,
  healthState: SocialOAuthBindingHealthStatus["healthState"],
  blockingReasons: readonly string[],
): string {
  const reasonSuffix =
    blockingReasons.length > 0 ? ` (${blockingReasons.join(", ")})` : "";
  switch (healthState) {
    case "healthy":
      return `Publication target ${publicationTargetId} has connected OAuth, active binding, and valid token lifecycle.`;
    case "binding_missing":
      return `Publication target ${publicationTargetId} is connected but missing an active Meta asset binding${reasonSuffix}.`;
    case "token_expired":
      return `Publication target ${publicationTargetId} binding exists but access token is expired${reasonSuffix}.`;
    case "token_expiring":
      return `Publication target ${publicationTargetId} binding exists but access token is expiring soon${reasonSuffix}.`;
    case "token_unknown":
      return `Publication target ${publicationTargetId} binding exists but token expiry is unknown${reasonSuffix}.`;
    case "refresh_blocked":
      return `Publication target ${publicationTargetId} binding exists but controlled refresh is blocked${reasonSuffix}.`;
    case "not_connected":
      return `Publication target ${publicationTargetId} has no connected Meta OAuth session${reasonSuffix}.`;
  }
}
