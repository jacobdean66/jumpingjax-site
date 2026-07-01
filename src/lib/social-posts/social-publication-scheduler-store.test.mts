import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  appendSocialPublicationScheduleIntent,
  configureSocialPublicationSchedulerStoreTestDependencies,
  createSocialPublicationScheduleIntent,
  fetchLatestSocialPublicationScheduleRecordByScheduleId,
  fetchSocialPublicationScheduleRecordsByManifest,
  fetchSocialPublicationScheduleRecordsByPost,
  fetchSocialPublicationScheduleRecordsByPublicationTarget,
  fetchSocialPublicationScheduleRows,
  fetchSocialPublicationScheduleRowsByScheduleId,
  type SocialPublicationSchedulerStoreResult,
  type SocialPublicationSchedulerStoreStorage,
} from "./social-publication-scheduler-store";
import * as storeExports from "./social-publication-scheduler-store";
import { mapPublicationScheduleIntentToScheduleRecord } from "./social-publication-scheduler-mapper";
import type { SocialPublicationSchedulerScheduleRow } from "./social-publication-scheduler-rows";
import type {
  SocialPublicationSchedulerReadFilter,
  SocialPublicationSchedulerScheduleRecord,
} from "./social-publication-scheduler-repository";
import type { PublicationScheduleIntent } from "./social-publication-scheduler";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  configureSocialPublicationSchedulerStoreTestDependencies(null);
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

function assertMapperOk<T>(
  result: { ok: true; value: T } | { ok: false; errors: readonly unknown[] },
): T {
  assert.equal(result.ok, true, JSON.stringify(result.ok ? [] : result.errors));
  return result.value;
}

function record(
  input: Partial<PublicationScheduleIntent> = {},
): SocialPublicationSchedulerScheduleRecord {
  return assertMapperOk(mapPublicationScheduleIntentToScheduleRecord(intent(input)));
}

function assertOk<T>(result: SocialPublicationSchedulerStoreResult<T>): T {
  assert.equal(result.ok, true, JSON.stringify(result.ok ? [] : result.error));
  return result.value;
}

function assertStoreError(
  result: SocialPublicationSchedulerStoreResult<unknown>,
  code: string,
): void {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, code);
}

class MemorySchedulerStorage implements SocialPublicationSchedulerStoreStorage {
  schedules: SocialPublicationSchedulerScheduleRow[] = [];
  throwOnInsert = false;

  async insertSchedule(
    row: SocialPublicationSchedulerScheduleRow,
  ): Promise<SocialPublicationSchedulerScheduleRow> {
    if (this.throwOnInsert) throw new Error("write failed");
    this.schedules.push(clone(row));
    return clone(row);
  }

  async findScheduleByScheduleEntryId(
    scheduleEntryId: string,
  ): Promise<SocialPublicationSchedulerScheduleRow | null> {
    return findOne(this.schedules, "schedule_entry_id", scheduleEntryId);
  }

  async findScheduleByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationSchedulerScheduleRow | null> {
    return findOne(this.schedules, "idempotency_key", idempotencyKey);
  }

  async findLatestScheduleByScheduleId(
    scheduleId: string,
  ): Promise<SocialPublicationSchedulerScheduleRow | null> {
    const matches = this.schedules
      .filter((row) => row.schedule_id === scheduleId)
      .sort((left, right) => Date.parse(right.recorded_at) - Date.parse(left.recorded_at));
    return matches.length > 0 ? clone(matches[0]) : null;
  }

  async fetchSchedules(
    filter: SocialPublicationSchedulerReadFilter = {},
  ): Promise<SocialPublicationSchedulerScheduleRow[]> {
    return this.schedules.filter((row) => matchesFilter(row, filter)).map(clone);
  }
}

await test("create writes the first schedule and append writes subsequent state", async () => {
  const storage = new MemorySchedulerStorage();
  configureSocialPublicationSchedulerStoreTestDependencies(storage);

  const created = assertOk(await createSocialPublicationScheduleIntent(record()));
  assert.equal(created.state, "active");
  assert.equal(storage.schedules.length, 1);

  const appended = assertOk(
    await appendSocialPublicationScheduleIntent(
      record({
        state: "paused",
        createdAt: "2026-06-30T14:00:00.000Z",
        updatedAt: "2026-06-30T14:00:00.000Z",
      }),
    ),
  );
  assert.equal(appended.state, "paused");
  assert.equal(storage.schedules.length, 2);

  const latest = assertOk(
    await fetchLatestSocialPublicationScheduleRecordByScheduleId(IDS.schedule),
  );
  assert.equal(latest?.state, "paused");
});

await test("create rejects a duplicate schedule identity", async () => {
  const storage = new MemorySchedulerStorage();
  configureSocialPublicationSchedulerStoreTestDependencies(storage);

  assertOk(await createSocialPublicationScheduleIntent(record()));
  assertStoreError(await createSocialPublicationScheduleIntent(record()), "duplicate_identity");
});

await test("append rejects a missing parent schedule identity", async () => {
  const storage = new MemorySchedulerStorage();
  configureSocialPublicationSchedulerStoreTestDependencies(storage);

  assertStoreError(
    await appendSocialPublicationScheduleIntent(record()),
    "parent_missing",
  );
});

await test("append rejects scope drift and out-of-order timestamps", async () => {
  const storage = new MemorySchedulerStorage();
  configureSocialPublicationSchedulerStoreTestDependencies(storage);

  assertOk(await createSocialPublicationScheduleIntent(record()));

  assertStoreError(
    await appendSocialPublicationScheduleIntent(
      record({
        references: {
          ...intent().references,
          socialPostId: "50000000-0000-4000-8000-000000000009",
        },
        createdAt: "2026-06-30T14:00:00.000Z",
        updatedAt: "2026-06-30T14:00:00.000Z",
      }),
    ),
    "scope_mismatch",
  );

  assertStoreError(
    await appendSocialPublicationScheduleIntent(
      record({
        createdAt: "2026-06-30T10:00:00.000Z",
        updatedAt: "2026-06-30T10:00:00.000Z",
      }),
    ),
    "ordering_invalid",
  );
});

await test("duplicate idempotency keys are rejected before write", async () => {
  const storage = new MemorySchedulerStorage();
  configureSocialPublicationSchedulerStoreTestDependencies(storage);

  assertOk(
    await createSocialPublicationScheduleIntent(record(), { idempotencyKey: "schedule-key-1" }),
  );
  assertStoreError(
    await appendSocialPublicationScheduleIntent(
      record({
        state: "paused",
        createdAt: "2026-06-30T14:00:00.000Z",
        updatedAt: "2026-06-30T14:00:00.000Z",
      }),
      { idempotencyKey: "schedule-key-1" },
    ),
    "duplicate_idempotency_key",
  );
});

await test("invalid records are rejected before storage access", async () => {
  const storage = new MemorySchedulerStorage();
  configureSocialPublicationSchedulerStoreTestDependencies(storage);

  assertStoreError(
    await createSocialPublicationScheduleIntent({
      ...record(),
      immutable: false,
    } as never),
    "validation_failed",
  );
});

await test("read filters and deterministic ordering are stable", async () => {
  const storage = new MemorySchedulerStorage();
  configureSocialPublicationSchedulerStoreTestDependencies(storage);

  assertOk(await createSocialPublicationScheduleIntent(record()));
  assertOk(
    await appendSocialPublicationScheduleIntent(
      record({
        state: "completed",
        intendedPublishAt: "2026-07-02T12:00:00.000Z",
        createdAt: "2026-06-30T15:00:00.000Z",
        updatedAt: "2026-06-30T15:00:00.000Z",
      }),
    ),
  );

  const rows = assertOk(await fetchSocialPublicationScheduleRowsByScheduleId(IDS.schedule));
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => row.intended_publish_at),
    ["2026-07-01T12:00:00.000Z", "2026-07-02T12:00:00.000Z"],
  );

  const unfilteredRows = assertOk(await fetchSocialPublicationScheduleRows());
  assert.equal(unfilteredRows.length, 2);
  assert.deepEqual(
    unfilteredRows.map((row) => row.schedule_entry_id),
    rows.map((row) => row.schedule_entry_id),
  );

  assert.equal(
    assertOk(await fetchSocialPublicationScheduleRecordsByPost(IDS.socialPost)).length,
    2,
  );
  assert.equal(
    assertOk(await fetchSocialPublicationScheduleRecordsByPublicationTarget(IDS.target)).length,
    2,
  );
  assert.equal(
    assertOk(
      await fetchSocialPublicationScheduleRecordsByManifest("manifest-2026-06-30-a"),
    ).length,
    2,
  );
});

await test("service-role storage and failure handling are explicit", async () => {
  const storage = new MemorySchedulerStorage();
  storage.throwOnInsert = true;
  configureSocialPublicationSchedulerStoreTestDependencies(storage);

  assertStoreError(await createSocialPublicationScheduleIntent(record()), "storage_error");

  const sourcePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "social-publication-scheduler-store.ts",
  );
  const source = readFileSync(sourcePath, "utf8");

  assert.equal(source.includes("createServiceRoleClient"), true);
  assert.equal(source.includes(".update("), false);
  assert.equal(source.includes(".delete("), false);
  assert.equal(source.includes("replaySocialPublicationScheduler"), false);
});

await test("module exports no publisher metrics learning cron or admin behavior", () => {
  const exportedNames = Object.keys(storeExports).sort();
  const forbidden = [
    "publishSocialPost",
    "recordPublicationMetrics",
    "learnFromPublication",
    "runScheduler",
    "renderPublicationSchedulerAdmin",
    "createPublicationSchedulerRoute",
    "createDormant",
  ];

  for (const name of forbidden) {
    assert.equal(exportedNames.includes(name), false, name);
  }
});

await test("store source has no route worker cron replay or UI implementation", () => {
  const sourcePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "social-publication-scheduler-store.ts",
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
    "publisherAuthority",
    "setInterval",
    "setTimeout",
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
  row: SocialPublicationSchedulerScheduleRow,
  filter: SocialPublicationSchedulerReadFilter,
): boolean {
  return (
    (!filter.scheduleId || row.schedule_id === filter.scheduleId) &&
    (!filter.socialPostId || row.social_post_id === filter.socialPostId) &&
    (!filter.publicationTargetId || row.publication_target_id === filter.publicationTargetId) &&
    (!filter.publicationManifestId ||
      row.publication_manifest_id === filter.publicationManifestId) &&
    (!filter.state || row.state === filter.state)
  );
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
