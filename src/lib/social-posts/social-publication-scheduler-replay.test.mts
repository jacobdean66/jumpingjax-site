import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  mapPublicationScheduleIntentToScheduleRecord,
  type SocialPublicationSchedulerPersistenceModel,
  type SocialPublicationSchedulerScheduleRecord,
} from "./social-publication-scheduler-repository";
import {
  findCompletedSchedules,
  findNextScheduledPublication,
  findOverdueSchedules,
  findPausedSchedules,
  generateSocialPublicationSchedulerReplayDiagnostics,
  replaySocialPublicationScheduler,
  verifySocialPublicationSchedulerReplayConsistency,
} from "./social-publication-scheduler-replay";
import * as replayExports from "./social-publication-scheduler-replay";
import type { PublicationScheduleIntent } from "./social-publication-scheduler";

type TestFn = () => void | Promise<void>;
type TestRecord = Record<string, unknown>;

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
    readContext: null,
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

function record(input: TestRecord = {}): SocialPublicationSchedulerScheduleRecord {
  return mapPublicationScheduleIntentToScheduleRecord(intent(input as Partial<PublicationScheduleIntent>));
}

function model(
  input: Partial<SocialPublicationSchedulerPersistenceModel> = {},
): SocialPublicationSchedulerPersistenceModel {
  return {
    schedules: [record()],
    ...input,
  };
}

await test("replay finds next scheduled publication", () => {
  const replay = replaySocialPublicationScheduler(
    model({
      schedules: [
        record({ scheduleId: "schedule-later", intendedPublishAt: "2026-07-02T12:00:00.000Z" }),
        record({ scheduleId: "schedule-soon", intendedPublishAt: "2026-07-01T10:00:00.000Z" }),
      ],
    }),
    { asOf: "2026-06-30T12:00:00.000Z" },
  );

  assert.equal(replay.value.nextScheduledPublication?.scheduleId, "schedule-soon");
  assert.equal(replay.value.summary.computedOnly, true);
});

await test("replay finds overdue schedules", () => {
  const replay = replaySocialPublicationScheduler(
    model({
      schedules: [
        record({
          scheduleId: "schedule-overdue",
          intendedPublishAt: "2026-06-29T12:00:00.000Z",
          state: "active",
        }),
      ],
    }),
    { asOf: "2026-06-30T12:00:00.000Z" },
  );

  assert.equal(replay.value.overdueSchedules.length, 1);
  assert.equal(replay.value.overdueSchedules[0]?.scheduleId, "schedule-overdue");
});

await test("replay finds paused and completed schedules", () => {
  const schedules = [
    record({ scheduleId: "schedule-paused", state: "paused" }),
    record({ scheduleId: "schedule-completed", state: "completed" }),
  ];
  const intents = schedules.map((item) =>
    mapPublicationScheduleIntentToScheduleRecord(
      intent({
        scheduleId: item.schedule_id,
        state: item.state,
      }),
    ),
  );

  const paused = findPausedSchedules(
    intents.map((item) =>
      intent({ scheduleId: item.schedule_id, state: item.state }),
    ),
  );
  const completed = findCompletedSchedules(
    intents.map((item) =>
      intent({ scheduleId: item.schedule_id, state: item.state }),
    ),
  );

  assert.equal(paused.length, 1);
  assert.equal(completed.length, 1);
});

await test("helper queries", () => {
  const intents = [
    intent({ scheduleId: "schedule-overdue", intendedPublishAt: "2026-06-29T12:00:00.000Z" }),
    intent({ scheduleId: "schedule-next", intendedPublishAt: "2026-07-02T12:00:00.000Z" }),
  ];
  const asOf = "2026-06-30T12:00:00.000Z";

  assert.equal(findOverdueSchedules(intents, asOf).length, 1);
  assert.equal(findNextScheduledPublication(intents, asOf)?.scheduleId, "schedule-next");
});

await test("replay diagnostics for duplicate ids", () => {
  const diagnostics = generateSocialPublicationSchedulerReplayDiagnostics(
    model({
      schedules: [record(), record({ scheduleId: "schedule-1" })],
    }),
  );

  assert.equal(
    diagnostics.some((diagnostic) => diagnostic.code === "duplicate_identity"),
    true,
  );
});

await test("immutable replay outputs", () => {
  const replay = replaySocialPublicationScheduler(model(), {
    asOf: "2026-06-30T12:00:00.000Z",
  });

  assert.equal(Object.isFrozen(replay.value), true);
  assert.equal(Object.isFrozen(replay.value.overdueSchedules), true);
  assert.throws(() => {
    (replay.value.overdueSchedules as unknown[]).push("nope");
  }, TypeError);
});

await test("replay consistency verification", () => {
  const consistency = verifySocialPublicationSchedulerReplayConsistency(model());

  assert.equal(consistency.valid, true);
  assert.equal(consistency.diagnosticCount >= 0, true);
});

await test("module exports no execution automation or persistence behavior", () => {
  const forbidden = [
    "schedulePublication",
    "publishPost",
    "executePublication",
    "retryPublication",
    "recordPublicationMetrics",
    "learnFromPublication",
    "createSocialPublicationSchedulerRepository",
    "createServiceRoleClient",
    "createD9",
  ];

  for (const name of forbidden) {
    assert.equal(name in replayExports, false, name);
  }
});

await test("module has no forbidden imports or implementations", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "social-publication-scheduler-replay.ts",
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
    "supabase",
    "setInterval(",
    "setTimeout(",
    "publishPost(",
    "schedulePost(",
  ];

  for (const fragment of forbiddenFragments) {
    assert.equal(source.includes(fragment), false, fragment);
  }
});
