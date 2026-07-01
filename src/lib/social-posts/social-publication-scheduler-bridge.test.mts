import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSocialPublicationSchedulerBridge,
  resolveSocialPublicationSchedulerBridgeMode,
  validateSocialPublicationSchedulerBridgeModel,
  type SocialPublicationSchedulerBridge,
  type SocialPublicationSchedulerBridgeResult,
} from "./social-publication-scheduler-bridge";
import * as bridgeExports from "./social-publication-scheduler-bridge";
import { mapPublicationScheduleIntentToScheduleRecord } from "./social-publication-scheduler-mapper";
import type {
  SocialPublicationSchedulerPersistenceModel,
  SocialPublicationSchedulerScheduleRecord,
} from "./social-publication-scheduler-repository";
import type { PublicationScheduleIntent } from "./social-publication-scheduler";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

const IDS = {
  schedule: "20000000-0000-4000-8000-000000000001",
  socialPost: "50000000-0000-4000-8000-000000000001",
  target: "60000000-0000-4000-8000-000000000001",
  ownerApproval: "70000000-0000-4000-8000-000000000001",
  approval: "70000000-0000-4000-8000-000000000002",
  proposal: "70000000-0000-4000-8000-000000000003",
} as const;

function intent(input: Partial<PublicationScheduleIntent> = {}): PublicationScheduleIntent {
  return {
    scheduleId: IDS.schedule,
    intentType: "publication_intent",
    state: "active",
    references: {
      socialPostId: IDS.socialPost,
      publicationTargetId: IDS.target,
      publicationManifestId: "manifest-2026-06-30-a",
      ownerApprovalId: IDS.ownerApproval,
      approvalId: IDS.approval,
      proposalId: IDS.proposal,
    },
    intendedPublishAt: "2026-07-01T12:00:00.000Z",
    readContext: null,
    actor: "owner",
    source: "publication_scheduler_domain",
    createdAt: "2026-06-30T13:00:00.000Z",
    updatedAt: "2026-06-30T13:00:00.000Z",
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

function record(
  input: Partial<PublicationScheduleIntent> = {},
): SocialPublicationSchedulerScheduleRecord {
  const mapped = mapPublicationScheduleIntentToScheduleRecord(intent(input));
  assert.equal(mapped.ok, true, JSON.stringify(mapped.ok ? [] : mapped.errors));
  return mapped.value;
}

function assertOk<T>(result: SocialPublicationSchedulerBridgeResult<T>): T {
  assert.equal(result.ok, true, JSON.stringify(result.ok ? [] : result.error));
  return result.value;
}

function assertBridgeError(
  result: SocialPublicationSchedulerBridgeResult<unknown>,
  code: string,
): void {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, code);
}

function productionDouble(): {
  implementation: SocialPublicationSchedulerBridge;
  calls: string[];
  model: SocialPublicationSchedulerPersistenceModel;
} {
  const calls: string[] = [];
  const model: { schedules: SocialPublicationSchedulerScheduleRecord[] } = {
    schedules: [],
  };

  const implementation: SocialPublicationSchedulerBridge = {
    mode: "production",
    async createScheduleIntent(schedule) {
      calls.push("createScheduleIntent");
      model.schedules = [...model.schedules, clone(schedule)];
      return { ok: true, value: clone(schedule) };
    },
    async appendScheduleIntent(schedule) {
      calls.push("appendScheduleIntent");
      model.schedules = [...model.schedules, clone(schedule)];
      return { ok: true, value: clone(schedule) };
    },
    async listScheduleIntents() {
      calls.push("listScheduleIntents");
      return { ok: true, value: clone(model.schedules) };
    },
    async loadByIdentity() {
      calls.push("loadByIdentity");
      return { ok: true, value: clone(model) };
    },
  };

  return { implementation, calls, model };
}

await test("reference implementation is selected for test environment", async () => {
  const bridge = assertOk(
    createSocialPublicationSchedulerBridge({
      mode: "environment",
      runtimeEnvironment: "test",
    }),
  );

  assert.equal(bridge.mode, "reference");
  assert.equal(Object.isFrozen(bridge), true);
  assert.equal(
    assertOk(
      resolveSocialPublicationSchedulerBridgeMode({
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
    createSocialPublicationSchedulerBridge({
      mode: "production",
      runtimeEnvironment: "production",
      productionStoreConfigured: true,
      implementation,
    }),
  );

  assert.equal(bridge.mode, "production");
  assertOk(await bridge.createScheduleIntent(record()));
  assert.deepEqual(calls, ["createScheduleIntent"]);
});

await test("missing production dependency and unsafe fallback are rejected", () => {
  assertBridgeError(
    createSocialPublicationSchedulerBridge({
      mode: "production",
      runtimeEnvironment: "production",
      productionStoreConfigured: false,
    }),
    "production_unavailable",
  );
  assertBridgeError(
    createSocialPublicationSchedulerBridge({
      mode: "reference",
      runtimeEnvironment: "production",
    }),
    "unsafe_reference_in_production",
  );
  assertBridgeError(
    createSocialPublicationSchedulerBridge({
      mode: "environment",
      runtimeEnvironment: "production",
      productionStoreConfigured: false,
    }),
    "production_unavailable",
  );
});

await test("reference bridge creates appends lists and loads deterministically", async () => {
  const bridge = assertOk(
    createSocialPublicationSchedulerBridge({
      mode: "reference",
      runtimeEnvironment: "test",
    }),
  );

  assert.equal(assertOk(await bridge.createScheduleIntent(record())).state, "active");
  assert.equal(
    assertOk(
      await bridge.appendScheduleIntent(
        record({
          state: "paused",
          createdAt: "2026-06-30T14:00:00.000Z",
          updatedAt: "2026-06-30T14:00:00.000Z",
        }),
      ),
    ).state,
    "paused",
  );

  assert.deepEqual(
    assertOk(await bridge.listScheduleIntents()).map((schedule) => schedule.state),
    ["active", "paused"],
  );
  assert.equal(
    assertOk(await bridge.loadByIdentity({ social_post_id: IDS.socialPost })).schedules.length,
    2,
  );
  assert.equal(
    Object.isFrozen(assertOk(await bridge.listScheduleIntents())[0]),
    true,
  );
});

await test("reference bridge rejects duplicates invalid appends and invalid identities", async () => {
  const bridge = assertOk(
    createSocialPublicationSchedulerBridge({
      mode: "reference",
      runtimeEnvironment: "test",
    }),
  );

  assertOk(await bridge.createScheduleIntent(record()));
  assertBridgeError(await bridge.createScheduleIntent(record()), "identity_collision");
  assertBridgeError(
    await bridge.appendScheduleIntent(
      record({
        references: {
          ...intent().references,
          publicationTargetId: "60000000-0000-4000-8000-000000000009",
        },
        createdAt: "2026-06-30T14:00:00.000Z",
        updatedAt: "2026-06-30T14:00:00.000Z",
      }),
    ),
    "relationship_invalid",
  );
  assertBridgeError(await bridge.loadByIdentity({}), "validation_failed");
});

await test("production bridge routes all operations to selected implementation", async () => {
  const { implementation, calls } = productionDouble();
  const bridge = assertOk(
    createSocialPublicationSchedulerBridge({
      mode: "production",
      runtimeEnvironment: "production",
      productionStoreConfigured: true,
      implementation,
    }),
  );

  await bridge.createScheduleIntent(record());
  await bridge.appendScheduleIntent(record({ state: "paused" }));
  await bridge.listScheduleIntents({ socialPostId: IDS.socialPost });
  await bridge.loadByIdentity({ schedule_id: IDS.schedule });

  assert.deepEqual(calls, [
    "createScheduleIntent",
    "appendScheduleIntent",
    "listScheduleIntents",
    "loadByIdentity",
  ]);
});

await test("errors propagate without fallback or dual storage access", async () => {
  let productionCalls = 0;
  const implementation: SocialPublicationSchedulerBridge = {
    ...productionDouble().implementation,
    mode: "production",
    async listScheduleIntents() {
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
    createSocialPublicationSchedulerBridge({
      mode: "production",
      runtimeEnvironment: "production",
      productionStoreConfigured: true,
      implementation,
    }),
  );

  assertBridgeError(await bridge.listScheduleIntents(), "storage_error");
  assert.equal(productionCalls, 1);
});

await test("validation rejects invalid model and invalid schedule input", async () => {
  const bridge = assertOk(
    createSocialPublicationSchedulerBridge({
      mode: "reference",
      runtimeEnvironment: "test",
    }),
  );

  assertBridgeError(
    await bridge.createScheduleIntent({
      ...record(),
      executes_nothing: false,
    } as never),
    "validation_failed",
  );
  assertBridgeError(
    validateSocialPublicationSchedulerBridgeModel({ schedules: [record(), record()] }),
    "validation_failed",
  );
});

await test("module exports no execution publisher metrics learning admin or API behavior", () => {
  const exportedNames = Object.keys(bridgeExports).sort();
  const forbidden = [
    "runScheduler",
    "executeSchedule",
    "publishSocialPost",
    "recordPublicationMetrics",
    "learnFromPublication",
    "renderPublicationSchedulerAdmin",
    "createPublicationSchedulerRoute",
  ];

  for (const name of forbidden) {
    assert.equal(exportedNames.includes(name), false, name);
  }
});

await test("bridge source has no schema route worker cron publisher replay or UI behavior", () => {
  const sourcePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "social-publication-scheduler-bridge.ts",
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
    "setInterval",
    "setTimeout",
    "publishSocialPost",
    "recordPublicationMetrics",
    "learnFromPublication",
    "replaySocialPublicationScheduler",
  ];

  for (const snippet of forbiddenSnippets) {
    assert.equal(source.includes(snippet), false, snippet);
  }
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
