import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  aggregateSocialPublicationLedgerEvidence,
  generateSocialPublicationLedgerReplayDiagnostics,
  generateSocialPublicationLedgerReplayTimeline,
  replaySocialPublicationLedger,
  verifySocialPublicationLedgerReplayConsistency,
} from "./social-publication-ledger-replay";
import * as replayExports from "./social-publication-ledger-replay";

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

function failedOutcome(input: TestRecord = {}): TestRecord {
  return outcome({
    ledger_entry_id: "ledger-entry-outcome-failed-1",
    outcome_id: "outcome-failed-1",
    event_type: "publication_attempt_failed",
    result_summary: null,
    error_summary: {
      errorCode: "external_rejected",
      message: "External platform rejected the request.",
      retryable: false,
      errorSummary: {
        category: "validation",
      },
      containsFullResponse: false,
      containsSecrets: false,
    },
    ...input,
  });
}

function cancelledOutcome(input: TestRecord = {}): TestRecord {
  return outcome({
    ledger_entry_id: "ledger-entry-outcome-cancelled-1",
    outcome_id: "outcome-cancelled-1",
    event_type: "publication_attempt_cancelled",
    result_summary: null,
    error_summary: null,
    ...input,
  });
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
    attempts: input.attempts ?? [],
    outcomes: input.outcomes ?? [],
    evidence: input.evidence ?? [],
  } as never;
}

function codes(
  diagnostics: ReturnType<typeof generateSocialPublicationLedgerReplayDiagnostics>,
): string[] {
  return diagnostics.map((diagnostic) => diagnostic.code);
}

await test("empty ledger", () => {
  const replay = replaySocialPublicationLedger(model());

  assert.equal(replay.value.currentPublicationStatus, "no_history");
  assert.equal(replay.value.currentTerminalState, "none");
  assert.equal(replay.value.timeline.length, 0);
  assert.equal(replay.value.replayIntegrity.valid, true);
});

await test("single attempt", () => {
  const replay = replaySocialPublicationLedger(model({ attempts: [attempt()] }));

  assert.equal(replay.value.currentPublicationStatus, "attempted");
  assert.deepEqual(replay.value.summary.pendingAttemptIds, ["attempt-1"]);
});

await test("multiple attempts", () => {
  const replay = replaySocialPublicationLedger(
    model({
      attempts: [
        attempt({
          ledger_entry_id: "ledger-entry-attempt-2",
          publication_attempt_id: "attempt-2",
          attempt_sequence: 1,
          event_type: "publication_attempt_retry_started",
          recorded_at: "2026-06-30T13:03:00.000Z",
        }),
        attempt(),
      ],
      outcomes: [
        outcome({
          ledger_entry_id: "ledger-entry-outcome-retry-requested-1",
          outcome_id: "outcome-retry-requested-1",
          event_type: "publication_attempt_retry_requested",
          result_summary: null,
          error_summary: null,
          recorded_at: "2026-06-30T13:02:00.000Z",
        }),
      ],
    }),
  );

  assert.equal(replay.value.latestAttempt?.publicationAttemptId, "attempt-2");
  assert.equal(replay.value.summary.latestAttemptId, "attempt-2");
});

await test("successful publication", () => {
  const replay = replaySocialPublicationLedger(
    model({ attempts: [attempt()], outcomes: [outcome()] }),
  );

  assert.equal(replay.value.currentPublicationStatus, "succeeded");
  assert.equal(replay.value.currentTerminalState, "succeeded");
  assert.equal(replay.value.summary.latestSuccessfulPublicationId, "facebook-post-1");
});

await test("failed publication", () => {
  const replay = replaySocialPublicationLedger(
    model({ attempts: [attempt()], outcomes: [failedOutcome()] }),
  );

  assert.equal(replay.value.currentPublicationStatus, "failed");
  assert.equal(replay.value.latestFailedOutcome?.outcome_id, "outcome-failed-1");
  assert.equal(replay.value.summary.latestFailureCode, "external_rejected");
});

await test("cancelled publication", () => {
  const replay = replaySocialPublicationLedger(
    model({ attempts: [attempt()], outcomes: [cancelledOutcome()] }),
  );

  assert.equal(replay.value.currentPublicationStatus, "cancelled");
  assert.deepEqual(replay.value.summary.cancelledAttemptIds, ["attempt-1"]);
});

await test("evidence aggregation", () => {
  const aggregate = aggregateSocialPublicationLedgerEvidence([
    evidence(),
    evidence({
      evidence_id: "evidence-2",
      evidence_summary: {
        evidenceKind: "operator_note",
        notes: "Reviewed by admin.",
        externalReference: null,
        evidence: {},
        containsFullPayload: false,
        containsFullResponse: false,
        containsSecrets: false,
      },
      recorded_at: "2026-06-30T13:01:02.000Z",
    }),
  ] as never);

  assert.equal(aggregate.totalEvidenceCount, 2);
  assert.equal(aggregate.resultSummaryCount, 1);
  assert.equal(aggregate.operatorNoteCount, 1);
  assert.deepEqual(aggregate.externalReferences, ["facebook-post-1"]);
});

await test("deterministic replay", () => {
  const input = model({
    attempts: [attempt()],
    outcomes: [outcome()],
    evidence: [evidence()],
  });

  const first = replaySocialPublicationLedger(input).value;
  const second = replaySocialPublicationLedger(input).value;

  assert.deepEqual(first, second);
});

await test("ordering validation", () => {
  const diagnostics = generateSocialPublicationLedgerReplayDiagnostics(
    model({
      attempts: [attempt()],
      outcomes: [
        outcome({
          recorded_at: "2026-06-30T12:59:00.000Z",
        }),
      ],
    }),
  );

  assert.equal(codes(diagnostics).includes("invalid_ordering"), true);
});

await test("orphan detection", () => {
  const diagnostics = generateSocialPublicationLedgerReplayDiagnostics(
    model({
      attempts: [],
      outcomes: [outcome()],
      evidence: [evidence()],
    }),
  );

  assert.equal(codes(diagnostics).includes("orphan_outcome"), true);
  assert.equal(codes(diagnostics).includes("orphan_evidence"), true);
});

await test("append-only enforcement", () => {
  const diagnostics = generateSocialPublicationLedgerReplayDiagnostics(
    model({
      attempts: [
        attempt({
          append_only: false,
        }),
      ],
    }),
  );

  assert.equal(codes(diagnostics).includes("append_only_violation"), true);
});

await test("immutable outputs", () => {
  const replay = replaySocialPublicationLedger(model({ attempts: [attempt()] }));

  assert.equal(Object.isFrozen(replay.value), true);
  assert.equal(Object.isFrozen(replay.value.timeline), true);
  assert.throws(() => {
    (replay.value.timeline as unknown[]).push("nope");
  }, TypeError);
});

await test("replay summaries", () => {
  const replay = replaySocialPublicationLedger(
    model({ attempts: [attempt()], outcomes: [outcome()], evidence: [evidence()] }),
  );

  assert.equal(replay.value.summary.computedOnly, true);
  assert.equal(replay.value.summary.publishesNothing, true);
  assert.equal(replay.value.summary.latestOutcomeId, "outcome-1");
});

await test("replay diagnostics", () => {
  const consistency = verifySocialPublicationLedgerReplayConsistency(
    model({
      attempts: [attempt(), attempt({ ledger_entry_id: "ledger-entry-attempt-2" })],
    }),
  );

  assert.equal(consistency.valid, false);
  assert.equal(consistency.diagnosticCount > 0, true);
});

await test("timeline generation is stable", () => {
  const timeline = generateSocialPublicationLedgerReplayTimeline(
    model({
      attempts: [attempt()],
      outcomes: [outcome()],
      evidence: [evidence()],
    }),
  );

  assert.deepEqual(
    timeline.map((event) => event.kind),
    ["attempt", "outcome", "evidence"],
  );
});

await test("module exports no D8 M5 execution automation or persistence behavior", () => {
  const forbidden = [
    "schedulePublication",
    "publishPost",
    "executePublication",
    "retryPublication",
    "recordPublicationMetrics",
    "learnFromPublication",
    "createServiceRoleClient",
  ];

  for (const name of forbidden) {
    assert.equal(name in replayExports, false, name);
  }
});

await test("replay module has no persistence API UI or execution imports", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "social-publication-ledger-replay.ts"),
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
  ];

  for (const fragment of forbiddenFragments) {
    assert.equal(source.includes(fragment), false, fragment);
  }
});
