import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  comparePublicationScheduleIntendedPublishAt,
  hydratePublicationScheduleIntent,
  isPublicationScheduleIntentCompleted,
  isPublicationScheduleIntentOverdue,
  isPublicationScheduleIntentPaused,
  isPublicationScheduleStateTerminal,
  serializePublicationScheduleIntent,
  sortPublicationScheduleIntentsByIntendedPublishAt,
  validatePublicationScheduleIntent,
  type PublicationScheduleIntent,
  type PublicationScheduleJsonObject,
} from "./social-publication-scheduler";
import * as schedulerExports from "./social-publication-scheduler";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function intent(input: Partial<PublicationScheduleIntent> = {}): PublicationScheduleIntent {
  return {
    scheduleId: "schedule-1",
    intentType: "publication_intent",
    state: "active",
    references: {
      socialPostId: "social-post-1",
      publicationTargetId: "target-facebook-page-1",
      publicationManifestId: "manifest-1",
      ownerApprovalId: "owner-approval-1",
      approvalId: "approval-1",
      proposalId: "proposal-1",
    },
    intendedPublishAt: "2026-07-01T12:00:00.000Z",
    readContext: {
      ledgerEntryId: null,
      publicationAttemptId: null,
      sanitizedNotes: "Owner-approved publication intent.",
      sanitizedContext: {},
      containsLowerLayerPayload: false,
      containsSecrets: false,
      containsExecutionPlan: false,
      readsOnly: true,
    },
    actor: "owner",
    source: "publication_scheduler_domain",
    createdAt: "2026-06-30T12:00:00.000Z",
    updatedAt: "2026-06-30T12:00:00.000Z",
    intentOnly: true,
    immutable: true,
    grantsPublishingPermission: false,
    approvesNothing: true,
    publishesNothing: true,
    executesNothing: true,
    schedulesIntentOnly: true,
    mutatesLedger: false,
    mutatesApproval: false,
    mutatesManifest: false,
    mutatesTargets: false,
    recordsNoMetrics: true,
    performsNoLearning: true,
    ...input,
  };
}

function codes(
  result: ReturnType<typeof validatePublicationScheduleIntent>,
): string[] {
  return result.ok ? [] : result.errors.map((error) => error.code);
}

function withSanitizedContext(
  value: PublicationScheduleJsonObject,
): PublicationScheduleIntent {
  return intent({
    readContext: {
      ledgerEntryId: null,
      publicationAttemptId: null,
      sanitizedNotes: null,
      sanitizedContext: value,
      containsLowerLayerPayload: false,
      containsSecrets: false,
      containsExecutionPlan: false,
      readsOnly: true,
    },
  });
}

await test("valid publication intent", () => {
  const result = validatePublicationScheduleIntent(intent());

  assert.equal(result.ok, true);
});

await test("missing ids rejected", () => {
  const result = validatePublicationScheduleIntent(
    intent({
      scheduleId: "",
      references: {
        socialPostId: "",
        publicationTargetId: "",
        publicationManifestId: "",
        ownerApprovalId: "",
        approvalId: "",
        proposalId: "",
      },
      createdAt: "",
      updatedAt: "",
    }),
  );

  assert.deepEqual(codes(result), [
    "schedule_id_required",
    "social_post_id_required",
    "publication_target_id_required",
    "publication_manifest_id_invalid",
    "approval_reference_invalid",
    "approval_reference_invalid",
    "approval_reference_invalid",
    "created_at_required",
    "updated_at_required",
  ]);
});

await test("invalid intended publish time rejected", () => {
  const result = validatePublicationScheduleIntent(
    intent({ intendedPublishAt: "not-a-date" }),
  );

  assert.deepEqual(codes(result), ["intended_publish_at_invalid"]);
});

await test("recursive secret rejection", () => {
  const result = validatePublicationScheduleIntent(
    withSanitizedContext({
      nested: {
        access_token: "secret-token",
      },
    }),
  );

  assert.equal(codes(result).includes("secret_forbidden"), true);
});

await test("recursive execution plan rejection", () => {
  const result = validatePublicationScheduleIntent(
    withSanitizedContext({
      nested: {
        cronExpression: "0 * * * *",
      },
    }),
  );

  assert.equal(codes(result).includes("execution_plan_forbidden"), true);
});

await test("recursive lower-layer payload rejection", () => {
  const result = validatePublicationScheduleIntent(
    withSanitizedContext({
      nested: {
        manifestPayload: { title: "hidden" },
      },
    }),
  );

  assert.equal(codes(result).includes("lower_layer_payload_forbidden"), true);
});

await test("intent invariant rejection", () => {
  const result = validatePublicationScheduleIntent(
    intent({ publishesNothing: false as true }),
  );

  assert.deepEqual(codes(result), ["intent_invariant_failed"]);
});

await test("deterministic sort by intended publish time", () => {
  const sorted = sortPublicationScheduleIntentsByIntendedPublishAt([
    intent({
      scheduleId: "schedule-b",
      intendedPublishAt: "2026-07-02T12:00:00.000Z",
    }),
    intent({
      scheduleId: "schedule-a",
      intendedPublishAt: "2026-07-01T12:00:00.000Z",
    }),
  ]);

  assert.deepEqual(
    sorted.map((item) => item.scheduleId),
    ["schedule-a", "schedule-b"],
  );
});

await test("compare uses schedule id tie-breaker", () => {
  const left = intent({
    scheduleId: "schedule-a",
    intendedPublishAt: "2026-07-01T12:00:00.000Z",
  });
  const right = intent({
    scheduleId: "schedule-b",
    intendedPublishAt: "2026-07-01T12:00:00.000Z",
  });

  assert.equal(comparePublicationScheduleIntendedPublishAt(left, right) < 0, true);
});

await test("overdue detection is active-only", () => {
  const active = intent({
    state: "active",
    intendedPublishAt: "2026-06-30T10:00:00.000Z",
  });
  const paused = intent({
    state: "paused",
    intendedPublishAt: "2026-06-30T10:00:00.000Z",
  });

  assert.equal(
    isPublicationScheduleIntentOverdue(active, "2026-06-30T12:00:00.000Z"),
    true,
  );
  assert.equal(
    isPublicationScheduleIntentOverdue(paused, "2026-06-30T12:00:00.000Z"),
    false,
  );
});

await test("state helpers", () => {
  assert.equal(isPublicationScheduleIntentPaused(intent({ state: "paused" })), true);
  assert.equal(
    isPublicationScheduleIntentCompleted(intent({ state: "completed" })),
    true,
  );
  assert.equal(isPublicationScheduleStateTerminal("completed"), true);
  assert.equal(isPublicationScheduleStateTerminal("active"), false);
});

await test("serialize and hydrate round-trip", () => {
  const serialized = serializePublicationScheduleIntent(intent());
  const hydrated = hydratePublicationScheduleIntent(serialized);

  assert.equal(hydrated.ok, true);
  assert.deepEqual(hydrated.value, intent());
});

await test("forbidden exports are absent", () => {
  const forbidden = [
    "createPublicationSchedulerRepository",
    "publish",
    "publishPost",
    "publishToTarget",
    "recordMetrics",
    "replayPublicationScheduler",
    "runScheduler",
    "schedule",
    "schedulePublication",
    "startAutomation",
    "createD9",
  ];

  for (const name of forbidden) {
    assert.equal(name in schedulerExports, false, name);
  }
});

await test("module has no forbidden imports or implementations", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "social-publication-scheduler.ts",
    ),
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
    "social-publication-ledger-store",
    "setInterval(",
    "setTimeout(",
    "cron(",
    "cron:",
    "publishPost(",
    "schedulePost(",
  ];

  for (const fragment of forbiddenFragments) {
    assert.equal(source.includes(fragment), false, fragment);
  }
});
