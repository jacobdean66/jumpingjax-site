import type { SocialOAuthConnectionReplayResult } from "./social-oauth-connection-replay";

export const SOCIAL_OAUTH_ORCHESTRATION_INTEGRATION_VERSION = "d16-w1-v1" as const;

export type SocialOAuthOrchestrationDiagnostic = Readonly<{
  code: string;
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
}>;

export function buildSocialOAuthOrchestrationDiagnostics(
  oauthReplay: SocialOAuthConnectionReplayResult,
  publicationTargetIds: readonly string[],
): readonly SocialOAuthOrchestrationDiagnostic[] {
  const diagnostics: SocialOAuthOrchestrationDiagnostic[] = [];
  const statusesByTarget = new Map(
    oauthReplay.connectionStatuses.map((status) => [status.publicationTargetId, status]),
  );

  if (!oauthReplay.summary.oauthConfigured) {
    diagnostics.push({
      code: "live_oauth_not_configured",
      severity: "warning",
      path: "d16.oauth.runtime",
      message:
        "Live Meta OAuth connect is not fully configured; D13/D15 modeled paths remain diagnostic-only.",
    });
  }

  const uniqueTargets = [...new Set(publicationTargetIds.filter((targetId) => targetId.trim()))];
  for (const publicationTargetId of uniqueTargets) {
    const status = statusesByTarget.get(publicationTargetId);
    if (!status) {
      diagnostics.push({
        code: "meta_oauth_not_connected",
        severity: "warning",
        path: `d16.oauth.targets.${publicationTargetId}`,
        message: `No live Meta OAuth session recorded for publication target ${publicationTargetId}.`,
      });
      continue;
    }

    if (status.connected) {
      diagnostics.push({
        code: "meta_oauth_connected",
        severity: "info",
        path: `d16.oauth.targets.${publicationTargetId}`,
        message: `Live Meta OAuth connection is active for publication target ${publicationTargetId}.`,
      });
      continue;
    }

    if (status.awaitingCallback) {
      diagnostics.push({
        code: "meta_oauth_awaiting_callback",
        severity: "warning",
        path: `d16.oauth.targets.${publicationTargetId}`,
        message: `Meta OAuth session for ${publicationTargetId} is awaiting owner callback completion.`,
      });
      continue;
    }

    diagnostics.push({
      code: "meta_oauth_not_connected",
      severity: "warning",
      path: `d16.oauth.targets.${publicationTargetId}`,
      message: `Meta OAuth session for ${publicationTargetId} is in lifecycle state ${status.lifecycleState}.`,
    });
  }

  return diagnostics;
}
