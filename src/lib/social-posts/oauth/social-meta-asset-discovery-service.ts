import { randomUUID } from "node:crypto";

import { createServiceRoleClient, isSupabaseServiceConfigured } from "../../supabase/admin";
import {
  createMetaAssetDiscoveryRunId,
  fetchMetaAuthorizedAssets,
} from "./social-meta-asset-discovery-client";
import { loadMetaAccessTokenForPublicationTarget } from "./social-oauth-token-loader";
import {
  isSocialOAuthConnectConfigured,
  resolveSocialOAuthRuntimeConfig,
  type SocialOAuthRuntimeConfig,
} from "./social-oauth-config";
import type { DiscoveredProviderAsset } from "./social-oauth-asset-domain";

export type SocialMetaDiscoveredAssetRow = Readonly<{
  discovered_asset_id: string;
  discovery_run_id: string;
  oauth_session_id: string;
  provider: "meta";
  asset_kind: DiscoveredProviderAsset["assetKind"];
  external_asset_id: string;
  display_name: string;
  parent_external_asset_id: string | null;
  external_asset_id_redacted: string;
  display_name_redacted: string;
  parent_external_asset_id_redacted: string | null;
  publication_target_platform: DiscoveredProviderAsset["publicationTargetPlatform"];
  publication_target_type: DiscoveredProviderAsset["publicationTargetType"];
  created_at: string;
}>;

export type SocialMetaAssetDiscoveryRunRow = Readonly<{
  discovery_run_id: string;
  oauth_session_id: string;
  publication_target_id: string;
  admin_actor_id: string;
  outcome: "success" | "token_unavailable" | "provider_error" | "storage_error";
  page_count: number;
  instagram_count: number;
  error_code_redacted: string | null;
  created_at: string;
}>;

export type SocialMetaAssetDiscoveryResult = Readonly<
  | {
      ok: true;
      discoveryRunId: string;
      assets: readonly DiscoveredProviderAsset[];
      pageCount: number;
      instagramCount: number;
    }
  | { ok: false; code: string; message: string }
>;

export async function discoverMetaAssetsForPublicationTarget(input: {
  publicationTargetId: string;
  adminActorId: string;
  config?: SocialOAuthRuntimeConfig;
}): Promise<SocialMetaAssetDiscoveryResult> {
  const config = input.config ?? resolveSocialOAuthRuntimeConfig();
  if (!isSocialOAuthConnectConfigured(config)) {
    return {
      ok: false,
      code: "oauth_not_configured",
      message: "Meta OAuth connect is not configured or disabled.",
    };
  }

  if (!isSupabaseServiceConfigured()) {
    return {
      ok: false,
      code: "storage_unavailable",
      message: "Meta asset discovery storage is not configured.",
    };
  }

  const tokenResult = await loadMetaAccessTokenForPublicationTarget({
    publicationTargetId: input.publicationTargetId,
    config,
  });
  if (!tokenResult.ok) {
    await recordDiscoveryRun({
      discoveryRunId: createMetaAssetDiscoveryRunId(),
      oauthSessionId: "unknown",
      publicationTargetId: input.publicationTargetId,
      adminActorId: input.adminActorId,
      outcome: "token_unavailable",
      pageCount: 0,
      instagramCount: 0,
      errorCode: tokenResult.code,
    });
    return {
      ok: false,
      code: tokenResult.code,
      message: tokenResult.message,
    };
  }

  const discoveryRunId = createMetaAssetDiscoveryRunId();
  const discovery = await fetchMetaAuthorizedAssets({
    accessToken: tokenResult.accessToken,
    discoveryRunId,
  });

  if (!discovery.ok) {
    await recordDiscoveryRun({
      discoveryRunId,
      oauthSessionId: tokenResult.sessionId,
      publicationTargetId: input.publicationTargetId,
      adminActorId: input.adminActorId,
      outcome: "provider_error",
      pageCount: 0,
      instagramCount: 0,
      errorCode: discovery.errorCode,
    });
    return {
      ok: false,
      code: discovery.errorCode,
      message: discovery.message,
    };
  }

  const persist = await persistDiscoveredAssets({
    discoveryRunId,
    oauthSessionId: tokenResult.sessionId,
    publicationTargetId: input.publicationTargetId,
    adminActorId: input.adminActorId,
    assets: discovery.assets,
    pageCount: discovery.pageCount,
    instagramCount: discovery.instagramCount,
  });

  if (!persist.ok) {
    return persist;
  }

  return {
    ok: true,
    discoveryRunId,
    assets: discovery.assets,
    pageCount: discovery.pageCount,
    instagramCount: discovery.instagramCount,
  };
}

async function persistDiscoveredAssets(input: {
  discoveryRunId: string;
  oauthSessionId: string;
  publicationTargetId: string;
  adminActorId: string;
  assets: readonly DiscoveredProviderAsset[];
  pageCount: number;
  instagramCount: number;
}): Promise<SocialMetaAssetDiscoveryResult> {
  const client = createServiceRoleClient();
  const { error: runError } = await client.from("social_meta_asset_discovery_runs").insert({
    discovery_run_id: input.discoveryRunId,
    oauth_session_id: input.oauthSessionId,
    publication_target_id: input.publicationTargetId,
    admin_actor_id: input.adminActorId,
    outcome: "success",
    page_count: input.pageCount,
    instagram_count: input.instagramCount,
    error_code_redacted: null,
  });

  if (runError) {
    return {
      ok: false,
      code: "discovery_run_persist_failed",
      message: runError.message,
    };
  }

  if (input.assets.length > 0) {
    const { error: assetError } = await client.from("social_meta_discovered_assets").insert(
      input.assets.map((asset) => ({
        discovered_asset_id: asset.discoveredAssetId,
        discovery_run_id: input.discoveryRunId,
        oauth_session_id: input.oauthSessionId,
        provider: asset.provider,
        asset_kind: asset.assetKind,
        external_asset_id: asset.externalAssetId,
        display_name: asset.displayName,
        parent_external_asset_id: asset.parentExternalAssetId,
        external_asset_id_redacted: asset.externalAssetIdRedacted,
        display_name_redacted: asset.displayNameRedacted,
        parent_external_asset_id_redacted: asset.parentExternalAssetIdRedacted,
        publication_target_platform: asset.publicationTargetPlatform,
        publication_target_type: asset.publicationTargetType,
      })),
    );

    if (assetError) {
      return {
        ok: false,
        code: "discovered_assets_persist_failed",
        message: assetError.message,
      };
    }
  }

  return {
    ok: true,
    discoveryRunId: input.discoveryRunId,
    assets: input.assets,
    pageCount: input.pageCount,
    instagramCount: input.instagramCount,
  };
}

async function recordDiscoveryRun(input: {
  discoveryRunId: string;
  oauthSessionId: string;
  publicationTargetId: string;
  adminActorId: string;
  outcome: SocialMetaAssetDiscoveryRunRow["outcome"];
  pageCount: number;
  instagramCount: number;
  errorCode: string;
}): Promise<void> {
  if (!isSupabaseServiceConfigured() || input.oauthSessionId === "unknown") return;

  const client = createServiceRoleClient();
  await client.from("social_meta_asset_discovery_runs").insert({
    discovery_run_id: input.discoveryRunId,
    oauth_session_id: input.oauthSessionId,
    publication_target_id: input.publicationTargetId,
    admin_actor_id: input.adminActorId,
    outcome: input.outcome,
    page_count: input.pageCount,
    instagram_count: input.instagramCount,
    error_code_redacted: input.errorCode,
  });
}

export async function loadSocialMetaAssetPersistenceSnapshot(): Promise<
  Readonly<{
    discoveryRuns: readonly SocialMetaAssetDiscoveryRunRow[];
    discoveredAssets: readonly SocialMetaDiscoveredAssetRow[];
  }>
> {
  if (!isSupabaseServiceConfigured()) {
    return { discoveryRuns: [], discoveredAssets: [] };
  }

  const client = createServiceRoleClient();
  const [discoveryRuns, discoveredAssets] = await Promise.all([
    client
      .from("social_meta_asset_discovery_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("social_meta_discovered_assets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  return {
    discoveryRuns: (discoveryRuns.data ?? []) as SocialMetaAssetDiscoveryRunRow[],
    discoveredAssets: (discoveredAssets.data ?? []) as SocialMetaDiscoveredAssetRow[],
  };
}

export function createMetaBindingId(): string {
  return `meta-binding:${randomUUID()}`;
}
