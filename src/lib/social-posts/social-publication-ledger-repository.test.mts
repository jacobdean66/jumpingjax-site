import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSocialPublicationLedgerRepository,
  hydrateSocialPublicationLedgerRepositorySnapshot,
  serializeSocialPublicationLedgerRepositorySnapshot,
  validateSocialPublicationLedgerRepositoryAppendAttemptRequest,
  type SocialPublicationLedgerRepository,
  type SocialPublicationLedgerRepositoryResult,
} from "./social-publication-ledger-repository";
import * as repositoryExports from "./social-publication-ledger-repository";

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

function assertOk<T>(result: SocialPublicationLedgerRepositoryResult<T>): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected ok result.");
  return result.value;
}

function repository(): SocialPublicationLedgerRepository {
  return assertOk(createSocialPublicationLedgerRepository());
}

await test("valid repository write request", () => {
  const result = validateSocialPublicationLedgerRepositoryAppendAttemptRequest({
    attempt: attempt(),
  });

  assert.equal(result.ok, true);
});

await test("valid append requests create append-only ledger records", () => {
  const repo = repository();

  const writtenAttempt = assertOk(repo.createLedgerEntry({ attempt: attempt() as never }));
  const writtenOutcome = assertOk(repo.appendOutcome({ outcome: outcome() as never }));
  const writtenEvidence = assertOk(repo.appendEvidence({ evidence: evidence() as never }));

  assert.equal(writtenAttempt.publication_attempt_id, "attempt-1");
  assert.equal(writtenOutcome.outcome_id, "outcome-1");
  assert.equal(writtenEvidence.evidence_id, "evidence-1");
  assert.equal(Object.isFrozen(writtenAttempt), true);
});

await test("valid retrieval request returns scoped ledger", () => {
  const repo = repository();
  assertOk(repo.appendAttempt({ attempt: attempt() as never }));
  assertOk(repo.appendOutcome({ outcome: outcome() as never }));
  assertOk(repo.appendEvidence({ evidence: evidence() as never }));

  const ledger = assertOk(
    repo.getLedgerByIdentity({
      publication_attempt_id: "attempt-1",
    }),
  );

  assert.equal(ledger.attempts.length, 1);
  assert.equal(ledger.outcomes.length, 1);
  assert.equal(ledger.evidence.length, 1);
});

await test("serialization round-trip is deterministic", () => {
  const repo = repository();
  assertOk(repo.appendAttempt({ attempt: attempt() as never }));
  assertOk(repo.appendOutcome({ outcome: outcome() as never }));
  assertOk(repo.appendEvidence({ evidence: evidence() as never }));
  const snapshot = assertOk(repo.snapshot());

  const serialized = serializeSocialPublicationLedgerRepositorySnapshot(snapshot);
  const hydrated = assertOk(hydrateSocialPublicationLedgerRepositorySnapshot(serialized));
  const reserialized = serializeSocialPublicationLedgerRepositorySnapshot(hydrated);

  assert.equal(reserialized, serialized);
  assert.equal(Object.isFrozen(hydrated), true);
  assert.equal(Object.isFrozen(hydrated.attempts[0]), true);
});

await test("identity collision rejection", () => {
  const repo = repository();
  assertOk(repo.appendAttempt({ attempt: attempt() as never }));

  const result = repo.appendAttempt({
    attempt: attempt({
      ledger_entry_id: "ledger-entry-attempt-2",
    }) as never,
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "identity_collision");
});

await test("append-only enforcement", () => {
  const repo = repository();

  const result = repo.appendAttempt({
    attempt: attempt({
      append_only: false,
    }) as never,
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "validation_failed");
});

await test("invalid scope rejection", () => {
  const repo = repository();
  assertOk(repo.appendAttempt({ attempt: attempt() as never }));

  const result = repo.appendOutcome({
    outcome: outcome({
      scope: scope({
        publication_target_id: "target-instagram-1",
      }),
    }) as never,
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "relationship_invalid");
});

await test("recursive unsafe state rejection", () => {
  const recursive: Record<string, unknown> = {};
  recursive.self = recursive;
  const repo = repository();

  const result = repo.appendAttempt({
    attempt: attempt({
      request_summary: {
        requestId: "request-1",
        operation: "create_post",
        mediaKind: "image",
        payloadSummary: recursive,
        containsFullPayload: false,
        containsSecrets: false,
      },
    }) as never,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      result.error.validationErrors?.some(
        (error) => error.code === "unsafe_recursive_state_forbidden",
      ),
      true,
    );
  }
});

await test("computed state rejection", () => {
  const repo = repository();

  const result = repo.appendAttempt({
    attempt: attempt({
      request_summary: {
        requestId: "request-1",
        operation: "create_post",
        mediaKind: "image",
        payloadSummary: {
          publishStatus: "published",
        },
        containsFullPayload: false,
        containsSecrets: false,
      },
    }) as never,
  });

  assert.equal(result.ok, false);
});

await test("duplicate payload rejection", () => {
  const repo = repository();

  const result = repo.appendOutcome({
    outcome: outcome({
      result_summary: {
        externalPublicationId: "facebook-post-1",
        externalUrl: null,
        resultCode: "ok",
        message: null,
        responseSummary: {
          publicationManifest: {
            copied: true,
          },
        },
        containsFullResponse: false,
        containsSecrets: false,
      },
    }) as never,
  });

  assert.equal(result.ok, false);
});

await test("authority field rejection", () => {
  const repo = repository();

  const result = repo.appendEvidence({
    evidence: evidence({
      evidence_summary: {
        evidenceKind: "operator_note",
        notes: "Unsafe authority copy.",
        externalReference: null,
        evidence: {
          canPublish: true,
        },
        containsFullPayload: false,
        containsFullResponse: false,
        containsSecrets: false,
      },
    }) as never,
  });

  assert.equal(result.ok, false);
});

await test("deterministic reconstruction sorts records", () => {
  const repo = repository();
  assertOk(
    repo.appendAttempt({
      attempt: attempt({
        ledger_entry_id: "ledger-entry-attempt-2",
        publication_attempt_id: "attempt-2",
        attempt_sequence: 1,
        recorded_at: "2026-06-30T13:02:00.000Z",
      }) as never,
    }),
  );
  assertOk(repo.appendAttempt({ attempt: attempt() as never }));

  const snapshot = assertOk(repo.snapshot());

  assert.deepEqual(
    snapshot.attempts.map((item) => item.publication_attempt_id),
    ["attempt-1", "attempt-2"],
  );
});

await test("immutable outputs cannot be mutated", () => {
  const repo = repository();
  assertOk(repo.appendAttempt({ attempt: attempt() as never }));
  const attempts = assertOk(repo.listAttempts());

  assert.equal(Object.isFrozen(attempts), true);
  assert.throws(() => {
    (attempts as unknown[]).push(attempt());
  }, TypeError);
});

await test("module exports no D8 M4 replay read model or execution behavior", () => {
  const forbidden = [
    "replayPublicationLedger",
    "buildPublicationLedgerReadModel",
    "getCurrentPublishStatus",
    "schedulePublication",
    "publishPost",
    "recordPublicationMetrics",
    "learnFromPublication",
  ];

  for (const name of forbidden) {
    assert.equal(name in repositoryExports, false, name);
  }
});

await test("repository module has no persistence technology API UI or execution imports", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "social-publication-ledger-repository.ts",
    ),
    "utf8",
  );
  const forbiddenFragments = [
    "createServiceRoleClient",
    "supabase",
    "sql",
    "migration",
    "next/",
    "react",
    "@/app",
    "app/api",
    "fetch(",
    "schedulePost(",
    "publishPost(",
    "replayPublicationLedger(",
  ];

  for (const fragment of forbiddenFragments) {
    assert.equal(source.includes(fragment), false, fragment);
  }
});
