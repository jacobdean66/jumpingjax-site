import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  validatePublicationLedgerEntry,
  type PublicationLedgerEntry,
  type PublicationLedgerEventType,
  type PublicationLedgerJsonObject,
} from "./social-publication-ledger";
import * as ledgerExports from "./social-publication-ledger";
import type {
  PublicationTargetCapability,
  PublicationTargetSelectionSnapshot,
} from "./social-publication-targets";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function capability(): PublicationTargetCapability {
  return {
    capabilityKinds: ["image_post", "caption_text"],
    mediaConstraints: {
      supportedMediaTypes: ["image"],
      maxImageCount: 1,
      maxVideoCount: 0,
      maxVideoDurationSeconds: null,
      supportedAspectRatios: ["1:1", "4:5"],
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
  };
}

function targetSnapshot(
  input: Partial<PublicationTargetSelectionSnapshot> = {},
): PublicationTargetSelectionSnapshot {
  return {
    targetId: "target-facebook-page-1",
    platform: "facebook",
    targetType: "facebook_page",
    displayName: "Jumping Jax Facebook Page",
    externalId: "facebook-page-123",
    capabilitySummary: capability(),
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
      socialPostId: "social-post-1",
      proposalId: "proposal-1",
      approvalId: "approval-1",
    },
    ...input,
  };
}

function entry(input: Partial<PublicationLedgerEntry> = {}): PublicationLedgerEntry {
  return {
    ledgerEntryId: "ledger-entry-1",
    publicationAttemptId: "attempt-1",
    eventType: "publication_attempt_started",
    attemptSequence: 0,
    references: {
      socialPostId: "social-post-1",
      publicationTargetId: "target-facebook-page-1",
      publicationManifestId: "manifest-1",
      ownerApprovalId: "owner-approval-1",
      approvalId: "approval-1",
      proposalId: "proposal-1",
    },
    targetSnapshot: targetSnapshot(),
    requestSummary: {
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
    resultSummary: null,
    errorSummary: null,
    evidenceSummary: {
      evidenceKind: "request_summary",
      notes: "Attempt started.",
      externalReference: null,
      evidence: {},
      containsFullPayload: false,
      containsFullResponse: false,
      containsSecrets: false,
    },
    actor: "system",
    source: "publication_ledger_domain",
    createdAt: "2026-06-29T12:00:00.000Z",
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

function codes(result: ReturnType<typeof validatePublicationLedgerEntry>): string[] {
  return result.ok ? [] : result.errors.map((error) => error.code);
}

function withPayloadSummary(
  value: PublicationLedgerJsonObject,
): PublicationLedgerEntry {
  return entry({
    requestSummary: {
      requestId: "request-1",
      operation: "create_post",
      mediaKind: "image",
      payloadSummary: value,
      containsFullPayload: false,
      containsSecrets: false,
    },
  });
}

await test("valid started event", () => {
  const result = validatePublicationLedgerEntry(entry());

  assert.equal(result.ok, true);
});

await test("valid success event", () => {
  const result = validatePublicationLedgerEntry(
    entry({
      eventType: "publication_attempt_succeeded",
      resultSummary: {
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
      evidenceSummary: {
        evidenceKind: "result_summary",
        notes: null,
        externalReference: "facebook-post-1",
        evidence: {},
        containsFullPayload: false,
        containsFullResponse: false,
        containsSecrets: false,
      },
    }),
  );

  assert.equal(result.ok, true);
});

await test("valid failed event", () => {
  const result = validatePublicationLedgerEntry(
    entry({
      eventType: "publication_attempt_failed",
      errorSummary: {
        errorCode: "external_rejected",
        message: "External platform rejected the request.",
        retryable: false,
        errorSummary: {
          category: "validation",
        },
        containsFullResponse: false,
        containsSecrets: false,
      },
      evidenceSummary: {
        evidenceKind: "error_summary",
        notes: "Sanitized external error.",
        externalReference: null,
        evidence: {},
        containsFullPayload: false,
        containsFullResponse: false,
        containsSecrets: false,
      },
    }),
  );

  assert.equal(result.ok, true);
});

await test("valid cancelled event", () => {
  const result = validatePublicationLedgerEntry(
    entry({
      eventType: "publication_attempt_cancelled",
      requestSummary: null,
      evidenceSummary: {
        evidenceKind: "operator_note",
        notes: "Cancelled before external publish.",
        externalReference: null,
        evidence: {},
        containsFullPayload: false,
        containsFullResponse: false,
        containsSecrets: false,
      },
    }),
  );

  assert.equal(result.ok, true);
});

await test("valid retry events", () => {
  const retryTypes: PublicationLedgerEventType[] = [
    "publication_attempt_retry_requested",
    "publication_attempt_retry_started",
    "publication_attempt_retry_succeeded",
    "publication_attempt_retry_failed",
  ];

  for (const eventType of retryTypes) {
    const result = validatePublicationLedgerEntry(
      entry({
        eventType,
        attemptSequence: 1,
        publicationAttemptId: "attempt-1-retry-1",
      }),
    );

    assert.equal(result.ok, true, eventType);
  }
});

await test("unknown event type rejected", () => {
  const result = validatePublicationLedgerEntry(
    entry({
      eventType: "publication_attempt_teleported" as PublicationLedgerEventType,
    }),
  );

  assert.deepEqual(codes(result), ["event_type_unknown"]);
});

await test("missing ids rejected", () => {
  const result = validatePublicationLedgerEntry(
    entry({
      ledgerEntryId: "",
      publicationAttemptId: "",
      references: {
        socialPostId: "",
        publicationTargetId: "",
        publicationManifestId: "",
        ownerApprovalId: "",
        approvalId: "",
        proposalId: "",
      },
      createdAt: "",
    }),
  );

  assert.deepEqual(codes(result), [
    "ledger_entry_id_required",
    "publication_attempt_id_required",
    "social_post_id_required",
    "publication_target_id_required",
    "publication_manifest_id_invalid",
    "approval_reference_invalid",
    "approval_reference_invalid",
    "approval_reference_invalid",
    "created_at_required",
  ]);
});

await test("negative attempt sequence rejected", () => {
  const result = validatePublicationLedgerEntry(entry({ attemptSequence: -1 }));

  assert.deepEqual(codes(result), ["attempt_sequence_invalid"]);
});

await test("recursive secret rejection", () => {
  const result = validatePublicationLedgerEntry(
    withPayloadSummary({
      nested: {
        access_token: "secret-token",
      },
    }),
  );

  assert.deepEqual(codes(result), ["secret_forbidden"]);
});

await test("recursive scheduler state rejection", () => {
  const result = validatePublicationLedgerEntry(
    withPayloadSummary({
      nested: {
        schedulerJobId: "job-1",
      },
    }),
  );

  assert.deepEqual(codes(result), ["scheduler_state_forbidden"]);
});

await test("recursive metrics rejection", () => {
  const result = validatePublicationLedgerEntry(
    withPayloadSummary({
      nested: {
        impressions: 25,
      },
    }),
  );

  assert.deepEqual(codes(result), ["metrics_state_forbidden"]);
});

await test("recursive learning rejection", () => {
  const result = validatePublicationLedgerEntry(
    withPayloadSummary({
      nested: {
        learningSignal: "boost_similar_copy",
      },
    }),
  );

  assert.deepEqual(codes(result), ["learning_state_forbidden"]);
});

await test("duplicate approval state rejection", () => {
  const result = validatePublicationLedgerEntry(
    withPayloadSummary({
      nested: {
        approvalStatus: "approved",
      },
    }),
  );

  assert.deepEqual(codes(result), ["approval_state_forbidden"]);
});

await test("mutable publish state rejected", () => {
  const result = validatePublicationLedgerEntry(
    withPayloadSummary({
      nested: {
        publishStatus: "published",
      },
    }),
  );

  assert.deepEqual(codes(result), ["mutable_publish_state_forbidden"]);
});

await test("target snapshot shape rejected", () => {
  const result = validatePublicationLedgerEntry(
    entry({
      targetSnapshot: targetSnapshot({
        grantsPublishingPermission: true as false,
      }),
    }),
  );

  assert.deepEqual(codes(result), ["target_snapshot_invalid"]);
});

await test("forbidden exports are absent", () => {
  const forbidden = [
    "appendPublicationLedgerEntry",
    "createPublicationLedgerEntry",
    "createPublicationLedgerRepository",
    "publish",
    "publishPost",
    "publishToTarget",
    "recordMetrics",
    "replayPublicationLedger",
    "schedule",
    "schedulePublication",
  ];

  for (const name of forbidden) {
    assert.equal(name in ledgerExports, false, name);
  }
});

await test("module has no forbidden imports or implementations", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "social-publication-ledger.ts"),
    "utf8",
  );
  const forbiddenFragments = [
    "createServiceRoleClient",
    "from(\"",
    "from('",
    "next/",
    "react",
    "@/app",
    "app/api",
    "social-owner-approval-request-flow",
    "social-owner-approval-decision-flow",
    "social-publication-target-store",
    "social-publication-readiness",
    "social-publication-manifest",
    "schedulerJob(",
    "publishPost(",
    "schedulePost(",
  ];

  for (const fragment of forbiddenFragments) {
    assert.equal(source.includes(fragment), false, fragment);
  }
});
