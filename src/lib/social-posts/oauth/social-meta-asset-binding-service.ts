import { randomUUID } from "node:crypto";

import { createServiceRoleClient, isSupabaseServiceConfigured } from "../../supabase/admin";
import {
  getPublicationTargetById,
  updatePublicationTarget,
} from "../social-publication-target-store";
import {
  publicationTargetTypeMatchesAssetKind,
  validateDiscoveredProviderAsset,
  type DiscoveredProviderAsset,
} from "./social-oauth-asset-domain";
import { createMetaBindingId } from "./social-meta-asset-discovery-service";
import type { SocialMetaDiscoveredAssetRow } from "./social-meta-asset-discovery-service";
import { loadConnectedMetaOAuthSession } from "./social-oauth-token-loader";
import {
  isSocialOAuthConnectConfigured,
  resolveSocialOAuthRuntimeConfig,
  type SocialOAuthRuntimeConfig,
} from "./social-oauth-config";

export type SocialMetaPublicationTargetBindingRow = Readonly<{
  binding_id: string;
  publication_target_id: string;
  oauth_session_id: string;
  discovered_asset_id: string;
  asset_kind: DiscoveredProviderAsset["assetKind"];
  external_asset_id_redacted: string;
  binding_state: "active" | "superseded";
  superseded_at: string | null;
  admin_actor_id: string;
  created_at: string;
}>;

export type SocialMetaBindingAuditEventRow = Readonly<{
  audit_event_id: string;
  binding_id: string;
  publication_target_id: string;
  action: "create" | "supersede" | "rebind";
  outcome: "success" | "validation_failed" | "storage_error";
  sanitized_detail: string;
  admin_actor_id: string;
  created_at: string;
}>;

export type SocialMetaAssetBindingResult = Readonly<
  | {
      ok: true;
      bindingId: string;
      publicationTargetId: string;
      discoveredAssetId: string;
      externalAssetId: string;
      displayName: string;
    }
  | { ok: false; code: string; message: string }
>;

export async function bindDiscoveredMetaAssetToPublicationTarget(input: {
  publicationTargetId: string;
  discoveredAssetId: string;
  adminActorId: string;
  config?: SocialOAuthRuntimeConfig;
}): Promise<SocialMetaAssetBindingResult> {
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
      message: "Meta asset binding storage is not configured.",
    };
  }

  const sessionResult = await loadConnectedMetaOAuthSession(input.publicationTargetId);
  if (!sessionResult.ok) {
    return sessionResult;
  }

  const client = createServiceRoleClient();
  const { data: discoveredRow, error: discoveredError } = await client
    .from("social_meta_discovered_assets")
    .select("*")
    .eq("discovered_asset_id", input.discoveredAssetId)
    .maybeSingle();

  if (discoveredError || !discoveredRow) {
    return {
      ok: false,
      code: "discovered_asset_not_found",
      message: "Discovered asset could not be resolved.",
    };
  }

  const discovered = discoveredRow as SocialMetaDiscoveredAssetRow;

  if (sessionResult.session.session_id !== discovered.oauth_session_id) {
    return {
      ok: false,
      code: "oauth_session_mismatch",
      message: "Discovered asset session does not match the connected OAuth session.",
    };
  }

  const targetResult = await getPublicationTargetById(input.publicationTargetId);
  if (!targetResult.ok) {
    return {
      ok: false,
      code: "publication_target_not_found",
      message: targetResult.error.message,
    };
  }

  const target = targetResult.value;
  const assetKind = discovered.asset_kind;
  if (!publicationTargetTypeMatchesAssetKind(target.targetType, assetKind)) {
    return {
      ok: false,
      code: "asset_target_type_mismatch",
      message: "Discovered asset kind does not match publication target type.",
    };
  }

  const assetCandidate: DiscoveredProviderAsset = {
    discoveredAssetId: input.discoveredAssetId,
    provider: "meta",
    assetKind,
    externalAssetId: discovered.external_asset_id,
    externalAssetIdRedacted: discovered.external_asset_id_redacted,
    displayName: discovered.display_name,
    displayNameRedacted: discovered.display_name_redacted,
    parentExternalAssetId: discovered.parent_external_asset_id,
    parentExternalAssetIdRedacted: discovered.parent_external_asset_id_redacted,
    publicationTargetPlatform: target.platform,
    publicationTargetType: target.targetType,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };

  const assetErrors = validateDiscoveredProviderAsset(assetCandidate);
  if (assetErrors.length > 0) {
    return {
      ok: false,
      code: "asset_validation_failed",
      message: assetErrors.map((error) => error.message).join("; "),
    };
  }

  const bindingId = createMetaBindingId();
  const now = new Date().toISOString();

  const { data: activeBindings, error: activeBindingsError } = await client
    .from("social_meta_publication_target_bindings")
    .select("binding_id")
    .eq("publication_target_id", input.publicationTargetId)
    .eq("binding_state", "active");

  if (activeBindingsError) {
    return {
      ok: false,
      code: "binding_lookup_failed",
      message: activeBindingsError.message,
    };
  }

  if ((activeBindings ?? []).length > 0) {
    const { error: supersedeError } = await client
      .from("social_meta_publication_target_bindings")
      .update({
        binding_state: "superseded",
        superseded_at: now,
      })
      .eq("publication_target_id", input.publicationTargetId)
      .eq("binding_state", "active");

    if (supersedeError) {
      return {
        ok: false,
        code: "binding_supersede_failed",
        message: supersedeError.message,
      };
    }

    for (const priorBinding of activeBindings ?? []) {
      await appendBindingAuditEvent({
        bindingId: priorBinding.binding_id,
        publicationTargetId: input.publicationTargetId,
        action: "supersede",
        outcome: "success",
        sanitizedDetail: "meta_asset_binding_superseded",
        adminActorId: input.adminActorId,
      });
    }
  }

  const { error: bindingError } = await client.from("social_meta_publication_target_bindings").insert({
    binding_id: bindingId,
    publication_target_id: input.publicationTargetId,
    oauth_session_id: discovered.oauth_session_id,
    discovered_asset_id: input.discoveredAssetId,
    asset_kind: assetKind,
    external_asset_id_redacted: discovered.external_asset_id_redacted,
    binding_state: "active",
    superseded_at: null,
    admin_actor_id: input.adminActorId,
  });

  if (bindingError) {
    await appendBindingAuditEvent({
      bindingId,
      publicationTargetId: input.publicationTargetId,
      action: activeBindings?.length ? "rebind" : "create",
      outcome: "storage_error",
      sanitizedDetail: "meta_asset_binding_insert_failed",
      adminActorId: input.adminActorId,
    });
    return {
      ok: false,
      code: "binding_create_failed",
      message: bindingError.message,
    };
  }

  const updateResult = await updatePublicationTarget({
    ...target,
    externalId: discovered.external_asset_id,
    displayName: discovered.display_name,
    updatedAt: now,
    metadata: {
      ...target.metadata,
      metaAssetBinding: {
        bindingId,
        discoveredAssetId: input.discoveredAssetId,
        oauthSessionId: discovered.oauth_session_id,
        assetKind,
        boundAt: now,
      },
    },
  });

  if (!updateResult.ok) {
    await appendBindingAuditEvent({
      bindingId,
      publicationTargetId: input.publicationTargetId,
      action: activeBindings?.length ? "rebind" : "create",
      outcome: "validation_failed",
      sanitizedDetail: "publication_target_update_failed",
      adminActorId: input.adminActorId,
    });
    return {
      ok: false,
      code: "publication_target_update_failed",
      message: updateResult.error.message,
    };
  }

  await appendBindingAuditEvent({
    bindingId,
    publicationTargetId: input.publicationTargetId,
    action: activeBindings?.length ? "rebind" : "create",
    outcome: "success",
    sanitizedDetail: "meta_asset_binding_success",
    adminActorId: input.adminActorId,
  });

  return {
    ok: true,
    bindingId,
    publicationTargetId: input.publicationTargetId,
    discoveredAssetId: input.discoveredAssetId,
    externalAssetId: discovered.external_asset_id,
    displayName: discovered.display_name,
  };
}

async function appendBindingAuditEvent(input: {
  bindingId: string;
  publicationTargetId: string;
  action: SocialMetaBindingAuditEventRow["action"];
  outcome: SocialMetaBindingAuditEventRow["outcome"];
  sanitizedDetail: string;
  adminActorId: string;
}): Promise<void> {
  if (!isSupabaseServiceConfigured()) return;

  const client = createServiceRoleClient();
  await client.from("social_meta_binding_audit_events").insert({
    audit_event_id: `meta-binding-audit:${randomUUID()}`,
    binding_id: input.bindingId,
    publication_target_id: input.publicationTargetId,
    action: input.action,
    outcome: input.outcome,
    sanitized_detail: input.sanitizedDetail,
    admin_actor_id: input.adminActorId,
  });
}

export async function loadSocialMetaBindingPersistenceSnapshot(): Promise<
  Readonly<{
    bindings: readonly SocialMetaPublicationTargetBindingRow[];
    auditEvents: readonly SocialMetaBindingAuditEventRow[];
  }>
> {
  if (!isSupabaseServiceConfigured()) {
    return { bindings: [], auditEvents: [] };
  }

  const client = createServiceRoleClient();
  const [bindings, auditEvents] = await Promise.all([
    client
      .from("social_meta_publication_target_bindings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    client
      .from("social_meta_binding_audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  return {
    bindings: (bindings.data ?? []) as SocialMetaPublicationTargetBindingRow[],
    auditEvents: (auditEvents.data ?? []) as SocialMetaBindingAuditEventRow[],
  };
}
