import assert from "node:assert/strict";

import {
  hydrateSocialPublicationExecutionRowsModel,
  mapSocialPublicationExecutionEvidenceRecordToRow,
  mapSocialPublicationExecutionEvidenceRowToRecord,
  mapSocialPublicationExecutionIntentRecordToRow,
  mapSocialPublicationExecutionIntentRowToRecord,
  mapSocialPublicationExecutionResultRecordToRow,
  mapSocialPublicationExecutionResultRowToRecord,
  mapSocialPublicationExecutionRowsToPersistenceModel,
  serializeSocialPublicationExecutionRowsModel,
  validateSocialPublicationExecutionEvidenceRow,
  validateSocialPublicationExecutionIntentRow,
  validateSocialPublicationExecutionResultRow,
  validateSocialPublicationExecutionRowsModel,
  type SocialPublicationExecutionEvidenceRow,
  type SocialPublicationExecutionIntentRow,
  type SocialPublicationExecutionResultRow,
  type SocialPublicationExecutionRowsModel,
} from "./social-publication-execution-rows";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

const IDS = {
  intent: "10000000-0000-4000-8000-000000000001",
  job: "10000000-0000-4000-8000-000000000002",
  result: "10000000-0000-4000-8000-000000000003",
  evidence: "10000000-0000-4000-8000-000000000004",
  socialPost: "50000000-0000-4000-8000-000000000001",
  target: "60000000-0000-4000-8000-000000000001",
  publisherRequest: "40000000-0000-4000-8000-000000000001",
  publisherResult: "40000000-0000-4000-8000-000000000002",
  publisherJob: "40000000-0000-4000-8000-000000000003",
  schedule: "20000000-0000-4000-8000-000000000001",
  ledgerEntry: "30000000-0000-4000-8000-000000000001",
  ownerApproval: "70000000-0000-4000-8000-000000000001",
  approval: "70000000-0000-4000-8000-000000000002",
  metricObservation: "80000000-0000-4000-8000-000000000001",
  campaignMemory: "80000000-0000-4000-8000-000000000002",
  decisionHistory: "80000000-0000-4000-8000-000000000003",
  preflight: "90000000-0000-4000-8000-000000000001",
} as const;

function intentRow(
  input: Partial<SocialPublicationExecutionIntentRow> = {},
): SocialPublicationExecutionIntentRow {
  return {
    execution_intent_id: IDS.intent,
    execution_job_id: IDS.job,
    intent_type: "prepare_execution_intent",
    social_post_id: IDS.socialPost,
    publication_target_id: IDS.target,
    publisher_request_id: IDS.publisherRequest,
    publisher_result_id: IDS.publisherResult,
    publisher_job_id: IDS.publisherJob,
    schedule_id: IDS.schedule,
    ledger_entry_id: IDS.ledgerEntry,
    publication_manifest_id: "manifest-2026-07-01-a",
    owner_approval_id: IDS.ownerApproval,
    approval_id: IDS.approval,
    metric_observation_id: null,
    learning_insight_id: null,
    campaign_memory_id: null,
    decision_history_id: null,
    owner_approval_satisfied: true,
    publisher_authority_satisfied: true,
    preflight_id: IDS.preflight,
    preflight_status: "passed",
    preflight_block_reasons: [],
    preflight_evaluated_at: "2026-07-01T12:00:00.000Z",
    evidence_id: null,
    requested_at: "2026-07-01T12:00:00.000Z",
    updated_at: "2026-07-01T12:00:00.000Z",
    recorded_by_actor: "model",
    recorded_source: "publication_execution_domain",
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
    append_only: true,
    immutable: true,
    idempotency_key: "execution-intent-key-1",
    ...input,
  };
}

function resultRow(
  input: Partial<SocialPublicationExecutionResultRow> = {},
): SocialPublicationExecutionResultRow {
  return {
    execution_result_id: IDS.result,
    execution_intent_id: IDS.intent,
    execution_job_id: IDS.job,
    result_type: "execution_result_recorded",
    result_status: "completed",
    social_post_id: IDS.socialPost,
    publication_target_id: IDS.target,
    publisher_request_id: IDS.publisherRequest,
    publisher_result_id: IDS.publisherResult,
    publisher_job_id: IDS.publisherJob,
    schedule_id: IDS.schedule,
    ledger_entry_id: IDS.ledgerEntry,
    publication_manifest_id: "manifest-2026-07-01-a",
    owner_approval_id: IDS.ownerApproval,
    approval_id: IDS.approval,
    metric_observation_id: null,
    learning_insight_id: null,
    campaign_memory_id: null,
    decision_history_id: null,
    block_reasons: [],
    evidence_id: null,
    recorded_at: "2026-07-01T12:05:00.000Z",
    updated_at: "2026-07-01T12:05:00.000Z",
    recorded_by_actor: "model",
    recorded_source: "publication_execution_domain",
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
    current_execution_status_authority: false,
    records_no_metrics: true,
    performs_no_learning: true,
    grants_execution_permission: false,
    append_only: true,
    immutable: true,
    idempotency_key: "execution-result-key-1",
    ...input,
  };
}

function evidenceRow(
  input: Partial<SocialPublicationExecutionEvidenceRow> = {},
): SocialPublicationExecutionEvidenceRow {
  return {
    evidence_id: IDS.evidence,
    execution_intent_id: IDS.intent,
    execution_result_id: null,
    evidence_kind: "authority_evidence",
    notes: "owner approval and preflight confirmed",
    evidence: { checked: true },
    social_post_id: IDS.socialPost,
    publication_target_id: IDS.target,
    publisher_request_id: IDS.publisherRequest,
    publisher_result_id: IDS.publisherResult,
    publisher_job_id: IDS.publisherJob,
    schedule_id: IDS.schedule,
    ledger_entry_id: IDS.ledgerEntry,
    publication_manifest_id: "manifest-2026-07-01-a",
    owner_approval_id: IDS.ownerApproval,
    approval_id: IDS.approval,
    metric_observation_id: null,
    learning_insight_id: null,
    campaign_memory_id: null,
    decision_history_id: null,
    recorded_at: "2026-07-01T12:00:00.000Z",
    recorded_by_actor: "model",
    recorded_source: "publication_execution_domain",
    contains_full_payload: false,
    contains_secrets: false,
    proves_execution: false,
    append_only: true,
    immutable: true,
    idempotency_key: "execution-evidence-key-1",
    ...input,
  };
}

function assertOk<T>(result: { ok: true; value: T } | { ok: false; errors: readonly unknown[] }): T {
  assert.equal(result.ok, true, JSON.stringify(result.ok ? [] : result.errors));
  return result.value;
}

await test("valid intent, result, and evidence rows pass validation", () => {
  assert.equal(validateSocialPublicationExecutionIntentRow(intentRow()).ok, true);
  assert.equal(validateSocialPublicationExecutionResultRow(resultRow()).ok, true);
  assert.equal(validateSocialPublicationExecutionEvidenceRow(evidenceRow()).ok, true);
});

await test("intent row rejects invalid intent type and malformed identity", () => {
  const invalidType = validateSocialPublicationExecutionIntentRow(
    intentRow({ intent_type: "unknown_intent" }),
  );
  assert.equal(invalidType.ok, false);
  if (!invalidType.ok) {
    assert.ok(invalidType.errors.some((error) => error.code === "intent_type_invalid"));
  }

  const badUuid = validateSocialPublicationExecutionIntentRow(
    intentRow({ execution_intent_id: "not-a-uuid" }),
  );
  assert.equal(badUuid.ok, false);
  if (!badUuid.ok) {
    assert.ok(badUuid.errors.some((error) => error.code === "identity_invalid"));
  }
});

await test("intent row rejects identity collisions between job and scope ids", () => {
  const collision = validateSocialPublicationExecutionIntentRow(
    intentRow({ execution_job_id: IDS.intent }),
  );
  assert.equal(collision.ok, false);
  if (!collision.ok) {
    assert.ok(collision.errors.some((error) => error.code === "identity_not_separated"));
  }
});

await test("result row requires evidence for blocked and failed status", () => {
  const blockedWithoutEvidence = validateSocialPublicationExecutionResultRow(
    resultRow({ result_status: "blocked", block_reasons: ["missing_owner_approval"] }),
  );
  assert.equal(blockedWithoutEvidence.ok, false);
  if (!blockedWithoutEvidence.ok) {
    assert.ok(blockedWithoutEvidence.errors.some((error) => error.code === "required_field_missing"));
  }

  const blockedWithEvidence = validateSocialPublicationExecutionResultRow(
    resultRow({
      result_status: "blocked",
      block_reasons: ["missing_owner_approval"],
      evidence_id: IDS.evidence,
    }),
  );
  assert.equal(blockedWithEvidence.ok, true);
});

await test("result row rejects block reasons on a completed result", () => {
  const invalid = validateSocialPublicationExecutionResultRow(
    resultRow({ result_status: "completed", block_reasons: ["preflight_not_run"] }),
  );
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.ok(invalid.errors.some((error) => error.code === "block_reason_invalid"));
  }
});

await test("result row requires at least one block reason when blocked", () => {
  const invalid = validateSocialPublicationExecutionResultRow(
    resultRow({ result_status: "blocked", block_reasons: [], evidence_id: IDS.evidence }),
  );
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.ok(invalid.errors.some((error) => error.code === "block_reason_invalid"));
  }
});

await test("evidence row rejects an unsafe evidence summary", () => {
  const unsafe = validateSocialPublicationExecutionEvidenceRow(
    evidenceRow({ contains_secrets: true as never }),
  );
  assert.equal(unsafe.ok, false);
});

await test("rows reject forbidden execution and network state", () => {
  const withSecret = validateSocialPublicationExecutionIntentRow({
    ...intentRow(),
    evidence: { token: "leaked" },
  } as never);
  assert.equal(withSecret.ok, false);

  const withNetwork = validateSocialPublicationExecutionEvidenceRow({
    ...evidenceRow(),
    evidence: { fetch: "https://example.com" },
  } as never);
  assert.equal(withNetwork.ok, false);
  if (!withNetwork.ok) {
    assert.ok(withNetwork.errors.some((error) => error.code === "network_forbidden"));
  }

  const withExecutionTrigger = validateSocialPublicationExecutionResultRow({
    ...resultRow(),
    evidence_id: IDS.evidence,
    triggerExecution: true,
  } as never);
  assert.equal(withExecutionTrigger.ok, false);
  if (!withExecutionTrigger.ok) {
    assert.ok(withExecutionTrigger.errors.some((error) => error.code === "execution_trigger_forbidden"));
  }
});

await test("row to record and record to row mapping round-trips", () => {
  const intentRecord = assertOk(mapSocialPublicationExecutionIntentRowToRecord(intentRow()));
  assert.equal(intentRecord.execution_intent_id, IDS.intent);
  assert.equal(intentRecord.scope.social_post_id, IDS.socialPost);

  const rebuiltIntentRow = assertOk(
    mapSocialPublicationExecutionIntentRecordToRow(intentRecord, {
      idempotency_key: "execution-intent-key-1",
    }),
  );
  assert.equal(rebuiltIntentRow.execution_intent_id, IDS.intent);
  assert.equal(rebuiltIntentRow.recorded_by_actor, "model");

  const resultRecord = assertOk(mapSocialPublicationExecutionResultRowToRecord(resultRow()));
  assert.equal(resultRecord.execution_result_id, IDS.result);

  const rebuiltResultRow = assertOk(
    mapSocialPublicationExecutionResultRecordToRow(resultRecord, {
      idempotency_key: "execution-result-key-1",
    }),
  );
  assert.equal(rebuiltResultRow.execution_result_id, IDS.result);

  const evidenceRecord = assertOk(mapSocialPublicationExecutionEvidenceRowToRecord(evidenceRow()));
  assert.equal(evidenceRecord.evidence_id, IDS.evidence);

  const rebuiltEvidenceRow = assertOk(
    mapSocialPublicationExecutionEvidenceRecordToRow(evidenceRecord, {
      idempotency_key: "execution-evidence-key-1",
    }),
  );
  assert.equal(rebuiltEvidenceRow.evidence_id, IDS.evidence);
});

await test("rows model validation enforces relationships and uniqueness", () => {
  const model: SocialPublicationExecutionRowsModel = {
    intents: [intentRow()],
    results: [resultRow()],
    evidence: [evidenceRow()],
  };
  assert.equal(validateSocialPublicationExecutionRowsModel(model).ok, true);

  const duplicateIntents = validateSocialPublicationExecutionRowsModel({
    ...model,
    intents: [intentRow(), intentRow()],
  });
  assert.equal(duplicateIntents.ok, false);
  if (!duplicateIntents.ok) {
    assert.ok(duplicateIntents.errors.some((error) => error.code === "identity_not_separated"));
  }

  const orphanResult = validateSocialPublicationExecutionRowsModel({
    intents: [],
    results: [resultRow()],
    evidence: [],
  });
  assert.equal(orphanResult.ok, false);
  if (!orphanResult.ok) {
    assert.ok(orphanResult.errors.some((error) => error.code === "relationship_invalid"));
  }
});

await test("rows model maps to a persistence model and serializes deterministically", () => {
  const model: SocialPublicationExecutionRowsModel = {
    intents: [intentRow()],
    results: [resultRow()],
    evidence: [evidenceRow()],
  };

  const mapped = assertOk(mapSocialPublicationExecutionRowsToPersistenceModel(model));
  assert.equal(mapped.intents.length, 1);
  assert.equal(mapped.results.length, 1);
  assert.equal(mapped.evidence.length, 1);

  const serialized = serializeSocialPublicationExecutionRowsModel(model);
  const hydrated = assertOk(hydrateSocialPublicationExecutionRowsModel(serialized));
  assert.equal(hydrated.intents.length, 1);
  assert.equal(hydrated.intents[0]?.execution_intent_id, IDS.intent);
});
