import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDormantPublicationLedgerMetricsBoundaryAdapter,
  createDormantPublicationLedgerSchedulerBoundaryAdapter,
  hydrateSocialPublicationLedgerIntegrationRequest,
  serializeSocialPublicationLedgerIntegrationRequest,
  validateSocialPublicationLedgerBoundaryResponse,
  validateSocialPublicationLedgerIntegrationRequest,
  type SocialPublicationLedgerIntegrationValidationResult,
} from "./social-publication-ledger-integration-boundary";
import * as boundaryExports from "./social-publication-ledger-integration-boundary";

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
    recorded_by_actor: "scheduler",
    recorded_source: "future_scheduler",
    append_only: true,
    immutable: true,
    ...input,
  };
}

function evidence(input: TestRecord = {}): TestRecord {
  return {
    evidence_id: "evidence-1",
    ledger_entry_id: "ledger-entry-evidence-1",
    publication_attempt_id: "attempt-1",
    outcome_id: "outcome-1",
    scope: scope(),
    evidence_summary: {
      evidenceKind: "operator_note",
      notes: "Sanitized future metrics evidence.",
      externalReference: "metrics-observation-1",
      evidence: {
        observationType: "visibility",
      },
      containsFullPayload: false,
      containsFullResponse: false,
      containsSecrets: false,
    },
    recorded_at: "2026-06-30T13:02:00.000Z",
    recorded_by_actor: "system",
    recorded_source: "test",
    append_only: true,
    immutable: true,
    ...input,
  };
}

function schedulerRequest(input: TestRecord = {}): TestRecord {
  return {
    kind: "future_scheduler",
    identity: {
      integrationRequestId: "scheduler-boundary-1",
      ledgerEntryId: "ledger-entry-outcome-1",
      publicationAttemptId: "attempt-1",
      outcomeId: "outcome-1",
      evidenceId: null,
    },
    scope: scope(),
    audit: {
      requestedAt: "2026-06-30T13:01:00.000Z",
      requestedBy: "future_scheduler",
      idempotencyKey: "scheduler-boundary-1",
    },
    proposedOutcome: outcome(),
    schedulerContext: {
      intent: "record_attempt_outcome",
      schedulerReference: "future-scheduler-job-1",
      sanitizedContext: {
        reason: "future boundary validation",
      },
      containsExecutionPlan: false,
      containsSecrets: false,
      executesNothing: true,
      schedulesNothing: true,
      publishesNothing: true,
    },
    appendOnly: true,
    immutable: true,
    futureCompatible: true,
    grantsAuthority: false,
    ...input,
  };
}

function metricsRequest(input: TestRecord = {}): TestRecord {
  return {
    kind: "future_metrics",
    identity: {
      integrationRequestId: "metrics-boundary-1",
      ledgerEntryId: "ledger-entry-evidence-1",
      publicationAttemptId: "attempt-1",
      outcomeId: "outcome-1",
      evidenceId: "evidence-1",
    },
    scope: scope(),
    audit: {
      requestedAt: "2026-06-30T13:02:00.000Z",
      requestedBy: "future_metrics",
      idempotencyKey: "metrics-boundary-1",
    },
    proposedEvidence: evidence(),
    metricsContext: {
      intent: "record_sanitized_evidence",
      observationReference: "metrics-observation-1",
      sanitizedObservation: {
        observationType: "visibility",
      },
      containsRawMetrics: false,
      containsSecrets: false,
      recordsNoMetrics: true,
      performsNoLearning: true,
    },
    appendOnly: true,
    immutable: true,
    futureCompatible: true,
    grantsAuthority: false,
    ...input,
  };
}

function codes(result: SocialPublicationLedgerIntegrationValidationResult): string[] {
  return result.ok ? [] : result.errors.map((error) => error.code);
}

await test("scheduler contract validation", () => {
  const result = validateSocialPublicationLedgerIntegrationRequest(
    schedulerRequest(),
  );

  assert.equal(result.ok, true);
});

await test("metrics contract validation", () => {
  const result = validateSocialPublicationLedgerIntegrationRequest(metricsRequest());

  assert.equal(result.ok, true);
});

await test("immutable DTOs from dormant adapters", () => {
  const adapter = createDormantPublicationLedgerSchedulerBoundaryAdapter();
  const result = adapter.previewResponse(schedulerRequest() as never);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(Object.isFrozen(result.value), true);
    assert.equal(result.value.persisted, false);
    assert.equal(result.value.executed, false);
  }
});

await test("metrics dormant adapter", () => {
  const adapter = createDormantPublicationLedgerMetricsBoundaryAdapter();
  const result = adapter.previewResponse(metricsRequest() as never);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.metricsCollected, false);
    assert.equal(result.value.learningPerformed, false);
  }
});

await test("serialization is deterministic", () => {
  const first = serializeSocialPublicationLedgerIntegrationRequest(
    schedulerRequest() as never,
  );
  const second = serializeSocialPublicationLedgerIntegrationRequest(
    schedulerRequest() as never,
  );
  const hydrated = hydrateSocialPublicationLedgerIntegrationRequest(first);

  assert.equal(first, second);
  assert.equal(hydrated.ok, true);
  if (hydrated.ok) assert.equal(Object.isFrozen(hydrated.value), true);
});

await test("invalid identities rejected", () => {
  const result = validateSocialPublicationLedgerIntegrationRequest(
    schedulerRequest({
      identity: {
        integrationRequestId: "same",
        ledgerEntryId: "same",
        publicationAttemptId: "attempt-1",
        outcomeId: "outcome-1",
        evidenceId: null,
      },
    }),
  );

  assert.equal(codes(result).includes("identity_invalid"), true);
});

await test("invalid request shape rejected", () => {
  const result = validateSocialPublicationLedgerIntegrationRequest(null);

  assert.deepEqual(codes(result), ["request_invalid"]);
});

await test("append-only protection", () => {
  const result = validateSocialPublicationLedgerIntegrationRequest(
    schedulerRequest({
      appendOnly: false,
    }),
  );

  assert.equal(codes(result).includes("future_compatibility_invalid"), true);
});

await test("authority rejection", () => {
  const result = validateSocialPublicationLedgerIntegrationRequest(
    metricsRequest({
      metricsContext: {
        intent: "record_sanitized_evidence",
        observationReference: "metrics-observation-1",
        sanitizedObservation: {
          canPublish: true,
        },
        containsRawMetrics: false,
        containsSecrets: false,
        recordsNoMetrics: true,
        performsNoLearning: true,
      },
    }),
  );

  assert.equal(codes(result).includes("authority_violation"), true);
});

await test("recursive unsafe state rejection", () => {
  const recursive: Record<string, unknown> = {};
  recursive.self = recursive;
  const result = validateSocialPublicationLedgerIntegrationRequest(
    metricsRequest({
      metricsContext: {
        intent: "record_sanitized_evidence",
        observationReference: "metrics-observation-1",
        sanitizedObservation: recursive,
        containsRawMetrics: false,
        containsSecrets: false,
        recordsNoMetrics: true,
        performsNoLearning: true,
      },
    }),
  );

  assert.equal(codes(result).includes("unsafe_recursive_state_forbidden"), true);
});

await test("computed state rejection", () => {
  const result = validateSocialPublicationLedgerIntegrationRequest(
    schedulerRequest({
      schedulerContext: {
        intent: "record_attempt_outcome",
        schedulerReference: null,
        sanitizedContext: {
          publishStatus: "published",
        },
        containsExecutionPlan: false,
        containsSecrets: false,
        executesNothing: true,
        schedulesNothing: true,
        publishesNothing: true,
      },
    }),
  );

  assert.equal(codes(result).includes("computed_state_forbidden"), true);
});

await test("raw payload rejection", () => {
  const result = validateSocialPublicationLedgerIntegrationRequest(
    metricsRequest({
      metricsContext: {
        intent: "record_sanitized_evidence",
        observationReference: null,
        sanitizedObservation: {
          rawMetrics: {
            impressions: 100,
          },
        },
        containsRawMetrics: false,
        containsSecrets: false,
        recordsNoMetrics: true,
        performsNoLearning: true,
      },
    }),
  );

  assert.equal(codes(result).includes("lower_layer_payload_forbidden"), true);
});

await test("boundary response validation", () => {
  const adapter = createDormantPublicationLedgerMetricsBoundaryAdapter();
  const response = adapter.previewResponse(metricsRequest() as never);

  assert.equal(response.ok, true);
  if (response.ok) {
    const validation = validateSocialPublicationLedgerBoundaryResponse(
      response.value,
    );
    assert.equal(validation.ok, true);
  }
});

await test("invalid boundary response rejected", () => {
  const result = validateSocialPublicationLedgerBoundaryResponse({
    accepted: true,
    kind: "future_scheduler",
    integrationRequestId: "scheduler-boundary-1",
    ledgerEntryId: "ledger-entry-outcome-1",
    publicationAttemptId: "attempt-1",
    outcomeId: "outcome-1",
    evidenceId: null,
    validationOnly: true,
    persisted: true,
    executed: false,
    scheduled: false,
    published: false,
    metricsCollected: false,
    learningPerformed: false,
    computedOnly: true,
    authoritative: false,
  });

  assert.deepEqual(codes(result), ["response_invalid"]);
});

await test("absence of scheduler metrics execution and D9 behavior", () => {
  const forbidden = [
    "runScheduler",
    "schedulePublication",
    "collectMetrics",
    "recordMetrics",
    "publishPost",
    "executePublication",
    "retryPublication",
    "startAutomation",
    "createD9",
  ];

  for (const name of forbidden) {
    assert.equal(name in boundaryExports, false, name);
  }
});

await test("module has no persistence execution api or worker implementation", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "social-publication-ledger-integration-boundary.ts",
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
    "app/api",
    "fetch(",
    "cron",
    "worker",
    "setInterval",
    "setTimeout",
    "publishPost(",
    "schedulePost(",
  ];

  for (const fragment of forbiddenFragments) {
    assert.equal(source.includes(fragment), false, fragment);
  }
});
