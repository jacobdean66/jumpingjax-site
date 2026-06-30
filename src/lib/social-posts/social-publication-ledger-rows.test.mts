import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  hydrateSocialPublicationLedgerRowsModel,
  mapSocialPublicationLedgerAttemptRecordToRow,
  mapSocialPublicationLedgerAttemptRowToRecord,
  mapSocialPublicationLedgerEvidenceRecordToRow,
  mapSocialPublicationLedgerEvidenceRowToRecord,
  mapSocialPublicationLedgerOutcomeRecordToRow,
  mapSocialPublicationLedgerOutcomeRowToRecord,
  mapSocialPublicationLedgerRowsToPersistenceModel,
  serializeSocialPublicationLedgerRowsModel,
  validateSocialPublicationLedgerAttemptRow,
  validateSocialPublicationLedgerEvidenceRow,
  validateSocialPublicationLedgerOutcomeRow,
  validateSocialPublicationLedgerRowsModel,
  type SocialPublicationLedgerAttemptRow,
  type SocialPublicationLedgerEvidenceRow,
  type SocialPublicationLedgerOutcomeRow,
  type SocialPublicationLedgerRowValidationResult,
  type SocialPublicationLedgerRowsModel,
} from "./social-publication-ledger-rows";
import * as rowExports from "./social-publication-ledger-rows";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

const IDS = {
  ledgerAttempt: "10000000-0000-4000-8000-000000000001",
  ledgerOutcome: "10000000-0000-4000-8000-000000000002",
  ledgerEvidence: "10000000-0000-4000-8000-000000000003",
  attempt: "20000000-0000-4000-8000-000000000001",
  outcome: "30000000-0000-4000-8000-000000000001",
  evidence: "40000000-0000-4000-8000-000000000001",
  socialPost: "50000000-0000-4000-8000-000000000001",
  target: "60000000-0000-4000-8000-000000000001",
  ownerApproval: "70000000-0000-4000-8000-000000000001",
  approval: "70000000-0000-4000-8000-000000000002",
  proposal: "70000000-0000-4000-8000-000000000003",
} as const;

function attemptRow(
  input: Partial<SocialPublicationLedgerAttemptRow> = {},
): SocialPublicationLedgerAttemptRow {
  return {
    ledger_entry_id: IDS.ledgerAttempt,
    publication_attempt_id: IDS.attempt,
    attempt_sequence: 0,
    event_type: "publication_attempt_started",
    social_post_id: IDS.socialPost,
    publication_target_id: IDS.target,
    publication_manifest_id: "manifest-2026-06-30-a",
    owner_approval_id: IDS.ownerApproval,
    approval_id: IDS.approval,
    proposal_id: IDS.proposal,
    request_summary: {
      requestId: "request-1",
      operation: "create_post",
      mediaKind: "image",
      payloadSummary: {
        captionLength: 120,
        mediaCount: 1,
      },
      containsFullPayload: false,
      containsSecrets: false,
    },
    recorded_at: "2026-06-30T13:00:00.000Z",
    recorded_by_actor: "system",
    recorded_source: "publication_ledger_domain",
    append_only: true,
    immutable: true,
    idempotency_key: "attempt-key-1",
    ...input,
  };
}

function outcomeRow(
  input: Partial<SocialPublicationLedgerOutcomeRow> = {},
): SocialPublicationLedgerOutcomeRow {
  return {
    ledger_entry_id: IDS.ledgerOutcome,
    outcome_id: IDS.outcome,
    publication_attempt_id: IDS.attempt,
    attempt_sequence: 0,
    event_type: "publication_attempt_succeeded",
    social_post_id: IDS.socialPost,
    publication_target_id: IDS.target,
    publication_manifest_id: "manifest-2026-06-30-a",
    owner_approval_id: IDS.ownerApproval,
    approval_id: IDS.approval,
    proposal_id: IDS.proposal,
    result_summary: {
      externalPublicationId: "facebook-post-1",
      externalUrl: "https://example.com/post/1",
      resultCode: "ok",
      message: "Published.",
      responseSummary: {
        accepted: true,
      },
      containsFullResponse: false,
      containsSecrets: false,
    },
    error_summary: null,
    recorded_at: "2026-06-30T13:01:00.000Z",
    recorded_by_actor: "publisher",
    recorded_source: "future_publisher",
    append_only: true,
    immutable: true,
    idempotency_key: "outcome-key-1",
    ...input,
  };
}

function evidenceRow(
  input: Partial<SocialPublicationLedgerEvidenceRow> = {},
): SocialPublicationLedgerEvidenceRow {
  return {
    evidence_id: IDS.evidence,
    ledger_entry_id: IDS.ledgerEvidence,
    publication_attempt_id: IDS.attempt,
    outcome_id: IDS.outcome,
    social_post_id: IDS.socialPost,
    publication_target_id: IDS.target,
    publication_manifest_id: "manifest-2026-06-30-a",
    owner_approval_id: IDS.ownerApproval,
    approval_id: IDS.approval,
    proposal_id: IDS.proposal,
    evidence_summary: {
      evidenceKind: "result_summary",
      notes: "Sanitized publication result.",
      externalReference: "facebook-post-1",
      evidence: {
        accepted: true,
      },
      containsFullPayload: false,
      containsFullResponse: false,
      containsSecrets: false,
    },
    recorded_at: "2026-06-30T13:01:01.000Z",
    recorded_by_actor: "publisher",
    recorded_source: "future_publisher",
    append_only: true,
    immutable: true,
    idempotency_key: "evidence-key-1",
    ...input,
  };
}

function rows(input: Partial<SocialPublicationLedgerRowsModel> = {}): SocialPublicationLedgerRowsModel {
  return {
    attempts: input.attempts ?? [attemptRow()],
    outcomes: input.outcomes ?? [outcomeRow()],
    evidence: input.evidence ?? [evidenceRow()],
  };
}

function assertOk<T>(result: { ok: true; value: T } | { ok: false; errors: readonly unknown[] }): T {
  assert.equal(result.ok, true, JSON.stringify("errors" in result ? result.errors : []));
  return result.value;
}

function codes(result: SocialPublicationLedgerRowValidationResult): string[] {
  return result.ok ? [] : result.errors.map((error) => error.code);
}

await test("valid attempt row maps to persistence record and back", () => {
  const row = attemptRow();
  const record = assertOk(mapSocialPublicationLedgerAttemptRowToRecord(row));
  const roundTrip = assertOk(
    mapSocialPublicationLedgerAttemptRecordToRow(record, {
      idempotency_key: row.idempotency_key,
    }),
  );

  assert.deepEqual(roundTrip, row);
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(roundTrip), true);
});

await test("valid outcome row maps to persistence record and back", () => {
  const row = outcomeRow();
  const record = assertOk(mapSocialPublicationLedgerOutcomeRowToRecord(row));
  const roundTrip = assertOk(
    mapSocialPublicationLedgerOutcomeRecordToRow(record, {
      idempotency_key: row.idempotency_key,
    }),
  );

  assert.deepEqual(roundTrip, row);
});

await test("valid evidence row maps to persistence record and back", () => {
  const row = evidenceRow();
  const record = assertOk(mapSocialPublicationLedgerEvidenceRowToRecord(row));
  const roundTrip = assertOk(
    mapSocialPublicationLedgerEvidenceRecordToRow(record, {
      idempotency_key: row.idempotency_key,
    }),
  );

  assert.deepEqual(roundTrip, row);
});

await test("rows model maps to D8 persistence model", () => {
  const model = assertOk(mapSocialPublicationLedgerRowsToPersistenceModel(rows()));

  assert.equal(model.attempts.length, 1);
  assert.equal(model.outcomes.length, 1);
  assert.equal(model.evidence.length, 1);
  assert.equal(model.attempts[0]?.scope.publication_manifest_id, "manifest-2026-06-30-a");
});

await test("nullable approval references are preserved", () => {
  const row = attemptRow({
    owner_approval_id: null,
    approval_id: null,
    proposal_id: null,
  });
  const record = assertOk(mapSocialPublicationLedgerAttemptRowToRecord(row));
  const roundTrip = assertOk(mapSocialPublicationLedgerAttemptRecordToRow(record));

  assert.equal(record.scope.owner_approval_id, null);
  assert.equal(roundTrip.owner_approval_id, null);
  assert.equal(roundTrip.idempotency_key, null);
});

await test("invalid IDs are rejected", () => {
  const result = validateSocialPublicationLedgerAttemptRow(
    attemptRow({
      ledger_entry_id: "not-a-uuid",
      publication_attempt_id: "",
      social_post_id: "also-not-a-uuid",
    }),
  );

  assert.equal(codes(result).includes("identity_invalid"), true);
  assert.equal(codes(result).includes("required_field_missing"), true);
});

await test("missing manifest identity is rejected", () => {
  const result = validateSocialPublicationLedgerOutcomeRow(
    outcomeRow({
      publication_manifest_id: "",
    }),
  );

  assert.equal(codes(result).includes("required_field_missing"), true);
});

await test("invalid scope is rejected at model level", () => {
  const result = validateSocialPublicationLedgerRowsModel(
    rows({
      outcomes: [
        outcomeRow({
          publication_target_id: "60000000-0000-4000-8000-000000000002",
        }),
      ],
    }),
  );

  assert.equal(codes(result).includes("scope_mismatch"), true);
});

await test("invalid event families are rejected", () => {
  const attemptResult = validateSocialPublicationLedgerAttemptRow(
    attemptRow({
      event_type: "publication_attempt_succeeded",
    }),
  );
  const outcomeResult = validateSocialPublicationLedgerOutcomeRow(
    outcomeRow({
      event_type: "publication_attempt_started",
    }),
  );

  assert.equal(codes(attemptResult).includes("event_type_invalid"), true);
  assert.equal(codes(outcomeResult).includes("event_type_invalid"), true);
});

await test("malformed JSON summaries are rejected", () => {
  const result = validateSocialPublicationLedgerEvidenceRow({
    ...evidenceRow(),
    evidence_summary: ["not", "an", "object"],
  });

  assert.equal(codes(result).includes("summary_shape_invalid"), true);
});

await test("recursive JSON summaries are rejected", () => {
  const recursive: Record<string, unknown> = {};
  recursive.self = recursive;
  const result = validateSocialPublicationLedgerAttemptRow({
    ...attemptRow(),
    request_summary: recursive,
  });

  assert.equal(codes(result).includes("summary_shape_invalid"), true);
  assert.equal(codes(result).includes("unsafe_recursive_state_forbidden"), true);
});

await test("append-only and immutable flags are required", () => {
  const result = validateSocialPublicationLedgerEvidenceRow(
    evidenceRow({
      append_only: false,
      immutable: false,
    }),
  );

  assert.equal(codes(result).includes("append_only_invariant_failed"), true);
});

await test("invalid idempotency keys are rejected", () => {
  const result = validateSocialPublicationLedgerAttemptRow(
    attemptRow({
      idempotency_key: "",
    }),
  );

  assert.deepEqual(codes(result), ["idempotency_key_invalid"]);
});

await test("scheduler state is rejected", () => {
  const result = validateSocialPublicationLedgerAttemptRow({
    ...attemptRow(),
    request_summary: {
      ...attemptRow().request_summary,
      payloadSummary: {
        schedulerAuthority: true,
      },
    },
  });

  assert.equal(codes(result).includes("higher_layer_authority_forbidden"), true);
});

await test("metrics state is rejected", () => {
  const result = validateSocialPublicationLedgerOutcomeRow({
    ...outcomeRow(),
    result_summary: {
      ...outcomeRow().result_summary,
      responseSummary: {
        metrics: {
          impressions: 100,
        },
      },
    },
  });

  assert.equal(codes(result).includes("stored_computed_state_forbidden"), true);
});

await test("learning state is rejected", () => {
  const result = validateSocialPublicationLedgerEvidenceRow({
    ...evidenceRow(),
    evidence_summary: {
      ...evidenceRow().evidence_summary,
      evidence: {
        learningSignal: "promote",
      },
    },
  });

  assert.equal(codes(result).includes("stored_computed_state_forbidden"), true);
});

await test("authority and replay fields are rejected", () => {
  const result = validateSocialPublicationLedgerEvidenceRow({
    ...evidenceRow(),
    evidence_summary: {
      ...evidenceRow().evidence_summary,
      evidence: {
        canPublish: true,
        replayState: "succeeded",
      },
    },
  });

  assert.equal(codes(result).includes("higher_layer_authority_forbidden"), true);
  assert.equal(codes(result).includes("stored_computed_state_forbidden"), true);
});

await test("serialization is deterministic and sorted", () => {
  const model = rows({
    attempts: [
      attemptRow({
        ledger_entry_id: "10000000-0000-4000-8000-000000000009",
        publication_attempt_id: "20000000-0000-4000-8000-000000000009",
        attempt_sequence: 1,
        recorded_at: "2026-06-30T13:02:00.000Z",
        idempotency_key: "attempt-key-2",
      }),
      attemptRow(),
    ],
    outcomes: [outcomeRow()],
    evidence: [evidenceRow()],
  });

  assert.equal(
    serializeSocialPublicationLedgerRowsModel(model),
    serializeSocialPublicationLedgerRowsModel({
      ...model,
      attempts: [...model.attempts].reverse(),
    }),
  );
});

await test("hydration is safe and immutable", () => {
  const serialized = serializeSocialPublicationLedgerRowsModel(rows());
  const hydrated = assertOk(hydrateSocialPublicationLedgerRowsModel(serialized));

  assert.deepEqual(hydrated, rows());
  assert.equal(Object.isFrozen(hydrated), true);
  assert.equal(Object.isFrozen(hydrated.attempts[0]), true);
});

await test("invalid hydration is rejected", () => {
  const result = hydrateSocialPublicationLedgerRowsModel("{not json");

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map((error) => error.code), ["serialization_invalid"]);
});

await test("module exports no store repository or execution behavior", () => {
  const forbidden = [
    "appendPublicationLedgerEntry",
    "createSocialPublicationLedgerRepository",
    "createServiceRoleClient",
    "createSupabasePublicationLedgerStore",
    "fetchPublicationLedger",
    "getPublicationLedger",
    "insertPublicationLedgerAttempt",
    "publishPost",
    "replaySocialPublicationLedger",
    "schedulePublication",
  ];

  for (const name of forbidden) {
    assert.equal(name in rowExports, false, name);
  }
});

await test("row mapper module has no Supabase API UI or route implementation", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "social-publication-ledger-rows.ts"),
    "utf8",
  );
  const forbiddenFragments = [
    "createServiceRoleClient",
    "supabase",
    "from(",
    "insert(",
    "update(",
    "delete(",
    "select(",
    "next/",
    "react",
    "@/app",
    "app/api",
    "schedulePost(",
    "publishPost(",
  ];

  for (const fragment of forbiddenFragments) {
    assert.equal(source.includes(fragment), false, fragment);
  }
});
