import { randomUUID } from "node:crypto";

import { createSocialCredentialBridge } from "../credentials/social-credential-bridge";
import type {
  SocialCredentialAuditEventRecord,
  SocialCredentialLifecycleStateRecord,
  SocialCredentialProviderAccountRecord,
  SocialCredentialVaultRecordRow,
} from "../credentials/social-credential-repository";
import {
  encryptOAuthSecret,
  serializeOAuthEnvelope,
} from "./social-oauth-credential-envelope";
import {
  type SocialOAuthRuntimeConfig,
} from "./social-oauth-config";
import { redactMetaAccountId } from "./social-meta-oauth-client";

export type SocialOAuthVaultWriteResult = Readonly<
  | {
      ok: true;
      providerAccountId: string;
      accessCredentialRefId: string;
      refreshCredentialRefId: string | null;
      lifecycleStateId: string;
    }
  | { ok: false; code: string; message: string }
>;

export async function persistMetaOAuthTokensToVault(input: {
  publicationTargetId: string;
  accessToken: string;
  expiresInSeconds: number | null;
  adminActorId: string;
  config: SocialOAuthRuntimeConfig;
}): Promise<SocialOAuthVaultWriteResult> {
  if (!input.config.vaultMasterKey) {
    return {
      ok: false,
      code: "vault_key_missing",
      message: "Credential vault master key is not configured.",
    };
  }

  const bridgeResult = createSocialCredentialBridge({ mode: "production" });
  if (!bridgeResult.ok) {
    return {
      ok: false,
      code: "credential_bridge_unavailable",
      message: bridgeResult.error.message,
    };
  }

  const bridge = bridgeResult.value;
  const providerAccountId = `meta-account:${input.publicationTargetId}` as SocialCredentialProviderAccountRecord["provider_account_id"];
  const accountRefId = `meta:${redactMetaAccountId(input.publicationTargetId)}`;
  const accessCredentialRefId = `cred-ref:meta-access:${randomUUID()}` as SocialCredentialVaultRecordRow["credential_ref_id"];
  const lifecycleStateId = `lifecycle:${randomUUID()}` as SocialCredentialLifecycleStateRecord["lifecycle_state_id"];
  const now = new Date();
  const expiresAt =
    input.expiresInSeconds !== null
      ? new Date(now.getTime() + input.expiresInSeconds * 1000).toISOString()
      : null;

  const accessEnvelope = serializeOAuthEnvelope(
    encryptOAuthSecret(input.accessToken, input.config.vaultMasterKey),
  );

  const providerAccount: SocialCredentialProviderAccountRecord = {
    provider_account_id: providerAccountId,
    provider: "meta",
    publication_target_id: input.publicationTargetId as SocialCredentialProviderAccountRecord["publication_target_id"],
    external_account_id_redacted: redactMetaAccountId(input.publicationTargetId),
    display_name_redacted: "Meta connected account",
    status: "registered",
    account_ref_id: accountRefId,
    created_at: now.toISOString(),
    references_only: true,
    contains_credentials: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };

  const accessVaultRecord: SocialCredentialVaultRecordRow = {
    vault_record_id: `vault:${accessCredentialRefId}` as SocialCredentialVaultRecordRow["vault_record_id"],
    credential_ref_id: accessCredentialRefId,
    provider: "meta",
    credential_kind: "oauth_token_ref",
    account_ref_id: accountRefId,
    provider_account_id: providerAccountId,
    publication_target_id: input.publicationTargetId as SocialCredentialVaultRecordRow["publication_target_id"],
    encrypted_payload_ref: accessEnvelope,
    key_version: "vault-master-v1",
    lifecycle_phase: "active",
    superseded_at: null,
    revoked_at: null,
    created_at: now.toISOString(),
    metadata_only: true,
    contains_plaintext: false,
    contains_ciphertext: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };

  const lifecycleState: SocialCredentialLifecycleStateRecord = {
    lifecycle_state_id: lifecycleStateId,
    credential_ref_id: accessCredentialRefId,
    account_ref_id: accountRefId,
    provider: "meta",
    authorization_state: "authorized_reference",
    lifecycle_phase: "active",
    issued_at: now.toISOString(),
    expires_at: expiresAt,
    last_rotated_at: null,
    revoked_at: null,
    scope_fingerprint_redacted: "meta-live-oauth",
    created_at: now.toISOString(),
    modeled_only: true,
    references_only: true,
    contains_credentials: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };

  const auditEvent: SocialCredentialAuditEventRecord = {
    audit_event_id: `audit:${randomUUID()}` as SocialCredentialAuditEventRecord["audit_event_id"],
    credential_ref_id: accessCredentialRefId,
    actor_admin_id: input.adminActorId,
    action: "create",
    outcome: "success",
    sanitized_detail: "meta_oauth_connect_success",
    created_at: now.toISOString(),
    append_only: true,
    contains_secrets: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };

  const accountResult = await bridge.createProviderAccount({ providerAccount });
  if (!accountResult.ok && accountResult.error.code !== "identity_collision") {
    return {
      ok: false,
      code: "provider_account_create_failed",
      message: accountResult.error.message,
    };
  }

  const vaultResult = await bridge.createVaultRecordMetadata({ vaultRecord: accessVaultRecord });
  if (!vaultResult.ok) {
    return {
      ok: false,
      code: "vault_record_create_failed",
      message: vaultResult.error.message,
    };
  }

  const lifecycleResult = await bridge.createLifecycleState({ lifecycleState });
  if (!lifecycleResult.ok) {
    return {
      ok: false,
      code: "lifecycle_create_failed",
      message: lifecycleResult.error.message,
    };
  }

  const auditResult = await bridge.appendAuditEvent({ auditEvent });
  if (!auditResult.ok) {
    return {
      ok: false,
      code: "audit_append_failed",
      message: auditResult.error.message,
    };
  }

  return {
    ok: true,
    providerAccountId,
    accessCredentialRefId,
    refreshCredentialRefId: null,
    lifecycleStateId,
  };
}
