import { randomUUID } from "node:crypto";

import { authorizationStateForLifecyclePhase } from "../credentials/social-credential-domain";
import { createSocialCredentialBridge } from "../credentials/social-credential-bridge";
import type {
  SocialCredentialAuditEventRecord,
  SocialCredentialLifecycleStateRecord,
  SocialCredentialVaultRecordRow,
} from "../credentials/social-credential-repository";
import {
  encryptOAuthSecret,
  serializeOAuthEnvelope,
} from "./social-oauth-credential-envelope";
import { type SocialOAuthRuntimeConfig } from "./social-oauth-config";
import { redactMetaAccountId } from "./social-meta-oauth-client";

export type SocialOAuthVaultRotationResult = Readonly<
  | {
      ok: true;
      accessCredentialRefId: string;
      refreshCredentialRefId: string | null;
      lifecycleStateId: string;
      supersededCredentialRefId: string;
    }
  | { ok: false; code: string; message: string }
>;

export async function rotateMetaAccessTokenInVault(input: {
  publicationTargetId: string;
  priorAccessCredentialRefId: SocialCredentialVaultRecordRow["credential_ref_id"];
  priorVaultRecord: SocialCredentialVaultRecordRow;
  priorLifecycleState: SocialCredentialLifecycleStateRecord | null;
  newAccessToken: string;
  expiresInSeconds: number | null;
  newRefreshToken?: string | null;
  adminActorId: string;
  config: SocialOAuthRuntimeConfig;
}): Promise<SocialOAuthVaultRotationResult> {
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
  const now = new Date();
  const nowIso = now.toISOString();
  const accountRefId = input.priorVaultRecord.account_ref_id;
  const providerAccountId = input.priorVaultRecord.provider_account_id;
  const newAccessCredentialRefId =
    `cred-ref:meta-access:${randomUUID()}` as SocialCredentialVaultRecordRow["credential_ref_id"];
  const newLifecycleStateId =
    `lifecycle:${randomUUID()}` as SocialCredentialLifecycleStateRecord["lifecycle_state_id"];
  const expiresAt =
    input.expiresInSeconds !== null
      ? new Date(now.getTime() + input.expiresInSeconds * 1000).toISOString()
      : null;

  const supersededVaultRecord: SocialCredentialVaultRecordRow = {
    ...input.priorVaultRecord,
    lifecycle_phase: "superseded",
    superseded_at: nowIso,
  };

  const supersedeVaultResult = await bridge.updateVaultRecordMetadata({
    vaultRecord: supersededVaultRecord,
  });
  if (!supersedeVaultResult.ok) {
    return {
      ok: false,
      code: "vault_supersede_failed",
      message: supersedeVaultResult.error.message,
    };
  }

  if (input.priorLifecycleState) {
    const supersededLifecycle: SocialCredentialLifecycleStateRecord = {
      ...input.priorLifecycleState,
      lifecycle_phase: "superseded",
      authorization_state: authorizationStateForLifecyclePhase("superseded"),
      revoked_at: input.priorLifecycleState.revoked_at,
    };
    const lifecycleSupersedeResult = await bridge.updateLifecycleState({
      lifecycleState: supersededLifecycle,
    });
    if (!lifecycleSupersedeResult.ok) {
      return {
        ok: false,
        code: "lifecycle_supersede_failed",
        message: lifecycleSupersedeResult.error.message,
      };
    }
  }

  const accessEnvelope = serializeOAuthEnvelope(
    encryptOAuthSecret(input.newAccessToken, input.config.vaultMasterKey),
  );

  const accessVaultRecord: SocialCredentialVaultRecordRow = {
    vault_record_id: `vault:${newAccessCredentialRefId}` as SocialCredentialVaultRecordRow["vault_record_id"],
    credential_ref_id: newAccessCredentialRefId,
    provider: "meta",
    credential_kind: "oauth_token_ref",
    account_ref_id: accountRefId,
    provider_account_id: providerAccountId,
    publication_target_id:
      input.publicationTargetId as SocialCredentialVaultRecordRow["publication_target_id"],
    encrypted_payload_ref: accessEnvelope,
    key_version: "vault-master-v1",
    lifecycle_phase: "active",
    superseded_at: null,
    revoked_at: null,
    created_at: nowIso,
    metadata_only: true,
    contains_plaintext: false,
    contains_ciphertext: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };

  const lifecycleState: SocialCredentialLifecycleStateRecord = {
    lifecycle_state_id: newLifecycleStateId,
    credential_ref_id: newAccessCredentialRefId,
    account_ref_id: accountRefId,
    provider: "meta",
    authorization_state: "authorized_reference",
    lifecycle_phase: "active",
    issued_at: nowIso,
    expires_at: expiresAt,
    last_rotated_at: nowIso,
    revoked_at: null,
    scope_fingerprint_redacted: "meta-live-oauth-refresh",
    created_at: nowIso,
    modeled_only: true,
    references_only: true,
    contains_credentials: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };

  let refreshCredentialRefId: SocialCredentialVaultRecordRow["credential_ref_id"] | null = null;
  if (input.newRefreshToken?.trim()) {
    refreshCredentialRefId =
      `cred-ref:meta-refresh:${randomUUID()}` as SocialCredentialVaultRecordRow["credential_ref_id"];
    const refreshEnvelope = serializeOAuthEnvelope(
      encryptOAuthSecret(input.newRefreshToken, input.config.vaultMasterKey),
    );
    const refreshVaultRecord: SocialCredentialVaultRecordRow = {
      vault_record_id: `vault:${refreshCredentialRefId}` as SocialCredentialVaultRecordRow["vault_record_id"],
      credential_ref_id: refreshCredentialRefId,
      provider: "meta",
      credential_kind: "oauth_refresh_ref",
      account_ref_id: accountRefId,
      provider_account_id: providerAccountId,
      publication_target_id:
        input.publicationTargetId as SocialCredentialVaultRecordRow["publication_target_id"],
      encrypted_payload_ref: refreshEnvelope,
      key_version: "vault-master-v1",
      lifecycle_phase: "active",
      superseded_at: null,
      revoked_at: null,
      created_at: nowIso,
      metadata_only: true,
      contains_plaintext: false,
      contains_ciphertext: false,
      grants_execution_permission: false,
      executes_nothing: true,
      publishes_nothing: true,
    };
    const refreshVaultResult = await bridge.createVaultRecordMetadata({
      vaultRecord: refreshVaultRecord,
    });
    if (!refreshVaultResult.ok) {
      return {
        ok: false,
        code: "refresh_vault_record_create_failed",
        message: refreshVaultResult.error.message,
      };
    }
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

  const supersedeAudit: SocialCredentialAuditEventRecord = {
    audit_event_id: `audit:${randomUUID()}` as SocialCredentialAuditEventRecord["audit_event_id"],
    credential_ref_id: input.priorAccessCredentialRefId,
    actor_admin_id: input.adminActorId,
    action: "rotate",
    outcome: "success",
    sanitized_detail: `meta_oauth_refresh_superseded:${redactMetaAccountId(input.publicationTargetId)}`,
    created_at: nowIso,
    append_only: true,
    contains_secrets: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };

  const rotateAudit: SocialCredentialAuditEventRecord = {
    audit_event_id: `audit:${randomUUID()}` as SocialCredentialAuditEventRecord["audit_event_id"],
    credential_ref_id: newAccessCredentialRefId,
    actor_admin_id: input.adminActorId,
    action: "rotate",
    outcome: "success",
    sanitized_detail: `meta_oauth_refresh_success:${redactMetaAccountId(input.publicationTargetId)}`,
    created_at: nowIso,
    append_only: true,
    contains_secrets: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };

  const supersedeAuditResult = await bridge.appendAuditEvent({ auditEvent: supersedeAudit });
  if (!supersedeAuditResult.ok) {
    return {
      ok: false,
      code: "audit_append_failed",
      message: supersedeAuditResult.error.message,
    };
  }

  const rotateAuditResult = await bridge.appendAuditEvent({ auditEvent: rotateAudit });
  if (!rotateAuditResult.ok) {
    return {
      ok: false,
      code: "audit_append_failed",
      message: rotateAuditResult.error.message,
    };
  }

  return {
    ok: true,
    accessCredentialRefId: newAccessCredentialRefId,
    refreshCredentialRefId,
    lifecycleStateId: newLifecycleStateId,
    supersededCredentialRefId: input.priorAccessCredentialRefId,
  };
}
