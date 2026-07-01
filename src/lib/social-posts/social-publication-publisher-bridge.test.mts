import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSocialPublicationPublisherBridge,
  resolveSocialPublicationPublisherBridgeMode,
  validateSocialPublicationPublisherBridgeModel,
  type SocialPublicationPublisherBridge,
  type SocialPublicationPublisherBridgeResult,
} from "./social-publication-publisher-bridge";
import * as bridgeExports from "./social-publication-publisher-bridge";
import type {
  SocialPublicationPublisherPersistenceModel,
  SocialPublicationPublisherRequestRecord,
  SocialPublicationPublisherResultRecord,
} from "./social-publication-publisher-repository";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

const IDS = {
  request: "10000000-0000-4000-8000-000000000001",
  job: "10000000-0000-4000-8000-000000000002",
  result: "10000000-0000-4000-8000-000000000003",
  socialPost: "50000000-0000-4000-8000-000000000001",
  target: "60000000-0000-4000-8000-000000000001",
  schedule: "20000000-0000-4000-8000-000000000001",
  ledgerEntry: "30000000-0000-4000-8000-000000000001",
  attempt: "30000000-0000-4000-8000-000000000002",
  ownerApproval: "70000000-0000-4000-8000-000000000001",
  approval: "70000000-0000-4000-8000-000000000002",
  proposal: "70000000-0000-4000-8000-000000000003",
} as const;

function scope(): SocialPublicationPublisherRequestRecord["scope"] {
  return {
    social_post_id: IDS.socialPost as never,
    publication_target_id: IDS.target as never,
    publication_manifest_id: "manifest-2026-07-01-a" as never,
    schedule_id: IDS.schedule as never,
    ledger_entry_id: IDS.ledgerEntry as never,
    publication_attempt_id: IDS.attempt as never,
    owner_approval_id: IDS.ownerApproval as never,
    approval_id: IDS.approval as never,
    proposal_id: IDS.proposal as never,
  };
}

function requestRecord(
  input: Partial<SocialPublicationPublisherRequestRecord> = {},
): SocialPublicationPublisherRequestRecord {
  return {
    publisher_request_id: IDS.request as never,
    publisher_job_id: IDS.job as never,
    request_type: "prepare_publication_request",
    channel_id: "channel-facebook-1" as never,
    channel_platform: "facebook",
    channel_type: "facebook_page",
    scope: scope(),
    owner_approval_satisfied: true,
    requested_at: "2026-07-01T12:00:00.000Z",
    updated_at: "2026-07-01T12:00:00.000Z",
    contract_only: true,
    model_authority_only: true,
    references_only: true,
    executes_nothing: true,
    publishes_nothing: true,
    calls_no_external_apis: true,
    uses_no_sdks: true,
    uses_no_network: true,
    starts_no_workers: true,
    starts_no_timers: true,
    creates_no_queues: true,
    exposes_no_api_routes: true,
    exposes_no_admin_ui: true,
    mutates_no_sql: true,
    mutates_no_storage: true,
    mutates_no_lower_layers: true,
    records_no_metrics: true,
    performs_no_learning: true,
    ...input,
  };
}

function resultRecord(
  input: Partial<SocialPublicationPublisherResultRecord> = {},
): SocialPublicationPublisherResultRecord {
  return {
    publisher_result_id: IDS.result as never,
    publisher_request_id: IDS.request as never,
    publisher_job_id: IDS.job as never,
    result_type: "publication_request_prepared",
    result_status: "prepared",
    channel_id: "channel-facebook-1" as never,
    channel_platform: "facebook",
    channel_type: "facebook_page",
    scope: scope(),
    result_code: "prepared_ok",
    error_code: null,
    recorded_at: "2026-07-01T12:05:00.000Z",
    updated_at: "2026-07-01T12:05:00.000Z",
    contract_only: true,
    model_authority_only: true,
    references_only: true,
    executes_nothing: true,
    publishes_nothing: true,
    calls_no_external_apis: true,
    uses_no_sdks: true,
    uses_no_network: true,
    persists_nothing: true,
    mutates_no_lower_layers: true,
    current_publish_status_authority: false,
    records_no_metrics: true,
    performs_no_learning: true,
    ...input,
  };
}

function assertOk<T>(result: SocialPublicationPublisherBridgeResult<T>): T {
  assert.equal(result.ok, true, JSON.stringify(result.ok ? [] : result.error));
  return result.value;
}

function assertBridgeError(
  result: SocialPublicationPublisherBridgeResult<unknown>,
  code: string,
): void {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, code);
}

function productionDouble(): {
  implementation: SocialPublicationPublisherBridge;
  calls: string[];
  model: { requests: SocialPublicationPublisherRequestRecord[]; results: SocialPublicationPublisherResultRecord[] };
} {
  const calls: string[] = [];
  const model = { requests: [] as SocialPublicationPublisherRequestRecord[], results: [] as SocialPublicationPublisherResultRecord[] };

  const implementation: SocialPublicationPublisherBridge = {
    mode: "production",
    async createPublisherRequest(record) {
      calls.push("createPublisherRequest");
      model.requests.push(clone(record));
      return { ok: true, value: clone(record) };
    },
    async appendPublisherResult(record) {
      calls.push("appendPublisherResult");
      model.results.push(clone(record));
      return { ok: true, value: clone(record) };
    },
    async listPublisherRecords() {
      calls.push("listPublisherRecords");
      return { ok: true, value: clone(model) };
    },
    async listPublisherRequests() {
      calls.push("listPublisherRequests");
      return { ok: true, value: clone(model.requests) };
    },
    async listPublisherResults() {
      calls.push("listPublisherResults");
      return { ok: true, value: clone(model.results) };
    },
  };

  return { implementation, calls, model };
}

await test("reference implementation is selected for test environment", () => {
  const bridge = assertOk(
    createSocialPublicationPublisherBridge({
      mode: "environment",
      runtimeEnvironment: "test",
    }),
  );

  assert.equal(bridge.mode, "reference");
  assert.equal(Object.isFrozen(bridge), true);
  assert.equal(
    assertOk(
      resolveSocialPublicationPublisherBridgeMode({
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
    createSocialPublicationPublisherBridge({
      mode: "production",
      runtimeEnvironment: "production",
      productionStoreConfigured: true,
      implementation,
    }),
  );

  assert.equal(bridge.mode, "production");
  assertOk(await bridge.createPublisherRequest(requestRecord()));
  assert.deepEqual(calls, ["createPublisherRequest"]);
});

await test("missing production dependency and unsafe fallback are rejected", () => {
  assertBridgeError(
    createSocialPublicationPublisherBridge({
      mode: "production",
      runtimeEnvironment: "production",
      productionStoreConfigured: false,
    }),
    "production_unavailable",
  );
  assertBridgeError(
    createSocialPublicationPublisherBridge({
      mode: "reference",
      runtimeEnvironment: "production",
    }),
    "unsafe_reference_in_production",
  );
});

await test("reference bridge creates appends lists and filters deterministically", async () => {
  const bridge = assertOk(
    createSocialPublicationPublisherBridge({
      mode: "reference",
      runtimeEnvironment: "test",
    }),
  );

  assert.equal(
    assertOk(await bridge.createPublisherRequest(requestRecord())).publisher_request_id,
    IDS.request,
  );
  assert.equal(
    assertOk(await bridge.appendPublisherResult(resultRecord())).publisher_result_id,
    IDS.result,
  );
  assert.equal(
    assertOk(await bridge.listPublisherRecords({ social_post_id: IDS.socialPost })).requests.length,
    1,
  );
  assert.equal(
    assertOk(await bridge.listPublisherRequests({ publisher_job_id: IDS.job })).length,
    1,
  );
  assert.equal(
    assertOk(await bridge.listPublisherResults({ publication_target_id: IDS.target })).length,
    1,
  );
});

await test("reference bridge rejects duplicates invalid results and invalid identities", async () => {
  const bridge = assertOk(
    createSocialPublicationPublisherBridge({
      mode: "reference",
      runtimeEnvironment: "test",
    }),
  );

  assertOk(await bridge.createPublisherRequest(requestRecord()));
  assertBridgeError(await bridge.createPublisherRequest(requestRecord()), "identity_collision");
  assertBridgeError(
    await bridge.appendPublisherResult(
      resultRecord({
        scope: { ...scope(), publication_target_id: "target-drifted" as never },
      }),
    ),
    "relationship_invalid",
  );
  assertBridgeError(
    await bridge.listPublisherRecords({ publisher_job_id: "" }),
    "validation_failed",
  );
});

await test("production bridge routes all operations to selected implementation", async () => {
  const { implementation, calls } = productionDouble();
  const bridge = assertOk(
    createSocialPublicationPublisherBridge({
      mode: "production",
      runtimeEnvironment: "production",
      productionStoreConfigured: true,
      implementation,
    }),
  );

  await bridge.createPublisherRequest(requestRecord());
  await bridge.appendPublisherResult(resultRecord());
  await bridge.listPublisherRecords({ publisher_job_id: IDS.job });
  await bridge.listPublisherRequests({ social_post_id: IDS.socialPost });
  await bridge.listPublisherResults({ publication_target_id: IDS.target });

  assert.deepEqual(calls, [
    "createPublisherRequest",
    "appendPublisherResult",
    "listPublisherRecords",
    "listPublisherRequests",
    "listPublisherResults",
  ]);
});

await test("validation rejects invalid model and invalid publisher input", async () => {
  const bridge = assertOk(
    createSocialPublicationPublisherBridge({
      mode: "reference",
      runtimeEnvironment: "test",
    }),
  );

  assertBridgeError(
    await bridge.createPublisherRequest({
      ...requestRecord(),
      executes_nothing: false,
    } as never),
    "validation_failed",
  );

  const duplicateModel: SocialPublicationPublisherPersistenceModel = {
    requests: [requestRecord(), requestRecord()],
    results: [],
  };
  assertBridgeError(
    validateSocialPublicationPublisherBridgeModel(duplicateModel),
    "validation_failed",
  );
});

await test("module exports no execution metrics learning admin or API behavior", () => {
  const exportedNames = Object.keys(bridgeExports).sort();
  const forbidden = [
    "publishSocialPost",
    "executePublication",
    "recordPublicationMetrics",
    "learnFromPublication",
    "renderPublicationPublisherAdmin",
    "createPublicationPublisherRoute",
  ];

  for (const name of forbidden) {
    assert.equal(exportedNames.includes(name), false, name);
  }
});

await test("bridge source has no schema route cron UI or external behavior", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "social-publication-publisher-bridge.ts"),
    "utf8",
  );
  const forbiddenSnippets = [
    "create table",
    "alter table",
    "next/",
    "react",
    "app/api",
    "NextRequest",
    "NextResponse",
    "cron",
    "setInterval",
    "setTimeout",
    "fetch(",
    "publishSocialPost",
    "recordPublicationMetrics",
    "learnFromPublication",
  ];

  for (const snippet of forbiddenSnippets) {
    assert.equal(source.includes(snippet), false, snippet);
  }
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
