import { SOCIAL_META_OAUTH_VERSION } from "./social-oauth-config";
import {
  loadSocialOAuthPersistenceSnapshot,
  type SocialOAuthAuthorizationIntentRow,
  type SocialOAuthCallbackEventRow,
  type SocialOAuthSessionRow,
} from "./social-oauth-service";
import {
  isSocialOAuthConnectConfigured,
  resolveSocialOAuthRuntimeConfig,
} from "./social-oauth-config";

export const SOCIAL_OAUTH_CONNECTION_REPLAY_VERSION = SOCIAL_META_OAUTH_VERSION;

export type SocialOAuthConnectionStatus = Readonly<{
  provider: "meta";
  publicationTargetId: string;
  lifecycleState: SocialOAuthSessionRow["lifecycle_state"];
  connected: boolean;
  awaitingCallback: boolean;
  accessCredentialRefId: string | null;
  sessionId: string | null;
  lastCallbackOutcome: SocialOAuthCallbackEventRow["outcome"] | null;
  updatedAt: string | null;
}>;

export type SocialOAuthConnectionReplaySummary = Readonly<{
  replayVersion: typeof SOCIAL_OAUTH_CONNECTION_REPLAY_VERSION;
  oauthConfigured: boolean;
  liveOAuthEnabled: boolean;
  sessionCount: number;
  connectedCount: number;
  awaitingCallbackCount: number;
  failedCount: number;
  intentCount: number;
  callbackEventCount: number;
}>;

export type SocialOAuthConnectionReplayResult = Readonly<{
  replayVersion: typeof SOCIAL_OAUTH_CONNECTION_REPLAY_VERSION;
  summary: SocialOAuthConnectionReplaySummary;
  connectionStatuses: readonly SocialOAuthConnectionStatus[];
  recentIntents: readonly SocialOAuthAuthorizationIntentRow[];
  recentCallbackEvents: readonly SocialOAuthCallbackEventRow[];
  recentSessions: readonly SocialOAuthSessionRow[];
  diagnostics: readonly SocialOAuthConnectionReplayDiagnostic[];
}>;

export type SocialOAuthConnectionReplayDiagnostic = Readonly<{
  code: string;
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
}>;

export async function replaySocialOAuthConnections(): Promise<SocialOAuthConnectionReplayResult> {
  const config = resolveSocialOAuthRuntimeConfig();
  const snapshot = await loadSocialOAuthPersistenceSnapshot();
  const diagnostics: SocialOAuthConnectionReplayDiagnostic[] = [];

  if (!isSocialOAuthConnectConfigured(config)) {
    diagnostics.push({
      code: "oauth_not_configured",
      severity: "warning",
      path: "oauth.runtime",
      message: "Meta OAuth connect is disabled or missing required configuration.",
    });
  }

  const callbackByIntent = new Map<string, SocialOAuthCallbackEventRow>();
  for (const event of snapshot.callbackEvents) {
    if (!callbackByIntent.has(event.intent_id)) {
      callbackByIntent.set(event.intent_id, event);
    }
  }

  const connectionStatuses = snapshot.sessions.map((session) => {
    const lastCallback = callbackByIntent.get(session.intent_id);
    return {
      provider: session.provider,
      publicationTargetId: session.publication_target_id,
      lifecycleState: session.lifecycle_state,
      connected: session.lifecycle_state === "connected",
      awaitingCallback: session.lifecycle_state === "awaiting_callback",
      accessCredentialRefId: session.access_credential_ref_id,
      sessionId: session.session_id,
      lastCallbackOutcome: lastCallback?.outcome ?? null,
      updatedAt: session.updated_at,
    } satisfies SocialOAuthConnectionStatus;
  });

  const summary: SocialOAuthConnectionReplaySummary = {
    replayVersion: SOCIAL_OAUTH_CONNECTION_REPLAY_VERSION,
    oauthConfigured: isSocialOAuthConnectConfigured(config),
    liveOAuthEnabled: config.oauthEnabled && config.metaOAuthEnabled,
    sessionCount: snapshot.sessions.length,
    connectedCount: connectionStatuses.filter((item) => item.connected).length,
    awaitingCallbackCount: connectionStatuses.filter((item) => item.awaitingCallback).length,
    failedCount: connectionStatuses.filter(
      (item) =>
        item.lifecycleState === "failed" ||
        item.lifecycleState === "provider_error" ||
        item.lifecycleState === "state_mismatch",
    ).length,
    intentCount: snapshot.intents.length,
    callbackEventCount: snapshot.callbackEvents.length,
  };

  return {
    replayVersion: SOCIAL_OAUTH_CONNECTION_REPLAY_VERSION,
    summary,
    connectionStatuses,
    recentIntents: snapshot.intents,
    recentCallbackEvents: snapshot.callbackEvents,
    recentSessions: snapshot.sessions,
    diagnostics,
  };
}
