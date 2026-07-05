import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  type SocialCredentialLifecycleStateRecord,
  type SocialCredentialVaultRecordRow,
} from "../credentials/social-credential-repository";
import { evaluateTokenLifecyclePreflightForPublicationTarget } from "./social-oauth-token-lifecycle-preflight";

function vaultRecord(
  overrides: Partial<SocialCredentialVaultRecordRow> = {},
): SocialCredentialVaultRecordRow {
  return {
    vault_record_id: "vault:cred-ref:meta-access:test" as SocialCredentialVaultRecordRow["vault_record_id"],
    credential_ref_id: "cred-ref:meta-access:test" as SocialCredentialVaultRecordRow["credential_ref_id"],
    provider: "meta",
    credential_kind: "oauth_token_ref",
    account_ref_id: "meta:***t-1",
    provider_account_id: "meta-account:target-1" as SocialCredentialVaultRecordRow["provider_account_id"],
    publication_target_id: "target-1" as SocialCredentialVaultRecordRow["publication_target_id"],
    encrypted_payload_ref: "envelope",
    key_version: "vault-master-v1",
    lifecycle_phase: "active",
    superseded_at: null,
    revoked_at: null,
    created_at: "2026-07-05T12:00:00.000Z",
    metadata_only: true,
    contains_plaintext: false,
    contains_ciphertext: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
    ...overrides,
  };
}

function lifecycleState(
  overrides: Partial<SocialCredentialLifecycleStateRecord> = {},
): SocialCredentialLifecycleStateRecord {
  return {
    lifecycle_state_id: "lifecycle:test" as SocialCredentialLifecycleStateRecord["lifecycle_state_id"],
    credential_ref_id: "cred-ref:meta-access:test" as SocialCredentialLifecycleStateRecord["credential_ref_id"],
    account_ref_id: "meta:***t-1",
    provider: "meta",
    authorization_state: "authorized_reference",
    lifecycle_phase: "active",
    issued_at: "2026-07-05T12:00:00.000Z",
    expires_at: "2026-07-10T12:00:00.000Z",
    last_rotated_at: null,
    revoked_at: null,
    scope_fingerprint_redacted: "meta-live-oauth",
    created_at: "2026-07-05T12:00:00.000Z",
    modeled_only: true,
    references_only: true,
    contains_credentials: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
    ...overrides,
  };
}

test("evaluateTokenLifecyclePreflightForPublicationTarget returns null without oauth vault record", () => {
  const result = evaluateTokenLifecyclePreflightForPublicationTarget({
    publicationTargetId: "target-1",
    credentialModel: EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  });
  assert.equal(result, null);
});

test("evaluateTokenLifecyclePreflightForPublicationTarget blocks expired token", () => {
  const result = evaluateTokenLifecyclePreflightForPublicationTarget({
    publicationTargetId: "target-1",
    credentialModel: {
      ...EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
      vault_records: [vaultRecord()],
      lifecycle_states: [
        lifecycleState({
          expires_at: "2026-07-01T12:00:00.000Z",
        }),
      ],
    },
    now: new Date("2026-07-05T12:00:00.000Z"),
  });

  assert.ok(result);
  assert.deepEqual(result.preflightBlockingCodes, ["token_expired"]);
  assert.equal(result.blocksExecutionEligibility, true);
});

test("evaluateTokenLifecyclePreflightForPublicationTarget blocks expiring soon token", () => {
  const result = evaluateTokenLifecyclePreflightForPublicationTarget({
    publicationTargetId: "target-1",
    credentialModel: {
      ...EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
      vault_records: [vaultRecord()],
      lifecycle_states: [
        lifecycleState({
          expires_at: "2026-07-05T20:00:00.000Z",
        }),
      ],
    },
    now: new Date("2026-07-05T12:00:00.000Z"),
  });

  assert.ok(result);
  assert.deepEqual(result.preflightBlockingCodes, ["token_expiring_soon"]);
  assert.equal(result.couldRunLater, true);
});

test("evaluateTokenLifecyclePreflightForPublicationTarget blocks unknown expiry", () => {
  const result = evaluateTokenLifecyclePreflightForPublicationTarget({
    publicationTargetId: "target-1",
    credentialModel: {
      ...EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
      vault_records: [vaultRecord()],
      lifecycle_states: [
        lifecycleState({
          expires_at: null,
        }),
      ],
    },
  });

  assert.ok(result);
  assert.deepEqual(result.preflightBlockingCodes, ["token_unknown"]);
});

console.log("social-oauth-token-lifecycle-preflight tests passed");
