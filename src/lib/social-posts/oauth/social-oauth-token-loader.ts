import { loadSocialCredentialSnapshot } from "../credentials/social-credential-store";
import { createServiceRoleClient, isSupabaseServiceConfigured } from "../../supabase/admin";
import {
  decryptOAuthSecret,
  hydrateOAuthEnvelope,
} from "./social-oauth-credential-envelope";
import {
  resolveSocialOAuthRuntimeConfig,
  type SocialOAuthRuntimeConfig,
} from "./social-oauth-config";
import type { SocialOAuthSessionRow } from "./social-oauth-service";

export type MetaAccessTokenLoadResult = Readonly<
  | {
      ok: true;
      accessToken: string;
      sessionId: string;
      credentialRefId: string;
      session: SocialOAuthSessionRow;
    }
  | { ok: false; code: string; message: string }
>;

export async function loadConnectedMetaOAuthSession(
  publicationTargetId: string,
): Promise<Readonly<{ ok: true; session: SocialOAuthSessionRow } | { ok: false; code: string; message: string }>> {
  if (!isSupabaseServiceConfigured()) {
    return {
      ok: false,
      code: "storage_unavailable",
      message: "OAuth session storage is not configured.",
    };
  }

  const client = createServiceRoleClient();
  const { data, error } = await client
    .from("social_oauth_sessions")
    .select("*")
    .eq("publication_target_id", publicationTargetId)
    .eq("provider", "meta")
    .eq("lifecycle_state", "connected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      code: "oauth_session_not_connected",
      message: "No connected Meta OAuth session exists for this publication target.",
    };
  }

  return { ok: true, session: data as SocialOAuthSessionRow };
}

export async function loadMetaAccessTokenForPublicationTarget(input: {
  publicationTargetId: string;
  config?: SocialOAuthRuntimeConfig;
}): Promise<MetaAccessTokenLoadResult> {
  const config = input.config ?? resolveSocialOAuthRuntimeConfig();
  if (!config.vaultMasterKey) {
    return {
      ok: false,
      code: "vault_key_missing",
      message: "Credential vault master key is not configured.",
    };
  }

  const sessionResult = await loadConnectedMetaOAuthSession(input.publicationTargetId);
  if (!sessionResult.ok) {
    return sessionResult;
  }

  const session = sessionResult.session;
  if (!session.access_credential_ref_id?.trim()) {
    return {
      ok: false,
      code: "credential_ref_missing",
      message: "Connected OAuth session is missing an access credential reference.",
    };
  }

  const snapshotResult = await loadSocialCredentialSnapshot();
  if (!snapshotResult.ok) {
    return {
      ok: false,
      code: "credential_snapshot_unavailable",
      message: snapshotResult.error.message,
    };
  }

  const vaultRecord = snapshotResult.value.vault_records.find(
    (record) =>
      record.credential_ref_id === session.access_credential_ref_id &&
      record.provider === "meta" &&
      record.lifecycle_phase === "active" &&
      record.revoked_at === null &&
      record.superseded_at === null,
  );

  if (!vaultRecord?.encrypted_payload_ref?.trim()) {
    return {
      ok: false,
      code: "vault_record_missing",
      message: "Active Meta vault record could not be resolved for this session.",
    };
  }

  try {
    const accessToken = decryptOAuthSecret(
      hydrateOAuthEnvelope(vaultRecord.encrypted_payload_ref),
      config.vaultMasterKey,
    );
    if (!accessToken.trim()) {
      return {
        ok: false,
        code: "token_decrypt_empty",
        message: "Decrypted Meta access token was empty.",
      };
    }

    return {
      ok: true,
      accessToken,
      sessionId: session.session_id,
      credentialRefId: session.access_credential_ref_id,
      session,
    };
  } catch {
    return {
      ok: false,
      code: "token_decrypt_failed",
      message: "Meta access token could not be decrypted.",
    };
  }
}
