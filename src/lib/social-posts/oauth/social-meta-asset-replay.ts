import { SOCIAL_META_ASSET_DISCOVERY_VERSION } from "./social-oauth-asset-domain";
import {
  loadSocialMetaAssetPersistenceSnapshot,
  type SocialMetaAssetDiscoveryRunRow,
  type SocialMetaDiscoveredAssetRow,
} from "./social-meta-asset-discovery-service";
import {
  loadSocialMetaBindingPersistenceSnapshot,
  type SocialMetaBindingAuditEventRow,
  type SocialMetaPublicationTargetBindingRow,
} from "./social-meta-asset-binding-service";
import { loadSocialOAuthPersistenceSnapshot } from "./social-oauth-service";
import {
  isSocialOAuthConnectConfigured,
  resolveSocialOAuthRuntimeConfig,
} from "./social-oauth-config";

export const SOCIAL_META_ASSET_REPLAY_VERSION = SOCIAL_META_ASSET_DISCOVERY_VERSION;

export type SocialMetaAssetBindingStatus = Readonly<{
  publicationTargetId: string;
  bindingId: string | null;
  discoveredAssetId: string | null;
  assetKind: SocialMetaPublicationTargetBindingRow["asset_kind"] | null;
  bindingState: SocialMetaPublicationTargetBindingRow["binding_state"] | null;
  externalAssetIdRedacted: string | null;
  oauthSessionId: string | null;
  connected: boolean;
  bound: boolean;
  updatedAt: string | null;
}>;

export type SocialMetaAssetReplaySummary = Readonly<{
  replayVersion: typeof SOCIAL_META_ASSET_REPLAY_VERSION;
  oauthConfigured: boolean;
  connectedSessionCount: number;
  discoveryRunCount: number;
  discoveredAssetCount: number;
  facebookPageCount: number;
  instagramAccountCount: number;
  activeBindingCount: number;
  supersededBindingCount: number;
  bindingAuditEventCount: number;
  boundTargetCount: number;
  unboundConnectedTargetCount: number;
}>;

export type SocialMetaAssetReplayDiagnostic = Readonly<{
  code: string;
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
}>;

export type SocialMetaAssetReplayResult = Readonly<{
  replayVersion: typeof SOCIAL_META_ASSET_REPLAY_VERSION;
  summary: SocialMetaAssetReplaySummary;
  connectedSessions: readonly {
    sessionId: string;
    publicationTargetId: string;
    accessCredentialRefId: string | null;
    updatedAt: string | null;
  }[];
  recentDiscoveryRuns: readonly SocialMetaAssetDiscoveryRunRow[];
  discoveredAssets: readonly SocialMetaDiscoveredAssetRow[];
  bindingStatuses: readonly SocialMetaAssetBindingStatus[];
  activeBindings: readonly SocialMetaPublicationTargetBindingRow[];
  recentBindingAuditEvents: readonly SocialMetaBindingAuditEventRow[];
  diagnostics: readonly SocialMetaAssetReplayDiagnostic[];
}>;

export async function replaySocialMetaAssetBindings(): Promise<SocialMetaAssetReplayResult> {
  const config = resolveSocialOAuthRuntimeConfig();
  const [oauthSnapshot, assetSnapshot, bindingSnapshot] = await Promise.all([
    loadSocialOAuthPersistenceSnapshot(),
    loadSocialMetaAssetPersistenceSnapshot(),
    loadSocialMetaBindingPersistenceSnapshot(),
  ]);

  const diagnostics: SocialMetaAssetReplayDiagnostic[] = [];
  if (!isSocialOAuthConnectConfigured(config)) {
    diagnostics.push({
      code: "oauth_not_configured",
      severity: "warning",
      path: "d16.w2.oauth.runtime",
      message: "Meta OAuth connect is not fully configured for asset discovery.",
    });
  }

  const connectedSessions = oauthSnapshot.sessions
    .filter((session) => session.lifecycle_state === "connected")
    .map((session) => ({
      sessionId: session.session_id,
      publicationTargetId: session.publication_target_id,
      accessCredentialRefId: session.access_credential_ref_id,
      updatedAt: session.updated_at,
    }));

  const activeBindings = bindingSnapshot.bindings.filter(
    (binding) => binding.binding_state === "active",
  );
  const activeBindingByTarget = new Map(
    activeBindings.map((binding) => [binding.publication_target_id, binding]),
  );

  const bindingStatuses = connectedSessions.map((session) => {
    const binding = activeBindingByTarget.get(session.publicationTargetId) ?? null;
    return {
      publicationTargetId: session.publicationTargetId,
      bindingId: binding?.binding_id ?? null,
      discoveredAssetId: binding?.discovered_asset_id ?? null,
      assetKind: binding?.asset_kind ?? null,
      bindingState: binding?.binding_state ?? null,
      externalAssetIdRedacted: binding?.external_asset_id_redacted ?? null,
      oauthSessionId: session.sessionId,
      connected: true,
      bound: Boolean(binding),
      updatedAt: binding?.created_at ?? session.updatedAt,
    } satisfies SocialMetaAssetBindingStatus;
  });

  for (const status of bindingStatuses) {
    if (!status.bound) {
      diagnostics.push({
        code: "meta_asset_not_bound",
        severity: "warning",
        path: `d16.w2.bindings.${status.publicationTargetId}`,
        message: `Connected Meta OAuth session exists but no active asset binding for ${status.publicationTargetId}.`,
      });
    } else {
      diagnostics.push({
        code: "meta_asset_bound",
        severity: "info",
        path: `d16.w2.bindings.${status.publicationTargetId}`,
        message: `Publication target ${status.publicationTargetId} is bound to a discovered Meta asset.`,
      });
    }
  }

  const facebookPageCount = assetSnapshot.discoveredAssets.filter(
    (asset) => asset.asset_kind === "facebook_page",
  ).length;
  const instagramAccountCount = assetSnapshot.discoveredAssets.filter(
    (asset) => asset.asset_kind === "instagram_business_account",
  ).length;

  return {
    replayVersion: SOCIAL_META_ASSET_REPLAY_VERSION,
    summary: {
      replayVersion: SOCIAL_META_ASSET_REPLAY_VERSION,
      oauthConfigured: isSocialOAuthConnectConfigured(config),
      connectedSessionCount: connectedSessions.length,
      discoveryRunCount: assetSnapshot.discoveryRuns.length,
      discoveredAssetCount: assetSnapshot.discoveredAssets.length,
      facebookPageCount,
      instagramAccountCount,
      activeBindingCount: activeBindings.length,
      supersededBindingCount: bindingSnapshot.bindings.filter(
        (binding) => binding.binding_state === "superseded",
      ).length,
      bindingAuditEventCount: bindingSnapshot.auditEvents.length,
      boundTargetCount: bindingStatuses.filter((status) => status.bound).length,
      unboundConnectedTargetCount: bindingStatuses.filter((status) => !status.bound).length,
    },
    connectedSessions,
    recentDiscoveryRuns: assetSnapshot.discoveryRuns,
    discoveredAssets: assetSnapshot.discoveredAssets,
    bindingStatuses,
    activeBindings,
    recentBindingAuditEvents: bindingSnapshot.auditEvents,
    diagnostics,
  };
}
