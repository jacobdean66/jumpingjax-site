import assert from "node:assert/strict";
import test from "node:test";

import {
  configureSocialExecutionAuthorizationOwnerApprovalVerificationTestDependencies,
  verifyOwnerApprovalForExecutionAuthorization,
} from "./social-execution-authorization-owner-approval";
import type { SocialPublicationExecutionIntentRecord } from "../social-publication-execution-repository";

function sampleIntent(
  overrides: Partial<SocialPublicationExecutionIntentRecord> = {},
): SocialPublicationExecutionIntentRecord {
  return {
    execution_intent_id: "execution-intent-1" as SocialPublicationExecutionIntentRecord["execution_intent_id"],
    execution_job_id: "execution-job-1" as SocialPublicationExecutionIntentRecord["execution_job_id"],
    intent_type: "prepare_execution_intent",
    scope: {
      social_post_id: "post-1" as SocialPublicationExecutionIntentRecord["scope"]["social_post_id"],
      publication_target_id: "target-1" as SocialPublicationExecutionIntentRecord["scope"]["publication_target_id"],
      publisher_request_id: null,
      publisher_result_id: null,
      publisher_job_id: null,
      schedule_id: null,
      ledger_entry_id: null,
      publication_manifest_id: null,
      owner_approval_id: "owner-approval-1" as SocialPublicationExecutionIntentRecord["scope"]["owner_approval_id"],
      approval_id: null,
      metric_observation_id: null,
      learning_insight_id: null,
      campaign_memory_id: null,
      decision_history_id: null,
    },
    owner_approval_satisfied: true,
    publisher_authority_satisfied: true,
    preflight_id: null,
    preflight_status: null,
    preflight_block_reasons: [],
    preflight_evaluated_at: null,
    evidence_id: null,
    requested_at: "2026-07-05T12:00:00.000Z",
    updated_at: "2026-07-05T12:00:00.000Z",
    contract_only: true,
    model_authority_only: true,
    references_only: true,
    executes_nothing: true,
    publishes_nothing: true,
    calls_no_external_apis: true,
    uses_no_sdks: true,
    uses_no_network: true,
    starts_no_workers: true,
    starts_no_timers: true,
    creates_no_queues: true,
    exposes_no_api_routes: true,
    exposes_no_admin_ui: true,
    mutates_no_sql: true,
    mutates_no_storage: true,
    mutates_no_lower_layers: true,
    records_no_metrics: true,
    performs_no_learning: true,
    grants_execution_permission: false,
    ...overrides,
  };
}

test("verifyOwnerApprovalForExecutionAuthorization passes aligned scope", async () => {
  configureSocialExecutionAuthorizationOwnerApprovalVerificationTestDependencies({
    verifyApproved: async () => ({ ok: true }),
    loadOwnerApprovalProposal: async () => ({
      ok: true,
      value: { socialPostId: "post-1", approvalId: "owner-approval-1" },
    }),
    loadExecutionIntent: async () => ({ ok: true, value: sampleIntent() }),
  });

  const result = await verifyOwnerApprovalForExecutionAuthorization({
    ownerApprovalId: "owner-approval-1",
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    socialPostId: "post-1",
    approvalId: "owner-approval-1",
  });

  assert.equal(result.ok, true);
  configureSocialExecutionAuthorizationOwnerApprovalVerificationTestDependencies(null);
});

test("verifyOwnerApprovalForExecutionAuthorization blocks unapproved owner approval", async () => {
  configureSocialExecutionAuthorizationOwnerApprovalVerificationTestDependencies({
    verifyApproved: async () => ({
      ok: false,
      code: "owner_approval_not_approved",
      message: "Owner approval must be in approved state before execution authorization.",
    }),
    loadOwnerApprovalProposal: async () => ({
      ok: true,
      value: { socialPostId: "post-1", approvalId: "owner-approval-1" },
    }),
    loadExecutionIntent: async () => ({ ok: true, value: null }),
  });

  const result = await verifyOwnerApprovalForExecutionAuthorization({
    ownerApprovalId: "owner-approval-1",
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    socialPostId: null,
    approvalId: null,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "owner_approval_not_approved");
  }
  configureSocialExecutionAuthorizationOwnerApprovalVerificationTestDependencies(null);
});

test("verifyOwnerApprovalForExecutionAuthorization blocks execution intent scope mismatch", async () => {
  configureSocialExecutionAuthorizationOwnerApprovalVerificationTestDependencies({
    verifyApproved: async () => ({ ok: true }),
    loadOwnerApprovalProposal: async () => ({
      ok: true,
      value: { socialPostId: "post-1", approvalId: "owner-approval-1" },
    }),
    loadExecutionIntent: async () => ({
      ok: true,
      value: sampleIntent({
        scope: {
          ...sampleIntent().scope,
          publication_target_id: "target-2" as SocialPublicationExecutionIntentRecord["scope"]["publication_target_id"],
        },
      }),
    }),
  });

  const result = await verifyOwnerApprovalForExecutionAuthorization({
    ownerApprovalId: "owner-approval-1",
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    socialPostId: null,
    approvalId: null,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "execution_intent_scope_mismatch");
  }
  configureSocialExecutionAuthorizationOwnerApprovalVerificationTestDependencies(null);
});
