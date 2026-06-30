import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateSocialPublicationLedgerAttemptRecord,
  validateSocialPublicationLedgerEvidenceRecord,
  validateSocialPublicationLedgerOutcomeRecord,
  validateSocialPublicationLedgerPersistenceModel,
  type SocialPublicationLedgerPersistenceValidationResult,
} from "./social-publication-ledger-persistence";
import * as persistenceExports from "./social-publication-ledger-persistence";

type TestFn = () => void | Promise<void>;
type TestRecord = Record<string, unknown>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function scope(input: TestRecord = {}): TestRecord {
  return {
    social_post_id: "social-post-1",
    publication_target_id: "target-facebook-page-1",
    publication_manifest_id: "manifest-1",
    owner_approval_id: "owner-approval-1",
    approval_id: "approval-1",
    proposal_id: "proposal-1",
    ...input,
  };
}

function attempt(input: TestRecord = {}): TestRecord {
  return {
    ledger_entry_id: "ledger-entry-attempt-1",
    publication_attempt_id: "attempt-1",
    attempt_sequence: 0,
    event_type: "publication_attempt_started",
    scope: scope(),
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
    ...input,
  };
}

function outcome(input: TestRecord = {}): TestRecord {
  return {
    ledger_entry_id: "ledger-entry-outcome-1",
    outcome_id: "outcome-1",
    publication_attempt_id: "attempt-1",
    attempt_sequence: 0,
    event_type: "publication_attempt_succeeded",
    scope: scope(),
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
    ...input,
  };
}

function evidence(input: TestRecord = {}): TestRecord {
  return {
    evidence_id: "evidence-1",
    ledger_entry_id: "ledger-entry-outcome-1",
    publication_attempt_id: "attempt-1",
    outcome_id: "outcome-1",
    scope: scope(),
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
    ...input,
  };
}

function model(input: {
  attempts?: readonly unknown[];
  outcomes?: readonly unknown[];
  evidence?: readonly unknown[];
} = {}) {
  return {
    attempts: input.attempts ?? [attempt()],
    outcomes: input.outcomes ?? [outcome()],
    evidence: input.evidence ?? [evidence()],
  };
}

function codes(result: SocialPublicationLedgerPersistenceValidationResult): string[] {
  return result.ok ? [] : result.errors.map((error) => error.code);
}

await test("valid attempt record", () => {
  const result = validateSocialPublicationLedgerAttemptRecord(attempt());

  assert.equal(result.ok, true);
});

await test("valid outcome record", () => {
  const result = validateSocialPublicationLedgerOutcomeRecord(outcome());

  assert.equal(result.ok, true);
});

await test("valid evidence record", () => {
  const result = validateSocialPublicationLedgerEvidenceRecord(evidence());

  assert.equal(result.ok, true);
});

await test("valid persistence model relationships", () => {
  const result = validateSocialPublicationLedgerPersistenceModel(model());

  assert.equal(result.ok, true);
});

await test("append-only immutable structure is required", () => {
  const result = validateSocialPublicationLedgerAttemptRecord(
    attempt({
      append_only: false as true,
      immutable: false as true,
    }),
  );

  assert.deepEqual(codes(result), ["append_only_invariant_failed"]);
});

await test("required audit fields are validated", () => {
  const result = validateSocialPublicationLedgerAttemptRecord(
    attempt({
      recorded_at: "",
      recorded_by_actor: "robot" as "system",
      recorded_source: "database" as "publication_ledger_domain",
    }),
  );

  assert.deepEqual(codes(result), [
    "required_field_missing",
    "audit_field_invalid",
    "audit_field_invalid",
  ]);
});

await test("invalid and missing IDs are rejected", () => {
  const result = validateSocialPublicationLedgerOutcomeRecord(
    outcome({
      ledger_entry_id: "",
      outcome_id: "",
      publication_attempt_id: "",
      scope: {
        ...scope(),
        social_post_id: "",
        publication_target_id: "",
        publication_manifest_id: "",
        owner_approval_id: "",
      },
    }),
  );

  assert.deepEqual(codes(result), [
    "required_field_missing",
    "required_field_missing",
    "required_field_missing",
    "required_field_missing",
    "required_field_missing",
    "required_field_missing",
    "required_field_missing",
  ]);
});

await test("identity collisions are rejected", () => {
  const result = validateSocialPublicationLedgerEvidenceRecord(
    evidence({
      evidence_id: "same-id",
      ledger_entry_id: "same-id",
    }),
  );

  assert.deepEqual(codes(result), ["identity_not_separated"]);
});

await test("scope mismatch is rejected", () => {
  const result = validateSocialPublicationLedgerPersistenceModel(
    model({
      outcomes: [
        outcome({
          scope: {
            ...scope(),
            publication_target_id: "target-instagram-1",
          },
        }),
      ],
    }),
  );

  assert.equal(codes(result).includes("scope_mismatch"), true);
});

await test("unsafe recursive state is rejected", () => {
  const recursive: Record<string, unknown> = {};
  recursive.self = recursive;

  const result = validateSocialPublicationLedgerAttemptRecord(
    attempt({
      request_summary: {
        requestId: "request-1",
        operation: "create_post",
        mediaKind: "image",
        payloadSummary: recursive,
        containsFullPayload: false,
        containsSecrets: false,
      },
    }),
  );

  assert.equal(codes(result).includes("unsafe_recursive_state_forbidden"), true);
});

await test("stored computed state is rejected", () => {
  const result = validateSocialPublicationLedgerEvidenceRecord({
    ...evidence(),
    evidence_summary: {
      evidenceKind: "result_summary",
      notes: "Sanitized publication result.",
      externalReference: "facebook-post-1",
      evidence: {
        publishStatus: "published",
      },
      containsFullPayload: false,
      containsFullResponse: false,
      containsSecrets: false,
    },
  });

  assert.deepEqual(codes(result), ["stored_computed_state_forbidden"]);
});

await test("higher-layer authority fields are rejected", () => {
  const result = validateSocialPublicationLedgerAttemptRecord({
    ...attempt(),
    request_summary: {
      requestId: "request-1",
      operation: "create_post",
      mediaKind: "image",
      payloadSummary: {
        canApprove: true,
      },
      containsFullPayload: false,
      containsSecrets: false,
    },
  });

  assert.deepEqual(codes(result), ["higher_layer_authority_forbidden"]);
});

await test("lower-layer payload duplication is rejected", () => {
  const result = validateSocialPublicationLedgerOutcomeRecord({
    ...outcome(),
    result_summary: {
      externalPublicationId: "facebook-post-1",
      externalUrl: "https://example.com/post/1",
      resultCode: "ok",
      message: "Published.",
      responseSummary: {
        publicationManifest: {
          copied: true,
        },
      },
      containsFullResponse: false,
      containsSecrets: false,
    },
  });

  assert.deepEqual(codes(result), ["lower_layer_payload_forbidden"]);
});

await test("attempt outcome evidence relationships are validated", () => {
  const result = validateSocialPublicationLedgerPersistenceModel(
    model({
      evidence: [
        evidence({
          outcome_id: "missing-outcome",
        }),
      ],
    }),
  );

  assert.deepEqual(codes(result), ["relationship_invalid"]);
});

await test("no D8 M3 repository behavior is exported", () => {
  const forbidden = [
    "appendPublicationLedgerEntry",
    "createPublicationLedgerRepository",
    "deletePublicationLedgerEntry",
    "fetchPublicationLedger",
    "getPublicationLedger",
    "insertPublicationLedgerAttempt",
    "publishPost",
    "replayPublicationLedger",
    "schedulePublication",
    "selectPublicationLedgerEntries",
    "updatePublicationLedgerEntry",
  ];

  for (const name of forbidden) {
    assert.equal(name in persistenceExports, false, name);
  }
});

await test("module has no repository, route, Supabase, or UI implementation", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "social-publication-ledger-persistence.ts",
    ),
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
    "replayPublicationLedger(",
  ];

  for (const fragment of forbiddenFragments) {
    assert.equal(source.includes(fragment), false, fragment);
  }
});
