import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  hydrateSocialPublicationSchedulerRowsModel,
  mapSocialPublicationSchedulerRowsToPersistenceModel,
  mapSocialPublicationSchedulerScheduleRecordToRow,
  mapSocialPublicationSchedulerScheduleRowToRecord,
  serializeSocialPublicationSchedulerRowsModel,
  validateSocialPublicationSchedulerRowsModel,
  validateSocialPublicationSchedulerScheduleRow,
  type SocialPublicationSchedulerRowValidationResult,
  type SocialPublicationSchedulerRowsModel,
  type SocialPublicationSchedulerScheduleRow,
} from "./social-publication-scheduler-rows";
import * as rowExports from "./social-publication-scheduler-rows";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

const IDS = {
  scheduleEntry: "10000000-0000-4000-8000-000000000001",
  schedule: "20000000-0000-4000-8000-000000000001",
  socialPost: "50000000-0000-4000-8000-000000000001",
  target: "60000000-0000-4000-8000-000000000001",
  ownerApproval: "70000000-0000-4000-8000-000000000001",
  approval: "70000000-0000-4000-8000-000000000002",
  proposal: "70000000-0000-4000-8000-000000000003",
} as const;

function scheduleRow(
  input: Partial<SocialPublicationSchedulerScheduleRow> = {},
): SocialPublicationSchedulerScheduleRow {
  return {
    schedule_entry_id: IDS.scheduleEntry,
    schedule_id: IDS.schedule,
    intent_type: "publication_intent",
    state: "active",
    social_post_id: IDS.socialPost,
    publication_target_id: IDS.target,
    publication_manifest_id: "manifest-2026-06-30-a",
    owner_approval_id: IDS.ownerApproval,
    approval_id: IDS.approval,
    proposal_id: IDS.proposal,
    intended_publish_at: "2026-07-01T12:00:00.000Z",
    read_context: null,
    recorded_at: "2026-06-30T13:00:00.000Z",
    updated_at: "2026-06-30T13:00:00.000Z",
    recorded_by_actor: "owner",
    recorded_source: "publication_scheduler_domain",
    intent_only: true,
    immutable: true,
    grants_publishing_permission: false,
    approves_nothing: true,
    publishes_nothing: true,
    executes_nothing: true,
    schedules_intent_only: true,
    mutates_ledger: false,
    mutates_approval: false,
    mutates_manifest: false,
    mutates_targets: false,
    records_no_metrics: true,
    performs_no_learning: true,
    idempotency_key: "schedule-key-1",
    ...input,
  };
}

function rows(
  input: Partial<SocialPublicationSchedulerRowsModel> = {},
): SocialPublicationSchedulerRowsModel {
  return {
    schedules: input.schedules ?? [scheduleRow()],
  };
}

function assertOk<T>(
  result: { ok: true; value: T } | { ok: false; errors: readonly unknown[] },
): T {
  assert.equal(result.ok, true, JSON.stringify("errors" in result ? result.errors : []));
  return result.value;
}

function codes(result: SocialPublicationSchedulerRowValidationResult): string[] {
  return result.ok ? [] : result.errors.map((error) => error.code);
}

await test("valid schedule row maps to persistence record and back", () => {
  const row = scheduleRow();
  const record = assertOk(mapSocialPublicationSchedulerScheduleRowToRecord(row));
  const roundTrip = assertOk(
    mapSocialPublicationSchedulerScheduleRecordToRow(record, {
      schedule_entry_id: row.schedule_entry_id,
      idempotency_key: row.idempotency_key,
    }),
  );

  assert.deepEqual(roundTrip, row);
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(roundTrip), true);
});

await test("rows model maps to D9 H10 persistence model", () => {
  const model = assertOk(mapSocialPublicationSchedulerRowsToPersistenceModel(rows()));

  assert.equal(model.schedules.length, 1);
  assert.equal(model.schedules[0]?.scope.publication_manifest_id, "manifest-2026-06-30-a");
});

await test("nullable references are preserved", () => {
  const row = scheduleRow({
    publication_manifest_id: null,
    owner_approval_id: null,
    approval_id: null,
    proposal_id: null,
  });
  const record = assertOk(mapSocialPublicationSchedulerScheduleRowToRecord(row));
  const roundTrip = assertOk(
    mapSocialPublicationSchedulerScheduleRecordToRow(record, {
      schedule_entry_id: row.schedule_entry_id,
    }),
  );

  assert.equal(record.scope.publication_manifest_id, null);
  assert.equal(roundTrip.owner_approval_id, null);
  assert.equal(roundTrip.idempotency_key, null);
});

await test("schedule_entry_id is deterministic when not supplied", () => {
  const record = assertOk(
    mapSocialPublicationSchedulerScheduleRowToRecord(scheduleRow()),
  );
  const first = assertOk(mapSocialPublicationSchedulerScheduleRecordToRow(record));
  const second = assertOk(mapSocialPublicationSchedulerScheduleRecordToRow(record));

  assert.equal(first.schedule_entry_id, second.schedule_entry_id);
  assert.notEqual(first.schedule_entry_id, record.schedule_id);
});

await test("invalid IDs are rejected", () => {
  const result = validateSocialPublicationSchedulerScheduleRow(
    scheduleRow({
      schedule_entry_id: "not-a-uuid",
      schedule_id: "",
      social_post_id: "also-not-a-uuid",
    }),
  );

  assert.equal(codes(result).includes("identity_invalid"), true);
  assert.equal(codes(result).includes("required_field_missing"), true);
});

await test("unsupported intent type and state are rejected", () => {
  const intentTypeResult = validateSocialPublicationSchedulerScheduleRow(
    scheduleRow({ intent_type: "unsupported_intent" }),
  );
  const stateResult = validateSocialPublicationSchedulerScheduleRow(
    scheduleRow({ state: "unsupported_state" }),
  );

  assert.equal(codes(intentTypeResult).includes("intent_type_invalid"), true);
  assert.equal(codes(stateResult).includes("state_invalid"), true);
});

await test("invalid intended publish timestamps are rejected", () => {
  const result = validateSocialPublicationSchedulerScheduleRow(
    scheduleRow({ intended_publish_at: "not-a-timestamp" }),
  );

  assert.equal(codes(result).includes("intended_publish_at_invalid"), true);
});

await test("intent invariants must remain intent-only and non-authoritative", () => {
  const result = validateSocialPublicationSchedulerScheduleRow(
    scheduleRow({ grants_publishing_permission: true }),
  );

  assert.equal(codes(result).includes("append_only_invariant_failed"), true);
});

await test("invalid idempotency keys are rejected", () => {
  const result = validateSocialPublicationSchedulerScheduleRow(
    scheduleRow({ idempotency_key: "" }),
  );

  assert.deepEqual(codes(result), ["idempotency_key_invalid"]);
});

await test("identity collisions across scope fields are rejected", () => {
  const result = validateSocialPublicationSchedulerScheduleRow(
    scheduleRow({ publication_target_id: IDS.socialPost }),
  );

  assert.equal(codes(result).includes("identity_not_separated"), true);
});

await test("malformed read context is rejected", () => {
  const result = validateSocialPublicationSchedulerScheduleRow({
    ...scheduleRow(),
    read_context: ["not", "an", "object"],
  });

  assert.equal(codes(result).includes("summary_shape_invalid"), true);
});

await test("recursive read context is rejected", () => {
  const recursive: Record<string, unknown> = {};
  recursive.self = recursive;
  const result = validateSocialPublicationSchedulerScheduleRow({
    ...scheduleRow(),
    read_context: recursive,
  });

  assert.equal(codes(result).includes("unsafe_recursive_state_forbidden"), true);
});

await test("execution and cron state is rejected", () => {
  const result = validateSocialPublicationSchedulerScheduleRow({
    ...scheduleRow(),
    read_context: {
      sanitizedContext: {},
      cronExpression: "* * * * *",
      containsLowerLayerPayload: false,
      containsSecrets: false,
      containsExecutionPlan: false,
      readsOnly: true,
    },
  });

  assert.equal(codes(result).includes("execution_plan_forbidden"), true);
});

await test("publish authority state is rejected", () => {
  const result = validateSocialPublicationSchedulerScheduleRow({
    ...scheduleRow(),
    read_context: {
      sanitizedContext: {},
      grantsPublishingPermission: true,
      containsLowerLayerPayload: false,
      containsSecrets: false,
      containsExecutionPlan: false,
      readsOnly: true,
    },
  });

  assert.equal(codes(result).includes("publish_authority_forbidden"), true);
});

await test("duplicate schedule entry ids rejected at model level", () => {
  const result = validateSocialPublicationSchedulerRowsModel(
    rows({
      schedules: [scheduleRow(), scheduleRow()],
    }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errors.some((error) => error.code === "identity_not_separated"), true);
  }
});

await test("serialize and hydrate round-trip", () => {
  const serialized = serializeSocialPublicationSchedulerRowsModel(rows());
  const hydrated = hydrateSocialPublicationSchedulerRowsModel(serialized);

  const value = assertOk(hydrated);
  assert.equal(value.schedules.length, 1);
  assert.equal(Object.isFrozen(value), true);
});

await test("hydrate rejects invalid JSON", () => {
  const result = hydrateSocialPublicationSchedulerRowsModel("not json");

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      result.errors.map((error) => error.code),
      ["serialization_invalid"],
    );
  }
});

await test("rows module has no Supabase, execution, or bridge implementation", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "social-publication-scheduler-rows.ts"),
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

await test("rows module exposes no repository or store factory", () => {
  const forbidden = [
    "createSocialPublicationSchedulerRepository",
    "createSocialPublicationSchedulerStore",
    "createServiceRoleClient",
    "publishPost",
    "schedulePublication",
  ];

  for (const name of forbidden) {
    assert.equal(name in rowExports, false, name);
  }
});
