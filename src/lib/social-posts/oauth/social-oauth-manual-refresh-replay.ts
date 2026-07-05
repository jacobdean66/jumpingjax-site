import type { SocialCredentialAuditEventRecord } from "../credentials/social-credential-repository";
import { loadSocialCredentialSnapshot } from "../credentials/social-credential-store";
import { SOCIAL_OAUTH_MANUAL_REFRESH_REQUEST_VERSION } from "./social-oauth-token-refresh-request";
import {
  replaySocialOAuthTokenLifecycle,
  type SocialOAuthTokenLifecycleReplayResult,
} from "./social-oauth-token-lifecycle-replay";

export const SOCIAL_OAUTH_MANUAL_REFRESH_REPLAY_VERSION =
  SOCIAL_OAUTH_MANUAL_REFRESH_REQUEST_VERSION;

export type SocialOAuthManualRefreshAuditEvent = Readonly<{
  auditEventId: string;
  credentialRefId: string;
  action: SocialCredentialAuditEventRecord["action"];
  outcome: SocialCredentialAuditEventRecord["outcome"];
  sanitizedDetail: string;
  createdAt: string;
}>;

export type SocialOAuthManualRefreshTargetStatus = Readonly<{
  publicationTargetId: string;
  manualRefreshEligible: boolean;
  refreshMode: string;
  refreshBlockingReasons: readonly string[];
  expiryState: string;
  lastRefreshAuditAt: string | null;
  lastRefreshOutcome: "success" | "unknown";
}>;

export type SocialOAuthManualRefreshReplaySummary = Readonly<{
  replayVersion: typeof SOCIAL_OAUTH_MANUAL_REFRESH_REPLAY_VERSION;
  manualRefreshEligibleCount: number;
  manualRefreshBlockedCount: number;
  recentRefreshAuditEventCount: number;
  successfulRefreshAuditCount: number;
}>;

export type SocialOAuthManualRefreshReplayDiagnostic = Readonly<{
  code: string;
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
}>;

export type SocialOAuthManualRefreshReplayResult = Readonly<{
  replayVersion: typeof SOCIAL_OAUTH_MANUAL_REFRESH_REPLAY_VERSION;
  summary: SocialOAuthManualRefreshReplaySummary;
  lifecycleReplay: SocialOAuthTokenLifecycleReplayResult;
  manualRefreshTargetStatuses: readonly SocialOAuthManualRefreshTargetStatus[];
  recentRefreshAuditEvents: readonly SocialOAuthManualRefreshAuditEvent[];
  diagnostics: readonly SocialOAuthManualRefreshReplayDiagnostic[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export async function replaySocialOAuthManualRefresh(
  now: Date = new Date(),
): Promise<SocialOAuthManualRefreshReplayResult> {
  const [lifecycleReplay, credentialSnapshot] = await Promise.all([
    replaySocialOAuthTokenLifecycle(now),
    loadSocialCredentialSnapshot(),
  ]);

  const diagnostics: SocialOAuthManualRefreshReplayDiagnostic[] = [];
  const recentRefreshAuditEvents =
    credentialSnapshot.ok
      ? credentialSnapshot.value.audit_events
          .filter((event) => event.sanitized_detail.startsWith("meta_oauth_refresh"))
          .sort((left, right) => right.created_at.localeCompare(left.created_at))
          .slice(0, 20)
          .map((event) => ({
            auditEventId: event.audit_event_id,
            credentialRefId: event.credential_ref_id,
            action: event.action,
            outcome: event.outcome,
            sanitizedDetail: event.sanitized_detail,
            createdAt: event.created_at,
          }))
      : [];

  const auditByCredentialRef = new Map<string, SocialOAuthManualRefreshAuditEvent>();
  for (const event of recentRefreshAuditEvents) {
    if (!auditByCredentialRef.has(event.credentialRefId)) {
      auditByCredentialRef.set(event.credentialRefId, event);
    }
  }

  const manualRefreshTargetStatuses = lifecycleReplay.lifecycleStatuses.map((status) => {
    const lastAudit =
      status.accessCredentialRefId
        ? auditByCredentialRef.get(status.accessCredentialRefId) ?? null
        : null;

    if (status.refreshEligibility.eligible) {
      diagnostics.push({
        code: "manual_refresh_eligible",
        severity: "info",
        path: `d16.w4.manual_refresh.${status.publicationTargetId}`,
        message: `Owner-gated manual refresh is eligible via ${status.refreshEligibility.refreshMode} for ${status.publicationTargetId}.`,
      });
    } else if (status.refreshEligibility.blockingReasons.length > 0) {
      diagnostics.push({
        code: "manual_refresh_blocked",
        severity: "warning",
        path: `d16.w4.manual_refresh.${status.publicationTargetId}`,
        message: `Manual refresh blocked for ${status.publicationTargetId}: ${status.refreshEligibility.blockingReasons.join(", ")}.`,
      });
    }

    return {
      publicationTargetId: status.publicationTargetId,
      manualRefreshEligible: status.refreshEligibility.eligible,
      refreshMode: status.refreshEligibility.refreshMode,
      refreshBlockingReasons: status.refreshEligibility.blockingReasons,
      expiryState: status.expiryAssessment.expiryState,
      lastRefreshAuditAt: lastAudit?.createdAt ?? null,
      lastRefreshOutcome:
        lastAudit?.outcome === "success" ? ("success" as const) : ("unknown" as const),
    } satisfies SocialOAuthManualRefreshTargetStatus;
  });

  const summary: SocialOAuthManualRefreshReplaySummary = {
    replayVersion: SOCIAL_OAUTH_MANUAL_REFRESH_REPLAY_VERSION,
    manualRefreshEligibleCount: manualRefreshTargetStatuses.filter(
      (status) => status.manualRefreshEligible,
    ).length,
    manualRefreshBlockedCount: manualRefreshTargetStatuses.filter(
      (status) => !status.manualRefreshEligible,
    ).length,
    recentRefreshAuditEventCount: recentRefreshAuditEvents.length,
    successfulRefreshAuditCount: recentRefreshAuditEvents.filter(
      (event) => event.outcome === "success",
    ).length,
  };

  return {
    replayVersion: SOCIAL_OAUTH_MANUAL_REFRESH_REPLAY_VERSION,
    summary,
    lifecycleReplay,
    manualRefreshTargetStatuses,
    recentRefreshAuditEvents,
    diagnostics,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}
