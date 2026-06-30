import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  configureSocialPublicationLedgerStoreTestDependencies,
  fetchPublicationLedgerEvidenceRows,
  fetchPublicationLedgerOutcomeRows,
  fetchPublicationLedgerRecordsByManifest,
  fetchPublicationLedgerRecordsByPost,
  fetchPublicationLedgerRecordsByPublicationTarget,
  fetchPublicationLedgerRows,
  fetchPublicationLedgerRowsByManifest,
  insertPublicationLedgerAttempt,
  insertPublicationLedgerEvidence,
  insertPublicationLedgerMappedEntry,
  insertPublicationLedgerOutcome,
  type SocialPublicationLedgerStoreResult,
  type SocialPublicationLedgerStoreStorage,
} from "./social-publication-ledger-store";
import * as storeExports from "./social-publication-ledger-store";
import { mapPublicationLedgerEntryToPersistenceRecords } from "./social-publication-ledger-mapper";
import {
  mapSocialPublicationLedgerAttemptRecordToRow,
  type SocialPublicationLedgerAttemptRow,
  type SocialPublicationLedgerEvidenceRow,
  type SocialPublicationLedgerOutcomeRow,
} from "./social-publication-ledger-rows";
import type {
  PublicationLedgerEntry,
  PublicationLedgerEventType,
} from "./social-publication-ledger";
import type { PublicationTargetSelectionSnapshot } from "./social-publication-targets";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  configureSocialPublicationLedgerStoreTestDependencies(null);
  await fn();
  console.log(`ok - ${name}`);
}

function targetSnapshot(
  input: Partial<PublicationTargetSelectionSnapshot> = {},
): PublicationTargetSelectionSnapshot {
  return {
    targetId: "60000000-0000-4000-8000-000000000001",
    platform: "facebook",
    targetType: "facebook_page",
    displayName: "Jumping Jax Facebook",
    externalId: "facebook-page-1",
    capabilitySummary: {
      capabilityKinds: ["image_post", "caption_text"],
      mediaConstraints: {
        supportedMediaTypes: ["image"],
        maxImageCount: 1,
        maxVideoCount: 0,
        maxVideoDurationSeconds: null,
        supportedAspectRatios: ["1:1"],
      },
      copyConstraints: {
        maxCaptionCharacters: 2200,
        supportsHashtags: true,
        supportsLinks: false,
      },
      computedOnly: true,
      authoritative: false,
      grantsPublishingPermission: false,
      publishesNothing: true,
      schedulesNothing: true,
      recordsNoMetrics: true,
      performsNoLearning: true,
    },
    source: "publication_target_selection_snapshot",
    computedOnly: true,
    authoritative: false,
    grantsPublishingPermission: false,
    publishesNothing: true,
    schedulesNothing: true,
    recordsNoMetrics: true,
    performsNoLearning: true,
    metadata: {},
    references: {
      socialPostId: "50000000-0000-4000-8000-000000000001",
      approvalId: "70000000-0000-4000-8000-000000000002",
      proposalId: "70000000-0000-4000-8000-000000000003",
    },
    ...input,
  };
}

function entry(input: Partial<PublicationLedgerEntry> = {}): PublicationLedgerEntry {
  return {
    ledgerEntryId: "10000000-0000-4000-8000-000000000001",
    publicationAttemptId: "20000000-0000-4000-8000-000000000001",
    eventType: "publication_attempt_started",
    attemptSequence: 0,
    references: {
      socialPostId: "50000000-0000-4000-8000-000000000001",
      publicationTargetId: "60000000-0000-4000-8000-000000000001",
      publicationManifestId: "manifest-2026-06-30-a",
      ownerApprovalId: "70000000-0000-4000-8000-000000000001",
      approvalId: "70000000-0000-4000-8000-000000000002",
      proposalId: "70000000-0000-4000-8000-000000000003",
    },
    targetSnapshot: targetSnapshot(),
    requestSummary: {
      requestId: "request-1",
      operation: "create_post",
      mediaKind: "image",
      payloadSummary: {
        captionLength: 120,
      },
      containsFullPayload: false,
      containsSecrets: false,
    },
    resultSummary: null,
    errorSummary: null,
    evidenceSummary: {
      evidenceKind: "request_summary",
      notes: "Sanitized request.",
      externalReference: null,
      evidence: {
        request: "sanitized",
      },
      containsFullPayload: false,
      containsFullResponse: false,
      containsSecrets: false,
    },
    actor: "system",
    source: "publication_ledger_domain",
    createdAt: "2026-06-30T13:00:00.000Z",
    appendOnly: true,
    immutable: true,
    grantsPublishingPermission: false,
    approvesNothing: true,
    publishesNothing: true,
    schedulesNothing: true,
    recordsNoMetrics: true,
    performsNoLearning: true,
    currentPublishStatusAuthority: false,
    ...input,
  };
}

function outcomeEntry(
  eventType: PublicationLedgerEventType = "publication_attempt_succeeded",
  input: Partial<PublicationLedgerEntry> = {},
): PublicationLedgerEntry {
  const success = eventType === "publication_attempt_succeeded" ||
    eventType === "publication_attempt_retry_succeeded";
  const failure = eventType === "publication_attempt_failed" ||
    eventType === "publication_attempt_retry_failed";

  return entry({
    ledgerEntryId: "10000000-0000-4000-8000-000000000002",
    eventType,
    requestSummary: null,
    resultSummary: success
      ? {
          externalPublicationId: "facebook-post-1",
          externalUrl: "https://example.com/post/1",
          resultCode: "ok",
          message: "Published.",
          responseSummary: {
            accepted: true,
          },
          containsFullResponse: false,
          containsSecrets: false,
        }
      : null,
    errorSummary: failure
      ? {
          errorCode: "provider_error",
          message: "Provider rejected the post.",
          retryable: true,
          errorSummary: {
            category: "provider",
          },
          containsFullResponse: false,
          containsSecrets: false,
        }
      : null,
    evidenceSummary: {
      evidenceKind: success ? "result_summary" : "operator_note",
      notes: "Sanitized outcome evidence.",
      externalReference: success ? "facebook-post-1" : null,
      evidence: {
        eventType,
      },
      containsFullPayload: false,
      containsFullResponse: false,
      containsSecrets: false,
    },
    actor: "publisher",
    source: "future_publisher",
    createdAt: "2026-06-30T13:01:00.000Z",
    ...input,
  });
}

function assertOk<T>(result: SocialPublicationLedgerStoreResult<T>): T {
  assert.equal(result.ok, true, JSON.stringify(result.ok ? [] : result.error));
  return result.value;
}

function assertStoreError(
  result: SocialPublicationLedgerStoreResult<unknown>,
  code: string,
): void {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, code);
}

function assertMapperOk<T>(
  result: { ok: true; value: T } | { ok: false; errors: readonly unknown[] },
): T {
  assert.equal(result.ok, true, JSON.stringify(result.ok ? [] : result.errors));
  return result.value;
}

function mappedAttempt() {
  return assertMapperOk(mapPublicationLedgerEntryToPersistenceRecords(entry()));
}

function mappedOutcome() {
  return assertMapperOk(
    mapPublicationLedgerEntryToPersistenceRecords(outcomeEntry()),
  );
}

function attemptRow(): SocialPublicationLedgerAttemptRow {
  return assertMapperOk(
    mapSocialPublicationLedgerAttemptRecordToRow(mappedAttempt().attempt!),
  );
}

class MemoryLedgerStorage implements SocialPublicationLedgerStoreStorage {
  attempts: SocialPublicationLedgerAttemptRow[] = [];
  outcomes: SocialPublicationLedgerOutcomeRow[] = [];
  evidence: SocialPublicationLedgerEvidenceRow[] = [];
  throwOnInsert = false;

  async insertAttempt(
    row: SocialPublicationLedgerAttemptRow,
  ): Promise<SocialPublicationLedgerAttemptRow> {
    if (this.throwOnInsert) throw new Error("write failed");
    this.attempts.push(clone(row));
    return clone(row);
  }

  async insertOutcome(
    row: SocialPublicationLedgerOutcomeRow,
  ): Promise<SocialPublicationLedgerOutcomeRow> {
    if (this.throwOnInsert) throw new Error("write failed");
    this.outcomes.push(clone(row));
    return clone(row);
  }

  async insertEvidence(
    row: SocialPublicationLedgerEvidenceRow,
  ): Promise<SocialPublicationLedgerEvidenceRow> {
    if (this.throwOnInsert) throw new Error("write failed");
    this.evidence.push(clone(row));
    return clone(row);
  }

  async findAttemptByLedgerEntryId(
    ledgerEntryId: string,
  ): Promise<SocialPublicationLedgerAttemptRow | null> {
    return findOne(this.attempts, "ledger_entry_id", ledgerEntryId);
  }

  async findAttemptByPublicationAttemptId(
    publicationAttemptId: string,
  ): Promise<SocialPublicationLedgerAttemptRow | null> {
    return findOne(this.attempts, "publication_attempt_id", publicationAttemptId);
  }

  async findAttemptByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationLedgerAttemptRow | null> {
    return findOne(this.attempts, "idempotency_key", idempotencyKey);
  }

  async findOutcomeByLedgerEntryId(
    ledgerEntryId: string,
  ): Promise<SocialPublicationLedgerOutcomeRow | null> {
    return findOne(this.outcomes, "ledger_entry_id", ledgerEntryId);
  }

  async findOutcomeByOutcomeId(
    outcomeId: string,
  ): Promise<SocialPublicationLedgerOutcomeRow | null> {
    return findOne(this.outcomes, "outcome_id", outcomeId);
  }

  async findOutcomeByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationLedgerOutcomeRow | null> {
    return findOne(this.outcomes, "idempotency_key", idempotencyKey);
  }

  async findEvidenceByEvidenceId(
    evidenceId: string,
  ): Promise<SocialPublicationLedgerEvidenceRow | null> {
    return findOne(this.evidence, "evidence_id", evidenceId);
  }

  async findEvidenceByLedgerEntryId(
    ledgerEntryId: string,
  ): Promise<SocialPublicationLedgerEvidenceRow | null> {
    return findOne(this.evidence, "ledger_entry_id", ledgerEntryId);
  }

  async findEvidenceByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationLedgerEvidenceRow | null> {
    return findOne(this.evidence, "idempotency_key", idempotencyKey);
  }

  async fetchAttempts(filter = {}): Promise<SocialPublicationLedgerAttemptRow[]> {
    return this.attempts.filter((row) => matchesFilter(row, filter)).map(clone);
  }

  async fetchOutcomes(filter = {}): Promise<SocialPublicationLedgerOutcomeRow[]> {
    return this.outcomes.filter((row) => matchesFilter(row, filter)).map(clone);
  }

  async fetchEvidence(filter = {}): Promise<SocialPublicationLedgerEvidenceRow[]> {
    return this.evidence.filter((row) => matchesFilter(row, filter)).map(clone);
  }
}

await test("successful inserts and reads persist attempts outcomes and evidence", async () => {
  const storage = new MemoryLedgerStorage();
  configureSocialPublicationLedgerStoreTestDependencies(storage);

  const attempt = mappedAttempt().attempt!;
  const outcome = mappedOutcome().outcome!;
  const evidence = mappedOutcome().evidence!;

  assert.equal(assertOk(await insertPublicationLedgerAttempt(attempt)).ledger_entry_id, attempt.ledger_entry_id);
  assert.equal(assertOk(await insertPublicationLedgerOutcome(outcome)).outcome_id, outcome.outcome_id);
  assert.equal(assertOk(await insertPublicationLedgerEvidence(evidence)).evidence_id, evidence.evidence_id);

  const rows = assertOk(await fetchPublicationLedgerRows());
  assert.equal(rows.attempts.length, 1);
  assert.equal(rows.outcomes.length, 1);
  assert.equal(rows.evidence.length, 1);
  assert.equal(Object.isFrozen(rows), true);
});

await test("mapped H3 output can be inserted without repository bridge behavior", async () => {
  const storage = new MemoryLedgerStorage();
  configureSocialPublicationLedgerStoreTestDependencies(storage);

  const inserted = assertOk(await insertPublicationLedgerMappedEntry(mappedAttempt()));

  assert.equal(inserted.attempts.length, 1);
  assert.equal(inserted.outcomes.length, 0);
  assert.equal(inserted.evidence.length, 1);
  assert.equal(storage.attempts.length, 1);
});

await test("duplicate identities and idempotency keys are rejected before write", async () => {
  const storage = new MemoryLedgerStorage();
  configureSocialPublicationLedgerStoreTestDependencies(storage);

  const attempt = mappedAttempt().attempt!;
  assertOk(await insertPublicationLedgerAttempt(attempt, { idempotencyKey: "attempt-1" }));
  assertStoreError(
    await insertPublicationLedgerAttempt(attempt, { idempotencyKey: "attempt-2" }),
    "duplicate_identity",
  );

  const secondAttempt = mappedAttempt().attempt!;
  assertStoreError(
    await insertPublicationLedgerAttempt(
      {
        ...secondAttempt,
        ledger_entry_id: "10000000-0000-4000-8000-000000000009" as typeof secondAttempt.ledger_entry_id,
        publication_attempt_id: "20000000-0000-4000-8000-000000000009" as typeof secondAttempt.publication_attempt_id,
      },
      { idempotencyKey: "attempt-1" },
    ),
    "duplicate_idempotency_key",
  );
});

await test("missing parent and scope mismatch are rejected before Supabase", async () => {
  const storage = new MemoryLedgerStorage();
  configureSocialPublicationLedgerStoreTestDependencies(storage);

  assertStoreError(await insertPublicationLedgerOutcome(mappedOutcome().outcome!), "parent_missing");

  const attempt = attemptRow();
  storage.attempts.push({
    ...attempt,
    publication_manifest_id: "different-manifest",
  });

  assertStoreError(await insertPublicationLedgerOutcome(mappedOutcome().outcome!), "scope_mismatch");
});

await test("invalid records rows and mapper output are rejected", async () => {
  const storage = new MemoryLedgerStorage();
  configureSocialPublicationLedgerStoreTestDependencies(storage);

  assertStoreError(
    await insertPublicationLedgerAttempt({
      ...mappedAttempt().attempt!,
      append_only: false,
    } as never),
    "validation_failed",
  );

  storage.attempts.push({
    ...attemptRow(),
    immutable: false,
  });

  assertStoreError(await fetchPublicationLedgerRows(), "validation_failed");
  assertStoreError(
    await insertPublicationLedgerMappedEntry({
      ...mappedAttempt(),
      attempt: {
        ...mappedAttempt().attempt!,
        request_summary: {
          rawPayload: true,
          containsFullPayload: false,
          containsSecrets: false,
        },
      },
    } as never),
    "validation_failed",
  );
});

await test("evidence parent outcome and append-only behavior are enforced", async () => {
  const storage = new MemoryLedgerStorage();
  configureSocialPublicationLedgerStoreTestDependencies(storage);
  assertOk(await insertPublicationLedgerAttempt(mappedAttempt().attempt!));

  assertStoreError(await insertPublicationLedgerEvidence(mappedOutcome().evidence!), "parent_missing");

  assertOk(await insertPublicationLedgerOutcome(mappedOutcome().outcome!));
  assertOk(await insertPublicationLedgerEvidence(mappedOutcome().evidence!));
  assert.equal(storage.evidence.length, 1);

  assertStoreError(await insertPublicationLedgerEvidence(mappedOutcome().evidence!), "duplicate_identity");
});

await test("read ordering and deterministic retrieval filters are stable", async () => {
  const storage = new MemoryLedgerStorage();
  configureSocialPublicationLedgerStoreTestDependencies(storage);

  const first = attemptRow();
  const second = {
    ...first,
    ledger_entry_id: "10000000-0000-4000-8000-000000000009",
    publication_attempt_id: "20000000-0000-4000-8000-000000000009",
    attempt_sequence: 1,
    recorded_at: "2026-06-30T13:02:00.000Z",
  } satisfies SocialPublicationLedgerAttemptRow;
  storage.attempts.push(second, first);

  const rows = assertOk(await fetchPublicationLedgerRowsByManifest("manifest-2026-06-30-a"));
  assert.deepEqual(
    rows.attempts.map((row) => row.attempt_sequence),
    [0, 1],
  );

  assert.equal(assertOk(await fetchPublicationLedgerRecordsByPost("50000000-0000-4000-8000-000000000001")).attempts.length, 2);
  assert.equal(assertOk(await fetchPublicationLedgerRecordsByManifest("manifest-2026-06-30-a")).attempts.length, 2);
  assert.equal(assertOk(await fetchPublicationLedgerRecordsByPublicationTarget("60000000-0000-4000-8000-000000000001")).attempts.length, 2);
  assert.equal(assertOk(await fetchPublicationLedgerEvidenceRows()).length, 0);
  assert.equal(assertOk(await fetchPublicationLedgerOutcomeRows()).length, 0);
});

await test("service-role storage and failure handling are explicit", async () => {
  const storage = new MemoryLedgerStorage();
  storage.throwOnInsert = true;
  configureSocialPublicationLedgerStoreTestDependencies(storage);

  assertStoreError(await insertPublicationLedgerAttempt(mappedAttempt().attempt!), "storage_error");

  const sourcePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "social-publication-ledger-store.ts",
  );
  const source = readFileSync(sourcePath, "utf8");

  assert.equal(source.includes("createServiceRoleClient"), true);
  assert.equal(source.includes(".update("), false);
  assert.equal(source.includes(".delete("), false);
  assert.equal(source.includes("replaySocialPublicationLedger"), false);
});

await test("module exports no scheduler metrics learning publisher api or admin behavior", () => {
  const exportedNames = Object.keys(storeExports).sort();
  const forbidden = [
    "schedulePublication",
    "recordPublicationMetrics",
    "learnFromPublication",
    "publishSocialPost",
    "renderPublicationLedgerAdmin",
    "createPublicationLedgerRoute",
  ];

  for (const name of forbidden) {
    assert.equal(exportedNames.includes(name), false);
  }
});

await test("store source has no route worker cron replay or UI implementation", () => {
  const sourcePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "social-publication-ledger-store.ts",
  );
  const source = readFileSync(sourcePath, "utf8");
  const forbiddenSnippets = [
    "next/",
    "react",
    "app/api",
    "NextRequest",
    "NextResponse",
    "cron",
    "worker",
    "replay",
    "schedulerState",
    "metrics",
    "learning",
    "publisherAuthority",
  ];

  for (const snippet of forbiddenSnippets) {
    assert.equal(source.includes(snippet), false, snippet);
  }
});

function findOne<TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  key: keyof TRow,
  value: string,
): TRow | null {
  return clone(rows.find((row) => row[key] === value) ?? null);
}

function matchesFilter(
  row:
    | SocialPublicationLedgerAttemptRow
    | SocialPublicationLedgerOutcomeRow
    | SocialPublicationLedgerEvidenceRow,
  filter: {
    socialPostId?: string;
    publicationManifestId?: string;
    publicationTargetId?: string;
  },
): boolean {
  return (
    (!filter.socialPostId || row.social_post_id === filter.socialPostId) &&
    (!filter.publicationManifestId ||
      row.publication_manifest_id === filter.publicationManifestId) &&
    (!filter.publicationTargetId ||
      row.publication_target_id === filter.publicationTargetId)
  );
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
