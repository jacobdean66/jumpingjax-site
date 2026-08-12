import { randomUUID } from "node:crypto";

import { createSocialCredentialBridge } from "../credentials/social-credential-bridge";
import type {
  SocialCredentialAuditEventRecord,
  SocialCredentialLifecycleStateRecord,
  SocialCredentialProviderAccountRecord,
  SocialCredentialVaultRecordRow,
} from "../credentials/social-credential-repository";
import {
  isSocialCredentialStoreConfigured,
  isSocialCredentialStoreTestDependenciesConfigured,
} from "../credentials/social-credential-store";
import {
  encryptOAuthSecret,
  serializeOAuthEnvelope,
} from "./social-oauth-credential-envelope";
import {
  type SocialOAuthRuntimeConfig,
} from "./social-oauth-config";
import {
  buildMetaPageVaultAccountRefId,
  buildMetaPageVaultProviderAccountId,
  redactMetaAccountId,
} from "./social-meta-oauth-client";

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

export type SocialPageAccessVaultWriteResult = Readonly<
  | {
      ok: true;
      credentialRefId: string;
      pageId: string;
      supersededCount: number;
    }
  | { ok: false; code: string; message: string }
>;

/** True when a vault row is an active Page token for the exact Page identity. */
export function isActiveMetaPageAccessVaultRecordForIdentity(
  prior: SocialCredentialVaultRecordRow,
  identity: Readonly<{
    publicationTargetId: string;
    providerAccountId: string;
    accountRefId: string;
  }>,
): boolean {
  return (
    prior.provider === "meta" &&
    prior.credential_kind === "page_access_ref" &&
    prior.publication_target_id === identity.publicationTargetId &&
    prior.provider_account_id === identity.providerAccountId &&
    prior.account_ref_id === identity.accountRefId &&
    prior.lifecycle_phase === "active" &&
    prior.revoked_at === null &&
    prior.superseded_at === null
  );
}

/**
 * Persist a Meta Page access token using the existing credential vault
 * (`credential_kind: page_access_ref`). Never logs or returns the token.
 */
export async function persistMetaPageAccessTokenToVault(input: {
  publicationTargetId: string;
  pageId: string;
  pageName: string;
  accessToken: string;
  adminActorId: string;
  config: SocialOAuthRuntimeConfig;
}): Promise<SocialPageAccessVaultWriteResult> {
  void input.pageName;
  if (!input.config.vaultMasterKey) {
    return {
      ok: false,
      code: "vault_key_missing",
      message: "Credential vault master key is not configured.",
    };
  }

  const pageId = input.pageId.trim();
  const accessToken = input.accessToken.trim();
  if (!pageId || !accessToken) {
    return {
      ok: false,
      code: "page_token_missing",
      message: "Page id and page access token are required for vault persistence.",
    };
  }

  const bridgeResult = createSocialCredentialBridge({
    mode: "production",
    // Allow injected test storage without requiring live Supabase.
    productionStoreConfigured:
      isSocialCredentialStoreConfigured() ||
      isSocialCredentialStoreTestDependenciesConfigured(),
  });
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
  const providerAccountId =
    buildMetaPageVaultProviderAccountId(input.publicationTargetId, pageId) as SocialCredentialProviderAccountRecord["provider_account_id"];
  // Non-colliding identity (SHA-256 digest). Last-4 redaction is display-only, never vault key.
  const accountRefId = buildMetaPageVaultAccountRefId(pageId);
  const accessCredentialRefId =
    `cred-ref:meta-page-access:${randomUUID()}` as SocialCredentialVaultRecordRow["credential_ref_id"];
  const lifecycleStateId =
    `lifecycle:${randomUUID()}` as SocialCredentialLifecycleStateRecord["lifecycle_state_id"];

  const providerAccount: SocialCredentialProviderAccountRecord = {
    provider_account_id: providerAccountId,
    provider: "meta",
    publication_target_id:
      input.publicationTargetId as SocialCredentialProviderAccountRecord["publication_target_id"],
    external_account_id_redacted: redactMetaAccountId(pageId),
    display_name_redacted: "Meta Facebook Page",
    status: "registered",
    account_ref_id: accountRefId,
    created_at: nowIso,
    references_only: true,
    contains_credentials: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };

  const accessEnvelope = serializeOAuthEnvelope(
    encryptOAuthSecret(accessToken, input.config.vaultMasterKey),
  );

  const accessVaultRecord: SocialCredentialVaultRecordRow = {
    vault_record_id:
      `vault:${accessCredentialRefId}` as SocialCredentialVaultRecordRow["vault_record_id"],
    credential_ref_id: accessCredentialRefId,
    provider: "meta",
    credential_kind: "page_access_ref",
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
    lifecycle_state_id: lifecycleStateId,
    credential_ref_id: accessCredentialRefId,
    account_ref_id: accountRefId,
    provider: "meta",
    authorization_state: "authorized_reference",
    lifecycle_phase: "active",
    issued_at: nowIso,
    expires_at: null,
    last_rotated_at: null,
    revoked_at: null,
    scope_fingerprint_redacted: `meta-page-access:${redactMetaAccountId(pageId)}`,
    created_at: nowIso,
    modeled_only: true,
    references_only: true,
    contains_credentials: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };

  const auditEvent: SocialCredentialAuditEventRecord = {
    audit_event_id:
      `audit:${randomUUID()}` as SocialCredentialAuditEventRecord["audit_event_id"],
    credential_ref_id: accessCredentialRefId,
    actor_admin_id: input.adminActorId,
    action: "create",
    outcome: "success",
    sanitized_detail: `meta_page_access_vaulted:${redactMetaAccountId(pageId)}`,
    created_at: nowIso,
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

  // Supersede prior active page_access_ref rows for this exact page identity only.
  const listResult = await bridge.listVaultRecordMetadata();
  let supersededCount = 0;
  if (listResult.ok) {
    const pageIdentity = {
      publicationTargetId: input.publicationTargetId,
      providerAccountId,
      accountRefId,
    };
    for (const prior of listResult.value) {
      if (!isActiveMetaPageAccessVaultRecordForIdentity(prior, pageIdentity)) {
        continue;
      }
      const superseded: SocialCredentialVaultRecordRow = {
        ...prior,
        lifecycle_phase: "superseded",
        superseded_at: nowIso,
      };
      const updateResult = await bridge.updateVaultRecordMetadata({
        vaultRecord: superseded,
      });
      if (updateResult.ok) {
        supersededCount += 1;
      }
    }
  }

  const vaultResult = await bridge.createVaultRecordMetadata({
    vaultRecord: accessVaultRecord,
  });
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
    credentialRefId: accessCredentialRefId,
    pageId,
    supersededCount,
  };
}
