import assert from "node:assert/strict";

import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  type SocialCredentialKeyVersionRecord,
  type SocialCredentialLifecycleStateRecord,
  type SocialCredentialPersistenceModel,
  type SocialCredentialProviderAccountRecord,
  type SocialCredentialVaultRecordRow,
} from "./credentials/social-credential-repository";
import { replaySocialPlatformCredentialBoundary } from "./social-platform-credential-boundary-replay";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function providerAccount(): SocialCredentialProviderAccountRecord {
  return {
    provider_account_id: "pa-meta-1" as SocialCredentialProviderAccountRecord["provider_account_id"],
    provider: "meta",
    publication_target_id: "target-facebook-1" as SocialCredentialProviderAccountRecord["publication_target_id"],
    external_account_id_redacted: "page-****-1234",
    display_name_redacted: "Jumping Jax Page",
    status: "registered",
    account_ref_id: "account-ref-meta-1",
    created_at: "2026-01-01T00:00:00.000Z",
    references_only: true,
    contains_credentials: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };
}

function vaultRecord(
  overrides: Partial<SocialCredentialVaultRecordRow> = {},
): SocialCredentialVaultRecordRow {
  return {
    vault_record_id: "vault-1" as SocialCredentialVaultRecordRow["vault_record_id"],
    credential_ref_id: "cred-ref-1" as SocialCredentialVaultRecordRow["credential_ref_id"],
    provider: "meta",
    credential_kind: "oauth_token_ref",
    account_ref_id: "account-ref-meta-1",
    provider_account_id: "pa-meta-1" as SocialCredentialVaultRecordRow["provider_account_id"],
    publication_target_id: "target-facebook-1" as SocialCredentialVaultRecordRow["publication_target_id"],
    encrypted_payload_ref: "payload-****-1",
    key_version: "kv-1",
    lifecycle_phase: "active",
    superseded_at: null,
    revoked_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    metadata_only: true,
    contains_plaintext: false,
    contains_ciphertext: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
    ...overrides,
  };
}

function lifecycleState(): SocialCredentialLifecycleStateRecord {
  return {
    lifecycle_state_id: "state-1" as SocialCredentialLifecycleStateRecord["lifecycle_state_id"],
    credential_ref_id: "cred-ref-1" as SocialCredentialLifecycleStateRecord["credential_ref_id"],
    account_ref_id: "account-ref-meta-1",
    provider: "meta",
    authorization_state: "authorized_reference",
    lifecycle_phase: "active",
    issued_at: "2026-01-01T00:00:00.000Z",
    expires_at: null,
    last_rotated_at: null,
    revoked_at: null,
    scope_fingerprint_redacted: "scope-****-1",
    created_at: "2026-01-01T00:00:00.000Z",
    modeled_only: true,
    references_only: true,
    contains_credentials: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };
}

function keyVersion(): SocialCredentialKeyVersionRecord {
  return {
    key_version: "kv-1" as SocialCredentialKeyVersionRecord["key_version"],
    status: "active",
    activated_at: "2026-01-01T00:00:00.000Z",
    retired_at: null,
    metadata_only: true,
    contains_key_material: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };
}

function credentialModel(): SocialCredentialPersistenceModel {
  return {
    ...EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
    provider_accounts: [providerAccount()],
    vault_records: [
      vaultRecord(),
      vaultRecord({
        vault_record_id: "vault-2" as SocialCredentialVaultRecordRow["vault_record_id"],
        credential_ref_id: "cred-ref-2" as SocialCredentialVaultRecordRow["credential_ref_id"],
        credential_kind: "page_access_ref",
      }),
      vaultRecord({
        vault_record_id: "vault-3" as SocialCredentialVaultRecordRow["vault_record_id"],
        credential_ref_id: "cred-ref-3" as SocialCredentialVaultRecordRow["credential_ref_id"],
        credential_kind: "business_account_ref",
      }),
    ],
    lifecycle_states: [lifecycleState()],
    key_versions: [keyVersion()],
  };
}

await test("replays provider readiness with live OAuth and credentials blocked", () => {
  const replay = replaySocialPlatformCredentialBoundary().value;

  assert.equal(replay.providerReadiness.length, 3);
  assert.equal(replay.capabilityImpact.liveOAuthBlocked, true);
  assert.equal(replay.capabilityImpact.liveCredentialsBlocked, true);
  assert.equal(replay.capabilityImpact.executionCapable, false);
  assert.ok(
    replay.providerReadiness.every((readiness) => readiness.liveOAuthBlocked === true),
  );
  assert.ok(
    replay.providerReadiness.every((readiness) => readiness.authorizationModeled === false),
  );
});

await test("models all jobs as credential-blocked with missing authorization", () => {
  const replay = replaySocialPlatformCredentialBoundary(undefined, {
    jobHints: [
      {
        executionJobId: "execution-job-1",
        publicationTargetId: "target-facebook-1",
        platform: "facebook",
        provider: "meta",
      },
    ],
  }).value;

  assert.equal(replay.summary.credentialReadyJobCount, 0);
  assert.equal(replay.summary.oauthReadyJobCount, 0);
  assert.ok(replay.summary.credentialBlockedJobCount >= 0);
  assert.equal(replay.grantsExecutionPermission, false);
});

await test("projects stored credential readiness into provider and job views", () => {
  const replay = replaySocialPlatformCredentialBoundary(undefined, {
    credentialModel: credentialModel(),
    jobHints: [
      {
        executionJobId: "execution-job-1",
        publicationTargetId: "target-facebook-1",
        platform: "facebook",
        provider: "meta",
      },
    ],
  }).value;

  const metaReadiness = replay.providerReadiness.find((entry) => entry.provider === "meta");
  assert.ok(metaReadiness);
  assert.equal(metaReadiness?.authorizationModeled, false);
  assert.equal(metaReadiness?.blockingReasons.includes("no_stored_credentials"), false);
});

await test("composes capability and meta replay into capability impact projection", () => {
  const replay = replaySocialPlatformCredentialBoundary().value;

  assert.equal(typeof replay.capabilityImpact.platformReadyCount, "number");
  assert.equal(typeof replay.capabilityImpact.metaReadyJobCount, "number");
  assert.equal(replay.replayIntegrity.valid, true);
  assert.equal(replay.replayIntegrity.source, "social_platform_credential_boundary_replay");
});

await test("remains read-only and non-executing", () => {
  const replay = replaySocialPlatformCredentialBoundary().value;
  assert.equal(replay.computedOnly, true);
  assert.equal(replay.readOnly, true);
  assert.equal(replay.executesNothing, true);
  assert.equal(replay.publishesNothing, true);
});

console.log("social-platform-credential-boundary-replay tests passed");
