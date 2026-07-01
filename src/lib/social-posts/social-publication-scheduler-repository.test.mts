import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  hydrateSocialPublicationSchedulerPersistenceModel,
  mapPublicationScheduleIntentToScheduleRecord,
  serializeSocialPublicationSchedulerPersistenceModel,
  validateSocialPublicationSchedulerAppendRequest,
  validateSocialPublicationSchedulerCreateRequest,
  validateSocialPublicationSchedulerPersistenceModel,
  validateSocialPublicationSchedulerRepositoryIdentity,
  validateSocialPublicationSchedulerScheduleRecord,
  type SocialPublicationSchedulerPersistenceModel,
  type SocialPublicationSchedulerScheduleRecord,
} from "./social-publication-scheduler-repository";
import * as repositoryExports from "./social-publication-scheduler-repository";
import {
  validatePublicationScheduleIntent,
  type PublicationScheduleIntent,
} from "./social-publication-scheduler";

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

await test("valid schedule record", () => {
  const result = validateSocialPublicationSchedulerScheduleRecord(record());

  assert.equal(result.ok, true);
});

await test("create and append request validation", () => {
  const create = validateSocialPublicationSchedulerCreateRequest({ schedule: record() });
  const append = validateSocialPublicationSchedulerAppendRequest({ schedule: record() });

  assert.equal(create.ok, true);
  assert.equal(append.ok, true);
});

await test("repository identity requires a field", () => {
  const result = validateSocialPublicationSchedulerRepositoryIdentity({});

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "identity_required");
  }
});

await test("duplicate schedule ids rejected in model", () => {
  const result = validateSocialPublicationSchedulerPersistenceModel(
    model({
      schedules: [record(), record({ scheduleId: "schedule-1" })],
    }),
  );

  assert.equal(result.ok, false);
});

await test("serialize and hydrate round-trip", () => {
  const serialized = serializeSocialPublicationSchedulerPersistenceModel(model());
  const hydrated = hydrateSocialPublicationSchedulerPersistenceModel(serialized);

  assert.equal(hydrated.ok, true);
});

await test("domain mapping round-trip", () => {
  const mapped = mapPublicationScheduleIntentToScheduleRecord(intent());
  const domainValidation = validatePublicationScheduleIntent(
    intent({ scheduleId: mapped.schedule_id }),
  );

  assert.equal(domainValidation.ok, true);
});

await test("contract-only repository has no implementation factory", () => {
  const forbidden = [
    "createSocialPublicationSchedulerRepository",
    "createPublicationSchedulerRepository",
    "publishPost",
    "schedulePublication",
    "runScheduler",
    "createServiceRoleClient",
    "createD9",
  ];

  for (const name of forbidden) {
    assert.equal(name in repositoryExports, false, name);
  }
});

await test("module has no forbidden imports or implementations", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "social-publication-scheduler-repository.ts",
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
