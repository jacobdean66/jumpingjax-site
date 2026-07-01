import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  hydrateSocialPublicationPublisherRowsModel,
  mapSocialPublicationPublisherEvidenceRecordToRow,
  mapSocialPublicationPublisherEvidenceRowToRecord,
  mapSocialPublicationPublisherRequestRecordToRow,
  mapSocialPublicationPublisherRequestRowToRecord,
  mapSocialPublicationPublisherResultRecordToRow,
  mapSocialPublicationPublisherResultRowToRecord,
  mapSocialPublicationPublisherRowsToPersistenceModel,
  serializeSocialPublicationPublisherRowsModel,
  validateSocialPublicationPublisherEvidenceRow,
  validateSocialPublicationPublisherRequestRow,
  validateSocialPublicationPublisherResultRow,
  validateSocialPublicationPublisherRowsModel,
  type SocialPublicationPublisherEvidenceRow,
  type SocialPublicationPublisherRequestRow,
  type SocialPublicationPublisherResultRow,
  type SocialPublicationPublisherRowsModel,
  type SocialPublicationPublisherRowValidationResult,
} from "./social-publication-publisher-rows";
import * as rowExports from "./social-publication-publisher-rows";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

const IDS = {
  request: "10000000-0000-4000-8000-000000000001",
  job: "10000000-0000-4000-8000-000000000002",
  result: "10000000-0000-4000-8000-000000000003",
  evidence: "10000000-0000-4000-8000-000000000004",
  socialPost: "50000000-0000-4000-8000-000000000001",
  target: "60000000-0000-4000-8000-000000000001",
  schedule: "20000000-0000-4000-8000-000000000001",
  ledgerEntry: "30000000-0000-4000-8000-000000000001",
  attempt: "30000000-0000-4000-8000-000000000002",
  ownerApproval: "70000000-0000-4000-8000-000000000001",
  approval: "70000000-0000-4000-8000-000000000002",
  proposal: "70000000-0000-4000-8000-000000000003",
} as const;

function requestRow(
  input: Partial<SocialPublicationPublisherRequestRow> = {},
): SocialPublicationPublisherRequestRow {
  return {
    publisher_request_id: IDS.request,
    publisher_job_id: IDS.job,
    request_type: "prepare_publication_request",
    channel_id: "channel-1",
    channel_platform: "facebook",
    channel_type: "facebook_page",
    social_post_id: IDS.socialPost,
    publication_target_id: IDS.target,
    publication_manifest_id: "manifest-2026-06-30-a",
    schedule_id: IDS.schedule,
    ledger_entry_id: IDS.ledgerEntry,
    publication_attempt_id: IDS.attempt,
    owner_approval_id: IDS.ownerApproval,
    approval_id: IDS.approval,
    proposal_id: IDS.proposal,
    owner_approval_satisfied: true,
    requested_at: "2026-06-30T13:00:00.000Z",
    updated_at: "2026-06-30T13:00:00.000Z",
    recorded_by_actor: "publisher",
    recorded_source: "publication_publisher_domain",
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
    append_only: true,
    immutable: true,
    idempotency_key: "publisher-request-key-1",
    ...input,
  };
}

function resultRow(
  input: Partial<SocialPublicationPublisherResultRow> = {},
): SocialPublicationPublisherResultRow {
  return {
    publisher_result_id: IDS.result,
    publisher_request_id: IDS.request,
    publisher_job_id: IDS.job,
    result_type: "publication_request_prepared",
    result_status: "prepared",
    channel_id: "channel-1",
    channel_platform: "facebook",
    channel_type: "facebook_page",
    social_post_id: IDS.socialPost,
    publication_target_id: IDS.target,
    publication_manifest_id: "manifest-2026-06-30-a",
    schedule_id: IDS.schedule,
    ledger_entry_id: IDS.ledgerEntry,
    publication_attempt_id: IDS.attempt,
    owner_approval_id: IDS.ownerApproval,
    approval_id: IDS.approval,
    proposal_id: IDS.proposal,
    result_code: "prepared_ok",
    error_code: null,
    recorded_at: "2026-06-30T13:05:00.000Z",
    updated_at: "2026-06-30T13:05:00.000Z",
    recorded_by_actor: "publisher",
    recorded_source: "publication_publisher_domain",
    contract_only: true,
    model_authority_only: true,
    references_only: true,
    executes_nothing: true,
    publishes_nothing: true,
    calls_no_external_apis: true,
    uses_no_sdks: true,
    uses_no_network: true,
    persists_nothing: true,
    mutates_no_lower_layers: true,
    current_publish_status_authority: false,
    records_no_metrics: true,
    performs_no_learning: true,
    append_only: true,
    immutable: true,
    idempotency_key: "publisher-result-key-1",
    ...input,
  };
}

function evidenceRow(
  input: Partial<SocialPublicationPublisherEvidenceRow> = {},
): SocialPublicationPublisherEvidenceRow {
  return {
    evidence_id: IDS.evidence,
    publisher_request_id: IDS.request,
    publisher_result_id: null,
    evidence_kind: "authority_check",
    notes: "owner approval confirmed",
    evidence: { checked: true },
    social_post_id: IDS.socialPost,
    publication_target_id: IDS.target,
    publication_manifest_id: "manifest-2026-06-30-a",
    schedule_id: IDS.schedule,
    ledger_entry_id: IDS.ledgerEntry,
    publication_attempt_id: IDS.attempt,
    owner_approval_id: IDS.ownerApproval,
    approval_id: IDS.approval,
    proposal_id: IDS.proposal,
    recorded_at: "2026-06-30T13:00:00.000Z",
    recorded_by_actor: "publisher",
    recorded_source: "publication_publisher_domain",
    contains_full_payload: false,
    contains_full_response: false,
    contains_secrets: false,
    proves_execution: false,
    append_only: true,
    immutable: true,
    idempotency_key: "publisher-evidence-key-1",
    ...input,
  };
}

function rowsModel(
  input: Partial<SocialPublicationPublisherRowsModel> = {},
): SocialPublicationPublisherRowsModel {
  return {
    requests: input.requests ?? [requestRow()],
    results: input.results ?? [resultRow()],
    evidence: input.evidence ?? [evidenceRow()],
  };
}

function assertOk<T>(
  result: { ok: true; value: T } | { ok: false; errors: readonly unknown[] },
): T {
  assert.equal(result.ok, true, JSON.stringify("errors" in result ? result.errors : []));
  return result.value;
}

function codes(result: SocialPublicationPublisherRowValidationResult): string[] {
  return result.ok ? [] : result.errors.map((error) => error.code);
}

await test("valid request row maps to persistence record and back", () => {
  const row = requestRow();
  const record = assertOk(mapSocialPublicationPublisherRequestRowToRecord(row));
  const roundTrip = assertOk(
    mapSocialPublicationPublisherRequestRecordToRow(record, {
      recorded_by_actor: row.recorded_by_actor as never,
      recorded_source: row.recorded_source as never,
      idempotency_key: row.idempotency_key,
    }),
  );

  assert.deepEqual(roundTrip, row);
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(roundTrip), true);
});

await test("valid result row maps to persistence record and back", () => {
  const row = resultRow();
  const record = assertOk(mapSocialPublicationPublisherResultRowToRecord(row));
  const roundTrip = assertOk(
    mapSocialPublicationPublisherResultRecordToRow(record, {
      recorded_by_actor: row.recorded_by_actor as never,
      recorded_source: row.recorded_source as never,
      idempotency_key: row.idempotency_key,
    }),
  );

  assert.deepEqual(roundTrip, row);
});

await test("valid evidence row maps to persistence record and back", () => {
  const row = evidenceRow();
  const record = assertOk(mapSocialPublicationPublisherEvidenceRowToRecord(row));
  const roundTrip = assertOk(
    mapSocialPublicationPublisherEvidenceRecordToRow(record, {
      recorded_by_actor: row.recorded_by_actor as never,
      recorded_source: row.recorded_source as never,
      idempotency_key: row.idempotency_key,
    }),
  );

  assert.deepEqual(roundTrip, row);
});

await test("rows model maps to D9 H16 persistence model", () => {
  const model = assertOk(mapSocialPublicationPublisherRowsToPersistenceModel(rowsModel()));

  assert.equal(model.requests.length, 1);
  assert.equal(model.results.length, 1);
  assert.equal(model.evidence.length, 1);
  assert.equal(model.requests[0]?.scope.publication_manifest_id, "manifest-2026-06-30-a");
});

await test("nullable references are preserved", () => {
  const row = requestRow({
    publication_manifest_id: null,
    schedule_id: null,
    ledger_entry_id: null,
    publication_attempt_id: null,
    owner_approval_id: null,
    approval_id: null,
    proposal_id: null,
  });
  const record = assertOk(mapSocialPublicationPublisherRequestRowToRecord(row));

  assert.equal(record.scope.publication_manifest_id, null);
  assert.equal(record.scope.schedule_id, null);
  assert.equal(record.scope.ledger_entry_id, null);
});

await test("invalid IDs are rejected", () => {
  const result = validateSocialPublicationPublisherRequestRow(
    requestRow({ publisher_request_id: "not-a-uuid", social_post_id: "also-not-a-uuid" }),
  );

  assert.equal(codes(result).includes("identity_invalid"), true);
});

await test("unsupported request type is rejected", () => {
  const result = validateSocialPublicationPublisherRequestRow(
    requestRow({ request_type: "unsupported_request_type" }),
  );

  assert.equal(codes(result).includes("request_type_invalid"), true);
});

await test("unsupported result type and status are rejected", () => {
  const typeResult = validateSocialPublicationPublisherResultRow(
    resultRow({ result_type: "unsupported_result_type" }),
  );
  const statusResult = validateSocialPublicationPublisherResultRow(
    resultRow({ result_status: "unsupported_status" as never }),
  );

  assert.equal(codes(typeResult).includes("result_type_invalid"), true);
  assert.equal(codes(statusResult).includes("result_type_invalid"), true);
});

await test("channel type must match channel platform", () => {
  const result = validateSocialPublicationPublisherRequestRow(
    requestRow({ channel_type: "instagram_business_account", channel_platform: "facebook" }),
  );

  assert.equal(codes(result).includes("channel_invalid"), true);
});

await test("unsupported evidence kind is rejected", () => {
  const result = validateSocialPublicationPublisherEvidenceRow(
    evidenceRow({ evidence_kind: "unsupported_kind" }),
  );

  assert.equal(codes(result).includes("evidence_kind_invalid"), true);
});

await test("contract invariants must remain non-executable", () => {
  const result = validateSocialPublicationPublisherRequestRow(
    requestRow({ executes_nothing: false }),
  );

  assert.equal(codes(result).includes("field_shape_invalid"), true);
});

await test("invalid idempotency keys are rejected", () => {
  const result = validateSocialPublicationPublisherRequestRow(requestRow({ idempotency_key: "" }));

  assert.equal(codes(result).includes("idempotency_key_invalid"), true);
});

await test("identity collisions across scope fields are rejected", () => {
  const result = validateSocialPublicationPublisherRequestRow(
    requestRow({ publication_target_id: IDS.socialPost }),
  );

  assert.equal(codes(result).includes("identity_not_separated"), true);
});

await test("malformed evidence payload shape is rejected", () => {
  const result = validateSocialPublicationPublisherEvidenceRow(
    evidenceRow({ evidence: ["not", "an", "object"] as never }),
  );

  assert.equal(codes(result).includes("summary_shape_invalid"), true);
});

await test("recursive evidence payload is rejected", () => {
  const recursive: Record<string, unknown> = {};
  recursive.self = recursive;
  const result = validateSocialPublicationPublisherEvidenceRow(
    evidenceRow({ evidence: recursive as never }),
  );

  assert.equal(codes(result).includes("unsafe_recursive_state_forbidden"), true);
});

await test("secret and network state in evidence is rejected", () => {
  const secretResult = validateSocialPublicationPublisherEvidenceRow(
    evidenceRow({ evidence: { accessToken: "abc" } }),
  );
  const networkResult = validateSocialPublicationPublisherEvidenceRow(
    evidenceRow({ evidence: { webhook: "https://example.com" } }),
  );

  assert.equal(codes(secretResult).includes("secret_forbidden"), true);
  assert.equal(codes(networkResult).includes("network_forbidden"), true);
});

await test("execution, metrics, and learning state in evidence is rejected", () => {
  const executionResult = validateSocialPublicationPublisherEvidenceRow(
    evidenceRow({ evidence: { publishedAt: "2026-06-30T13:00:00.000Z" } }),
  );
  const metricsResult = validateSocialPublicationPublisherEvidenceRow(
    evidenceRow({ evidence: { impressions: 10 } }),
  );
  const learningResult = validateSocialPublicationPublisherEvidenceRow(
    evidenceRow({ evidence: { campaignMemory: {} } }),
  );

  assert.equal(codes(executionResult).includes("publish_execution_forbidden"), true);
  assert.equal(codes(metricsResult).includes("metrics_state_forbidden"), true);
  assert.equal(codes(learningResult).includes("learning_state_forbidden"), true);
});

await test("lower layer payload state in evidence is rejected", () => {
  const result = validateSocialPublicationPublisherEvidenceRow(
    evidenceRow({ evidence: { manifest: { id: "manifest-1" } } }),
  );

  assert.equal(codes(result).includes("lower_layer_payload_forbidden"), true);
});

await test("result referencing a missing request is rejected at model level", () => {
  const result = validateSocialPublicationPublisherRowsModel(
    rowsModel({ requests: [] }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errors.some((error) => error.code === "relationship_invalid"), true);
  }
});

await test("evidence referencing a missing request is rejected at model level", () => {
  const result = validateSocialPublicationPublisherRowsModel(
    rowsModel({ requests: [], results: [] }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      result.errors.some(
        (error) => error.code === "relationship_invalid" && error.path.startsWith("evidence."),
      ),
      true,
    );
  }
});

await test("duplicate request ids are rejected at model level", () => {
  const result = validateSocialPublicationPublisherRowsModel(
    rowsModel({ requests: [requestRow(), requestRow()], results: [], evidence: [] }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errors.some((error) => error.code === "identity_not_separated"), true);
  }
});

await test("serialize and hydrate round-trip", () => {
  const serialized = serializeSocialPublicationPublisherRowsModel(rowsModel());
  const hydrated = hydrateSocialPublicationPublisherRowsModel(serialized);

  const value = assertOk(hydrated);
  assert.equal(value.requests.length, 1);
  assert.equal(value.results.length, 1);
  assert.equal(value.evidence.length, 1);
  assert.equal(Object.isFrozen(value), true);
});

await test("hydrate rejects invalid JSON", () => {
  const result = hydrateSocialPublicationPublisherRowsModel("not json");

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      result.errors.map((error) => error.code),
      ["serialization_invalid"],
    );
  }
});

await test("rows module has no Supabase, execution, or bridge implementation", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "social-publication-publisher-rows.ts"),
    "utf8",
  );
  const forbiddenFragments = [
    "createServiceRoleClient",
    "@supabase",
    "from(\"",
    "from('",
    "insert(",
    "update(",
    "delete(",
    "select(",
    "next/",
    "react",
    "@/app",
    "app/api",
    "setInterval(",
    "setTimeout(",
    "publishPost(",
    "schedulePost(",
    "facebook.com",
    "instagram.com",
    "graph.facebook",
  ];

  for (const fragment of forbiddenFragments) {
    assert.equal(source.includes(fragment), false, fragment);
  }
});

await test("rows module exposes no repository, bridge, or store factory", () => {
  const forbidden = [
    "createSocialPublicationPublisherRepository",
    "createSocialPublicationPublisherBridge",
    "createSocialPublicationPublisherStore",
    "createServiceRoleClient",
    "publishPost",
    "schedulePublication",
  ];

  for (const name of forbidden) {
    assert.equal(name in rowExports, false, name);
  }
});
