import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  hydratePublicationScheduleMappedIntent,
  mapPublicationScheduleIntentToPersistenceMapping,
  mapPublicationScheduleIntentToScheduleRecord,
  previewPublicationScheduleIntentPersistenceMapping,
  publicationScheduleMappedIntentsEqual,
  serializePublicationScheduleMappedIntent,
  validatePublicationScheduleIntentForPersistenceMapping,
} from "./social-publication-scheduler-mapper";
import * as mapperExports from "./social-publication-scheduler-mapper";
import type { PublicationScheduleIntent } from "./social-publication-scheduler";

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

function assertOk<T>(
  result: { ok: true; value: T } | { ok: false; errors: readonly unknown[] },
): T {
  assert.equal(result.ok, true, JSON.stringify("errors" in result ? result.errors : []));
  return result.value;
}

function codes(
  result: { ok: true } | { ok: false; errors: readonly { code: string }[] },
): string[] {
  return result.ok ? [] : result.errors.map((error) => error.code);
}

await test("valid intent maps to a validated schedule record", () => {
  const record = assertOk(mapPublicationScheduleIntentToScheduleRecord(intent()));

  assert.equal(record.schedule_id, "schedule-1");
  assert.equal(record.scope.social_post_id, "social-post-1");
  assert.equal(Object.isFrozen(record), true);
});

await test("mapped intent carries safety flags and wraps the schedule record", () => {
  const mapped = assertOk(mapPublicationScheduleIntentToPersistenceMapping(intent()));

  assert.equal(mapped.sourceScheduleId, "schedule-1");
  assert.equal(mapped.deterministic, true);
  assert.equal(mapped.persisted, false);
  assert.equal(mapped.publishesNothing, true);
  assert.equal(mapped.executesNothing, true);
  assert.equal(mapped.schedulesIntentOnly, true);
  assert.equal(mapped.mutatesLedger, false);
  assert.equal(mapped.mutatesApproval, false);
  assert.equal(mapped.mutatesManifest, false);
  assert.equal(mapped.mutatesTargets, false);
  assert.equal(mapped.recordsNoMetrics, true);
  assert.equal(mapped.performsNoLearning, true);
  assert.equal(mapped.schedule.schedule_id, "schedule-1");
});

await test("preview mapping matches the direct mapping", () => {
  const mapped = assertOk(mapPublicationScheduleIntentToPersistenceMapping(intent()));
  const preview = assertOk(previewPublicationScheduleIntentPersistenceMapping(intent()));

  assert.equal(publicationScheduleMappedIntentsEqual(mapped, preview), true);
});

await test("invalid domain intent is rejected before mapping", () => {
  const result = mapPublicationScheduleIntentToScheduleRecord(
    intent({ scheduleId: "" }),
  );

  assert.equal(result.ok, false);
  assert.equal(codes(result).includes("domain_validation_failed"), true);
});

await test("timestamp ordering violations are rejected", () => {
  const result = validatePublicationScheduleIntentForPersistenceMapping(
    intent({
      createdAt: "2026-06-30T12:00:00.000Z",
      updatedAt: "2026-06-30T11:00:00.000Z",
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(codes(result).includes("timestamp_ordering_invalid"), true);
});

await test("forbidden mapper state is rejected even if attached via unknown fields", () => {
  const tainted = {
    ...intent(),
    readContext: {
      sanitizedContext: {},
      containsLowerLayerPayload: false,
      containsSecrets: false,
      containsExecutionPlan: false,
      readsOnly: true,
      schedulerAuthority: true,
    },
  };

  const result = mapPublicationScheduleIntentToScheduleRecord(
    tainted as unknown as PublicationScheduleIntent,
  );

  assert.equal(result.ok, false);
  assert.equal(codes(result).includes("domain_validation_failed"), true);
});

await test("serialize and hydrate round-trip preserves equality", () => {
  const mapped = assertOk(mapPublicationScheduleIntentToPersistenceMapping(intent()));
  const serialized = serializePublicationScheduleMappedIntent(mapped);
  const hydrated = assertOk(hydratePublicationScheduleMappedIntent(serialized));

  assert.equal(publicationScheduleMappedIntentsEqual(mapped, hydrated), true);
  assert.equal(Object.isFrozen(hydrated), true);
});

await test("hydrate rejects malformed JSON and shapes", () => {
  const invalidJson = hydratePublicationScheduleMappedIntent("not json");
  const invalidShape = hydratePublicationScheduleMappedIntent(
    JSON.stringify({ sourceScheduleId: "schedule-1" }),
  );

  assert.equal(invalidJson.ok, false);
  assert.equal(invalidShape.ok, false);
});

await test("mapper exposes no execution, publisher, or store implementation", () => {
  const forbidden: readonly (keyof typeof mapperExports | string)[] = [
    "createServiceRoleClient",
    "createSocialPublicationSchedulerStore",
    "runScheduler",
    "publishPost",
    "schedulePublication",
  ];

  for (const name of forbidden) {
    assert.equal(name in mapperExports, false, name);
  }
});

await test("mapper source has no Supabase, cron, or publisher implementation", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "social-publication-scheduler-mapper.ts"),
    "utf8",
  );
  const forbiddenFragments = [
    "createServiceRoleClient",
    "supabase",
    "from(\"",
    "from('",
    "insert(",
    "update(",
    "delete(",
    "select(",
    "next/",
    "react",
    "@/app",
    "app/api",
    "setInterval",
    "setTimeout",
    "publishPost(",
    "schedulePost(",
  ];

  for (const fragment of forbiddenFragments) {
    assert.equal(source.includes(fragment), false, fragment);
  }
});
