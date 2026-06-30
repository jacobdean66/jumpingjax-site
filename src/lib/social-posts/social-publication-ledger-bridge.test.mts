import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSocialPublicationLedgerBridge,
  resolveSocialPublicationLedgerBridgeMode,
  validateSocialPublicationLedgerBridgeModel,
  type SocialPublicationLedgerBridge,
  type SocialPublicationLedgerBridgeResult,
} from "./social-publication-ledger-bridge";
import * as bridgeExports from "./social-publication-ledger-bridge";
import { mapPublicationLedgerEntryToPersistenceRecords } from "./social-publication-ledger-mapper";
import type {
  PublicationLedgerEntry,
  PublicationLedgerEventType,
} from "./social-publication-ledger";
import type {
  SocialPublicationLedgerAttemptRecord,
  SocialPublicationLedgerEvidenceRecord,
  SocialPublicationLedgerOutcomeRecord,
  SocialPublicationLedgerPersistenceModel,
} from "./social-publication-ledger-persistence";
import type { PublicationTargetSelectionSnapshot } from "./social-publication-targets";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
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
    errorSummary: null,
    evidenceSummary: {
      evidenceKind: "result_summary",
      notes: "Sanitized outcome evidence.",
      externalReference: "facebook-post-1",
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

function mappedAttempt() {
  return assertMapperOk(mapPublicationLedgerEntryToPersistenceRecords(entry()));
}

function mappedOutcome() {
  return assertMapperOk(
    mapPublicationLedgerEntryToPersistenceRecords(outcomeEntry()),
  );
}

function assertOk<T>(result: SocialPublicationLedgerBridgeResult<T>): T {
  assert.equal(result.ok, true, JSON.stringify(result.ok ? [] : result.error));
  return result.value;
}

function assertBridgeError(
  result: SocialPublicationLedgerBridgeResult<unknown>,
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

function productionDouble(): {
  implementation: SocialPublicationLedgerBridge;
  calls: string[];
  model: SocialPublicationLedgerPersistenceModel;
} {
  const calls: string[] = [];
  const model: {
    attempts: SocialPublicationLedgerAttemptRecord[];
    outcomes: SocialPublicationLedgerOutcomeRecord[];
    evidence: SocialPublicationLedgerEvidenceRecord[];
  } = {
    attempts: [],
    outcomes: [],
    evidence: [],
  };

  const implementation: SocialPublicationLedgerBridge = {
    mode: "production",
    async appendAttempt(record) {
      calls.push("appendAttempt");
      model.attempts = [...model.attempts, clone(record)];
      return { ok: true, value: clone(record) };
    },
    async appendOutcome(record) {
      calls.push("appendOutcome");
      model.outcomes = [...model.outcomes, clone(record)];
      return { ok: true, value: clone(record) };
    },
    async appendEvidence(record) {
      calls.push("appendEvidence");
      model.evidence = [...model.evidence, clone(record)];
      return { ok: true, value: clone(record) };
    },
    async appendMappedEntry(mappedEntry) {
      calls.push("appendMappedEntry");
      if (mappedEntry.attempt) model.attempts = [...model.attempts, clone(mappedEntry.attempt)];
      if (mappedEntry.outcome) model.outcomes = [...model.outcomes, clone(mappedEntry.outcome)];
      if (mappedEntry.evidence) model.evidence = [...model.evidence, clone(mappedEntry.evidence)];
      return { ok: true, value: clone(model) };
    },
    async loadByPost() {
      calls.push("loadByPost");
      return { ok: true, value: clone(model) };
    },
    async loadByManifest() {
      calls.push("loadByManifest");
      return { ok: true, value: clone(model) };
    },
    async loadByPublicationTarget() {
      calls.push("loadByPublicationTarget");
      return { ok: true, value: clone(model) };
    },
  };

  return { implementation, calls, model };
}

await test("reference implementation is selected for test environment", async () => {
  const bridge = assertOk(
    createSocialPublicationLedgerBridge({
      mode: "environment",
      runtimeEnvironment: "test",
    }),
  );

  assert.equal(bridge.mode, "reference");
  assert.equal(Object.isFrozen(bridge), true);
  assert.equal(
    assertOk(
      resolveSocialPublicationLedgerBridgeMode({
        mode: "environment",
        runtimeEnvironment: "test",
      }),
    ).mode,
    "reference",
  );
});

await test("production implementation is selected only when configured", async () => {
  const { implementation, calls } = productionDouble();
  const bridge = assertOk(
    createSocialPublicationLedgerBridge({
      mode: "production",
      runtimeEnvironment: "production",
      productionStoreConfigured: true,
      implementation,
    }),
  );

  assert.equal(bridge.mode, "production");
  assertOk(await bridge.appendAttempt(mappedAttempt().attempt!));
  assert.deepEqual(calls, ["appendAttempt"]);
});

await test("missing production dependency and unsafe fallback are rejected", () => {
  assertBridgeError(
    createSocialPublicationLedgerBridge({
      mode: "production",
      runtimeEnvironment: "production",
      productionStoreConfigured: false,
    }),
    "production_unavailable",
  );
  assertBridgeError(
    createSocialPublicationLedgerBridge({
      mode: "reference",
      runtimeEnvironment: "production",
    }),
    "unsafe_reference_in_production",
  );
  assertBridgeError(
    createSocialPublicationLedgerBridge({
      mode: "environment",
      runtimeEnvironment: "production",
      productionStoreConfigured: false,
    }),
    "production_unavailable",
  );
});

await test("reference bridge routes append attempt outcome evidence and loads", async () => {
  const bridge = assertOk(
    createSocialPublicationLedgerBridge({
      mode: "reference",
      runtimeEnvironment: "test",
    }),
  );

  const attempt = mappedAttempt().attempt!;
  const outcome = mappedOutcome().outcome!;
  const evidence = mappedOutcome().evidence!;

  assert.equal(assertOk(await bridge.appendAttempt(attempt)).ledger_entry_id, attempt.ledger_entry_id);
  assert.equal(assertOk(await bridge.appendOutcome(outcome)).outcome_id, outcome.outcome_id);
  assert.equal(assertOk(await bridge.appendEvidence(evidence)).evidence_id, evidence.evidence_id);

  assert.equal(assertOk(await bridge.loadByPost("50000000-0000-4000-8000-000000000001")).attempts.length, 1);
  assert.equal(assertOk(await bridge.loadByManifest("manifest-2026-06-30-a")).outcomes.length, 1);
  assert.equal(assertOk(await bridge.loadByPublicationTarget("60000000-0000-4000-8000-000000000001")).evidence.length, 1);
});

await test("mapped entry routing remains deterministic and immutable", async () => {
  const bridge = assertOk(
    createSocialPublicationLedgerBridge({
      mode: "reference",
      runtimeEnvironment: "test",
    }),
  );

  const inserted = assertOk(await bridge.appendMappedEntry(mappedAttempt()));
  const loaded = assertOk(await bridge.loadByManifest("manifest-2026-06-30-a"));

  assert.deepEqual(inserted, loaded);
  assert.equal(Object.isFrozen(inserted), true);
  assert.equal(Object.isFrozen(inserted.attempts[0]), true);
});

await test("production bridge routes all operations to selected implementation", async () => {
  const { implementation, calls } = productionDouble();
  const bridge = assertOk(
    createSocialPublicationLedgerBridge({
      mode: "production",
      runtimeEnvironment: "production",
      productionStoreConfigured: true,
      implementation,
    }),
  );

  await bridge.appendAttempt(mappedAttempt().attempt!);
  await bridge.appendOutcome(mappedOutcome().outcome!);
  await bridge.appendEvidence(mappedOutcome().evidence!);
  await bridge.appendMappedEntry(mappedAttempt());
  await bridge.loadByPost("50000000-0000-4000-8000-000000000001");
  await bridge.loadByManifest("manifest-2026-06-30-a");
  await bridge.loadByPublicationTarget("60000000-0000-4000-8000-000000000001");

  assert.deepEqual(calls, [
    "appendAttempt",
    "appendOutcome",
    "appendEvidence",
    "appendMappedEntry",
    "loadByPost",
    "loadByManifest",
    "loadByPublicationTarget",
  ]);
});

await test("errors propagate without fallback or dual write", async () => {
  let productionCalls = 0;
  const implementation: SocialPublicationLedgerBridge = {
    ...productionDouble().implementation,
    mode: "production",
    async appendAttempt() {
      productionCalls += 1;
      return {
        ok: false,
        error: {
          code: "storage_error",
          message: "storage unavailable",
        },
      };
    },
  };
  const bridge = assertOk(
    createSocialPublicationLedgerBridge({
      mode: "production",
      runtimeEnvironment: "production",
      productionStoreConfigured: true,
      implementation,
    }),
  );

  assertBridgeError(await bridge.appendAttempt(mappedAttempt().attempt!), "storage_error");
  assert.equal(productionCalls, 1);
});

await test("validation rejects invalid model and invalid append input", async () => {
  const bridge = assertOk(
    createSocialPublicationLedgerBridge({
      mode: "reference",
      runtimeEnvironment: "test",
    }),
  );

  assertBridgeError(
    await bridge.appendAttempt({
      ...mappedAttempt().attempt!,
      append_only: false,
    } as never),
    "validation_failed",
  );
  assertBridgeError(validateSocialPublicationLedgerBridgeModel({ attempts: [] }), "validation_failed");
});

await test("duplicate identity and idempotency style conflicts remain rejectable", async () => {
  const bridge = assertOk(
    createSocialPublicationLedgerBridge({
      mode: "reference",
      runtimeEnvironment: "test",
    }),
  );

  const attempt = mappedAttempt().attempt!;
  assertOk(await bridge.appendAttempt(attempt));
  assertBridgeError(await bridge.appendAttempt(attempt), "identity_collision");

  const invalidOutcome = {
    ...mappedOutcome().outcome!,
    publication_attempt_id: "20000000-0000-4000-8000-000000000099",
  } as SocialPublicationLedgerOutcomeRecord;
  assertBridgeError(await bridge.appendOutcome(invalidOutcome), "relationship_invalid");
});

await test("module exports no scheduler metrics learning publisher admin or API behavior", () => {
  const exportedNames = Object.keys(bridgeExports).sort();
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

await test("bridge source has no schema route worker cron replay or business behavior", () => {
  const sourcePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "social-publication-ledger-bridge.ts",
  );
  const source = readFileSync(sourcePath, "utf8");
  const forbiddenSnippets = [
    "create table",
    "alter table",
    "next/",
    "react",
    "app/api",
    "NextRequest",
    "NextResponse",
    "cron",
    "worker",
    "replay",
    "schedulerState",
    "metricsAuthority",
    "learningSignal",
    "publisherAuthority",
  ];

  for (const snippet of forbiddenSnippets) {
    assert.equal(source.includes(snippet), false, snippet);
  }
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
