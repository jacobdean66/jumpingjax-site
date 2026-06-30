import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  hydratePublicationLedgerMappedEntry,
  mapPublicationLedgerEntryToAttemptRecord,
  mapPublicationLedgerEntryToEvidenceRecord,
  mapPublicationLedgerEntryToOutcomeRecord,
  mapPublicationLedgerEntryToPersistenceRecords,
  previewPublicationLedgerEntryPersistenceMapping,
  publicationLedgerMappedEntriesEqual,
  serializePublicationLedgerMappedEntry,
  validatePublicationLedgerEntryForPersistenceMapping,
  type SocialPublicationLedgerMapperResult,
} from "./social-publication-ledger-mapper";
import * as mapperExports from "./social-publication-ledger-mapper";
import type {
  PublicationLedgerEntry,
  PublicationLedgerEventType,
  PublicationLedgerJsonObject,
} from "./social-publication-ledger";
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

function entry(
  input: Partial<PublicationLedgerEntry> = {},
): PublicationLedgerEntry {
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
  eventType: PublicationLedgerEventType,
  input: Partial<PublicationLedgerEntry> = {},
): PublicationLedgerEntry {
  const success = eventType === "publication_attempt_succeeded" ||
    eventType === "publication_attempt_retry_succeeded";
  const failure = eventType === "publication_attempt_failed" ||
    eventType === "publication_attempt_retry_failed";

  return entry({
    ledgerEntryId: `10000000-0000-4000-8000-0000000000${eventType.length % 10}`,
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
      evidenceKind: success ? "result_summary" : failure ? "error_summary" : "operator_note",
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

function assertOk<T>(result: SocialPublicationLedgerMapperResult<T>): T {
  assert.equal(result.ok, true, JSON.stringify(result.ok ? [] : result.errors));
  return result.value;
}

function codes(result: SocialPublicationLedgerMapperResult<unknown>): string[] {
  return result.ok ? [] : result.errors.map((error) => error.code);
}

await test("attempt event maps to attempt and evidence records", () => {
  const mapped = assertOk(mapPublicationLedgerEntryToPersistenceRecords(entry()));

  assert.equal(mapped.attempt?.event_type, "publication_attempt_started");
  assert.equal(mapped.outcome, null);
  assert.equal(mapped.evidence?.outcome_id, null);
  assert.equal(mapped.attempt?.scope.publication_manifest_id, "manifest-2026-06-30-a");
  assert.equal(Object.isFrozen(mapped), true);
});

await test("retry started maps to attempt family", () => {
  const attempt = assertOk(
    mapPublicationLedgerEntryToAttemptRecord(
      entry({
        eventType: "publication_attempt_retry_started",
        attemptSequence: 1,
      }),
    ),
  );

  assert.equal(attempt.event_type, "publication_attempt_retry_started");
  assert.equal(attempt.attempt_sequence, 1);
});

await test("every outcome event maps to outcome family", () => {
  const eventTypes: PublicationLedgerEventType[] = [
    "publication_attempt_succeeded",
    "publication_attempt_failed",
    "publication_attempt_cancelled",
    "publication_attempt_retry_requested",
    "publication_attempt_retry_succeeded",
    "publication_attempt_retry_failed",
  ];

  for (const eventType of eventTypes) {
    const mapped = assertOk(
      mapPublicationLedgerEntryToPersistenceRecords(outcomeEntry(eventType)),
    );
    assert.equal(mapped.attempt, null);
    assert.equal(mapped.outcome?.event_type, eventType);
    assert.equal(mapped.evidence?.outcome_id, mapped.outcome?.outcome_id);
  }
});

await test("evidence helper rejects entries without evidence", () => {
  const result = mapPublicationLedgerEntryToEvidenceRecord(
    entry({
      evidenceSummary: null,
    }),
  );

  assert.deepEqual(codes(result), ["evidence_summary_required"]);
});

await test("attempt helper rejects outcome events", () => {
  const result = mapPublicationLedgerEntryToAttemptRecord(
    outcomeEntry("publication_attempt_succeeded"),
  );

  assert.deepEqual(codes(result), ["event_family_invalid"]);
});

await test("outcome helper rejects attempt events", () => {
  const result = mapPublicationLedgerEntryToOutcomeRecord(entry());

  assert.deepEqual(codes(result), ["event_family_invalid"]);
});

await test("manifest identity is required for persistence", () => {
  const result = validatePublicationLedgerEntryForPersistenceMapping(
    entry({
      references: {
        ...entry().references,
        publicationManifestId: null,
      },
    }),
  );

  assert.equal(codes(result).includes("manifest_identity_required"), true);
});

await test("target snapshot must match target reference", () => {
  const result = validatePublicationLedgerEntryForPersistenceMapping(
    entry({
      targetSnapshot: targetSnapshot({
        targetId: "60000000-0000-4000-8000-000000000999",
      }),
    }),
  );

  assert.deepEqual(codes(result), ["target_identity_mismatch"]);
});

await test("approval references are preserved", () => {
  const attempt = assertOk(
    mapPublicationLedgerEntryToAttemptRecord(
      entry({
        references: {
          ...entry().references,
          ownerApprovalId: null,
          approvalId: null,
          proposalId: null,
        },
      }),
    ),
  );

  assert.equal(attempt.scope.owner_approval_id, null);
  assert.equal(attempt.scope.approval_id, null);
  assert.equal(attempt.scope.proposal_id, null);
});

await test("successful events require result summaries", () => {
  const result = validatePublicationLedgerEntryForPersistenceMapping(
    outcomeEntry("publication_attempt_succeeded", {
      resultSummary: null,
    }),
  );

  assert.equal(codes(result).includes("result_summary_required"), true);
});

await test("failed events require error summaries", () => {
  const result = validatePublicationLedgerEntryForPersistenceMapping(
    outcomeEntry("publication_attempt_failed", {
      errorSummary: null,
    }),
  );

  assert.equal(codes(result).includes("error_summary_required"), true);
});

await test("attempt sequencing and append-only invariants are validated", () => {
  const sequenceResult = validatePublicationLedgerEntryForPersistenceMapping(
    entry({
      attemptSequence: -1,
    }),
  );
  const invariantResult = validatePublicationLedgerEntryForPersistenceMapping(
    entry({
      appendOnly: false as true,
      immutable: false as true,
    }),
  );

  assert.equal(codes(sequenceResult).includes("domain_validation_failed"), true);
  assert.equal(codes(invariantResult).includes("domain_validation_failed"), true);
});

await test("deterministic mapping returns stable derived identities", () => {
  const left = assertOk(
    mapPublicationLedgerEntryToPersistenceRecords(
      outcomeEntry("publication_attempt_succeeded"),
    ),
  );
  const right = assertOk(
    mapPublicationLedgerEntryToPersistenceRecords(
      outcomeEntry("publication_attempt_succeeded"),
    ),
  );

  assert.equal(left.outcome?.outcome_id, right.outcome?.outcome_id);
  assert.equal(left.evidence?.evidence_id, right.evidence?.evidence_id);
  assert.equal(publicationLedgerMappedEntriesEqual(left, right), true);
});

await test("preview mapping is validation-only and deterministic", () => {
  const preview = assertOk(previewPublicationLedgerEntryPersistenceMapping(entry()));

  assert.equal(preview.persisted, false);
  assert.equal(preview.publishesNothing, true);
  assert.equal(preview.schedulesNothing, true);
  assert.equal(preview.recordsNoMetrics, true);
  assert.equal(preview.performsNoLearning, true);
});

await test("serialization and hydration are deterministic and immutable", () => {
  const mapped = assertOk(
    mapPublicationLedgerEntryToPersistenceRecords(
      outcomeEntry("publication_attempt_succeeded"),
    ),
  );
  const serialized = serializePublicationLedgerMappedEntry(mapped);
  const hydrated = assertOk(hydratePublicationLedgerMappedEntry(serialized));

  assert.equal(serialized, serializePublicationLedgerMappedEntry(hydrated));
  assert.equal(publicationLedgerMappedEntriesEqual(mapped, hydrated), true);
  assert.equal(Object.isFrozen(hydrated), true);
  assert.equal(Object.isFrozen(hydrated.outcome), true);
});

await test("invalid hydration is rejected", () => {
  const result = hydratePublicationLedgerMappedEntry("{not-json");

  assert.deepEqual(codes(result), ["serialization_invalid"]);
});

await test("malformed entries are rejected", () => {
  const result = validatePublicationLedgerEntryForPersistenceMapping({
    ledgerEntryId: "",
  });

  assert.equal(result.ok, false);
  assert.equal(codes(result).includes("domain_validation_failed"), true);
});

await test("recursive unsafe state is rejected", () => {
  const recursive: Record<string, unknown> = {};
  recursive.self = recursive;

  const result = validatePublicationLedgerEntryForPersistenceMapping(
    entry({
      requestSummary: {
        requestId: "request-1",
        operation: "create_post",
        mediaKind: "image",
        payloadSummary: recursive as unknown as PublicationLedgerJsonObject,
        containsFullPayload: false,
        containsSecrets: false,
      },
    }),
  );

  assert.equal(codes(result).includes("domain_validation_failed"), true);
});

await test("forbidden scheduler metrics learning replay authority raw payloads and secrets are rejected", () => {
  const cases: PublicationLedgerEntry[] = [
    entry({
      requestSummary: {
        ...entry().requestSummary!,
        payloadSummary: {
          schedulerState: "queued",
        },
      },
    }),
    entry({
      requestSummary: {
        ...entry().requestSummary!,
        payloadSummary: {
          metrics: {
            impressions: 1,
          },
        },
      },
    }),
    entry({
      requestSummary: {
        ...entry().requestSummary!,
        payloadSummary: {
          learningSignal: "promote",
        },
      },
    }),
    entry({
      requestSummary: {
        ...entry().requestSummary!,
        payloadSummary: {
          currentPublishStatus: "published",
        },
      },
    }),
    entry({
      requestSummary: {
        ...entry().requestSummary!,
        payloadSummary: {
          canPublish: true,
        },
      },
    }),
    entry({
      requestSummary: {
        ...entry().requestSummary!,
        payloadSummary: {
          rawPayload: {
            copied: true,
          },
        },
      },
    }),
    entry({
      requestSummary: {
        ...entry().requestSummary!,
        payloadSummary: {
          accessToken: "secret",
        },
      },
    }),
  ];

  for (const candidate of cases) {
    const result = validatePublicationLedgerEntryForPersistenceMapping(candidate);
    assert.equal(result.ok, false);
  }
});

await test("module exports no store repository replay or execution behavior", () => {
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
    assert.equal(name in mapperExports, false, name);
  }
});

await test("mapper source has no Supabase API UI route or worker implementation", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "social-publication-ledger-mapper.ts"),
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
    "setInterval",
    "cron",
    "schedulePost(",
    "publishPost(",
  ];

  for (const fragment of forbiddenFragments) {
    assert.equal(source.includes(fragment), false, fragment);
  }
});
