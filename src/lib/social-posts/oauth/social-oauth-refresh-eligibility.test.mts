import assert from "node:assert/strict";
import test from "node:test";

import { evaluateMetaRefreshEligibility } from "./social-oauth-refresh-eligibility";
import { assessTokenExpiry } from "./social-oauth-token-expiry-domain";
import { resolveSocialOAuthRuntimeConfig } from "./social-oauth-config";
import type { SocialOAuthSessionRow } from "./social-oauth-service";
import type {
  SocialCredentialLifecycleStateRecord,
  SocialCredentialVaultRecordRow,
} from "../credentials/social-credential-repository";

const baseSession = {
  session_id: "oauth-session:test",
  intent_id: "oauth-intent:test",
  provider: "meta",
  publication_target_id: "target-1",
  lifecycle_state: "connected",
  access_credential_ref_id: "cred-ref:meta-access:test",
  refresh_credential_ref_id: null,
  provider_account_id: "meta-account:target-1",
  callback_event_id: "oauth-callback:test",
  admin_actor_id: "admin:test",
  connected_at: "2026-07-05T12:00:00.000Z",
  created_at: "2026-07-05T12:00:00.000Z",
  updated_at: "2026-07-05T12:00:00.000Z",
} as SocialOAuthSessionRow;

const baseVault = {
  vault_record_id: "vault:cred-ref:meta-access:test",
  credential_ref_id: "cred-ref:meta-access:test",
  provider: "meta",
  credential_kind: "oauth_token_ref",
  account_ref_id: "meta:***t-1",
  provider_account_id: "meta-account:target-1",
  publication_target_id: "target-1",
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
} as SocialCredentialVaultRecordRow;

const baseLifecycle = {
  lifecycle_state_id: "lifecycle:test",
  credential_ref_id: "cred-ref:meta-access:test",
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
} as SocialCredentialLifecycleStateRecord;

test("evaluateMetaRefreshEligibility allows fb_exchange_token for valid token", () => {
  const config = {
    ...resolveSocialOAuthRuntimeConfig(),
    oauthEnabled: true,
    metaOAuthEnabled: true,
    metaAppId: "app",
    metaAppSecret: "secret",
    vaultMasterKey: Buffer.alloc(32, 1),
    redirectUriAllowlist: ["https://example.com/callback"],
  };

  const eligibility = evaluateMetaRefreshEligibility({
    config,
    session: baseSession,
    vaultRecord: baseVault,
    lifecycleState: baseLifecycle,
    expiryAssessment: assessTokenExpiry({
      expiresAt: baseLifecycle.expires_at,
      issuedAt: baseLifecycle.issued_at,
    }),
    hasRefreshTokenInVault: false,
  });

  assert.equal(eligibility.eligible, true);
  assert.equal(eligibility.refreshMode, "fb_exchange_token");
});

test("evaluateMetaRefreshEligibility blocks expired token reconnect", () => {
  const config = {
    ...resolveSocialOAuthRuntimeConfig(),
    oauthEnabled: true,
    metaOAuthEnabled: true,
    metaAppId: "app",
    metaAppSecret: "secret",
    vaultMasterKey: Buffer.alloc(32, 1),
    redirectUriAllowlist: ["https://example.com/callback"],
  };

  const eligibility = evaluateMetaRefreshEligibility({
    config,
    session: baseSession,
    vaultRecord: baseVault,
    lifecycleState: {
      ...baseLifecycle,
      expires_at: "2026-07-01T12:00:00.000Z",
    },
    expiryAssessment: assessTokenExpiry({
      expiresAt: "2026-07-01T12:00:00.000Z",
      now: new Date("2026-07-05T12:00:00.000Z"),
    }),
    hasRefreshTokenInVault: false,
  });

  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.blockingReasons.includes("token_expired_requires_reconnect"));
});

console.log("social-oauth-refresh-eligibility tests passed");
