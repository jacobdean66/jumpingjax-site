import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  configurePublicationTargetStoreTestDependencies,
  createPublicationTarget,
  getPublicationTargetById,
  listEnabledPublicationTargets,
  listPublicationTargets,
  updatePublicationTarget,
} from "./social-publication-target-store";
import * as targetStoreExports from "./social-publication-target-store";
import type { SocialPublicationTargetRow } from "./social-publication-target-persistence";
import type { PublicationTargetDefinition } from "./social-publication-targets";

type TestFn = () => void | Promise<void>;

type TestStorage = {
  rows: SocialPublicationTargetRow[];
  calls: string[];
  failNext?: boolean;
  insertTarget(row: SocialPublicationTargetRow): Promise<SocialPublicationTargetRow>;
  updateTarget(row: SocialPublicationTargetRow): Promise<SocialPublicationTargetRow | null>;
  getTargetById(targetId: string): Promise<SocialPublicationTargetRow | null>;
  listTargets(): Promise<SocialPublicationTargetRow[]>;
  listEnabledTargets(): Promise<SocialPublicationTargetRow[]>;
};

async function test(name: string, fn: TestFn): Promise<void> {
  configurePublicationTargetStoreTestDependencies(null);

  try {
    await fn();
    console.log(`ok - ${name}`);
  } finally {
    configurePublicationTargetStoreTestDependencies(null);
  }
}

function row(input: Partial<SocialPublicationTargetRow> = {}): SocialPublicationTargetRow {
  return {
    publication_target_id: "target-1",
    platform: "facebook",
    target_type: "facebook_page",
    display_name: "Jumping Jax Facebook Page",
    external_target_id: "facebook-page-123",
    owner_managed: true,
    enabled: true,
    capabilities: ["image_post", "caption_text"],
    media_constraints: {
      supportedMediaTypes: ["image"],
      maxImageCount: 1,
      maxVideoCount: 0,
      maxVideoDurationSeconds: 0,
      supportedAspectRatios: ["1:1", "4:5"],
    },
    copy_constraints: {
      maxCaptionCharacters: 2200,
      supportsHashtags: true,
      supportsLinks: false,
    },
    metadata: {},
    created_at: "2026-06-29T12:00:00.000Z",
    updated_at: "2026-06-29T12:00:00.000Z",
    ...input,
  };
}

function target(input: Partial<PublicationTargetDefinition> = {}): PublicationTargetDefinition {
  return {
    targetId: "target-1",
    platform: "facebook",
    targetType: "facebook_page",
    displayName: "Jumping Jax Facebook Page",
    externalId: "facebook-page-123",
    enabled: true,
    ownerManaged: true,
    capabilities: {
      capabilityKinds: ["image_post", "caption_text"],
      mediaConstraints: {
        supportedMediaTypes: ["image"],
        maxImageCount: 1,
        maxVideoCount: 0,
        maxVideoDurationSeconds: 0,
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
    },
    createdAt: "2026-06-29T12:00:00.000Z",
    updatedAt: "2026-06-29T12:00:00.000Z",
    metadata: {},
    ...input,
  };
}

function storage(rows: SocialPublicationTargetRow[] = []): TestStorage {
  return {
    rows,
    calls: [],
    async insertTarget(inputRow) {
      this.calls.push("insertTarget");
      if (this.failNext) throw new Error("storage unavailable");
      this.rows.push(inputRow);
      return inputRow;
    },
    async updateTarget(inputRow) {
      this.calls.push("updateTarget");
      if (this.failNext) throw new Error("storage unavailable");
      const index = this.rows.findIndex(
        (item) => item.publication_target_id === inputRow.publication_target_id,
      );
      if (index === -1) return null;
      this.rows[index] = inputRow;
      return inputRow;
    },
    async getTargetById(targetId) {
      this.calls.push("getTargetById");
      if (this.failNext) throw new Error("storage unavailable");
      return this.rows.find((item) => item.publication_target_id === targetId) ?? null;
    },
    async listTargets() {
      this.calls.push("listTargets");
      if (this.failNext) throw new Error("storage unavailable");
      return [...this.rows];
    },
    async listEnabledTargets() {
      this.calls.push("listEnabledTargets");
      if (this.failNext) throw new Error("storage unavailable");
      return this.rows.filter((item) => item.enabled);
    },
  };
}

await test("create validates before write", async () => {
  const testStorage = storage();
  configurePublicationTargetStoreTestDependencies(testStorage);

  const result = await createPublicationTarget(target());

  assert.equal(result.ok, true);
  assert.deepEqual(testStorage.calls, ["insertTarget"]);
  assert.equal(testStorage.rows[0]?.publication_target_id, "target-1");
});

await test("invalid target rejected before write", async () => {
  const testStorage = storage();
  configurePublicationTargetStoreTestDependencies(testStorage);

  const result = await createPublicationTarget(
    target({
      displayName: "",
      metadata: {
        accessToken: "secret-token",
      },
    }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "validation_failed");
  assert.deepEqual(testStorage.calls, []);
});

await test("update validates before write", async () => {
  const testStorage = storage([row()]);
  configurePublicationTargetStoreTestDependencies(testStorage);

  const result = await updatePublicationTarget(
    target({
      displayName: "Updated Facebook Page",
    }),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(testStorage.calls, ["updateTarget"]);
  assert.equal(testStorage.rows[0]?.display_name, "Updated Facebook Page");
});

await test("get by id returns mapped target", async () => {
  const testStorage = storage([row()]);
  configurePublicationTargetStoreTestDependencies(testStorage);

  const result = await getPublicationTargetById("target-1");

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.targetId, "target-1");
    assert.equal(result.value.platform, "facebook");
    assert.equal(result.value.capabilities.publishesNothing, true);
  }
});

await test("missing target returns not_found", async () => {
  const testStorage = storage();
  configurePublicationTargetStoreTestDependencies(testStorage);

  const result = await getPublicationTargetById("missing-target");

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "not_found");
});

await test("list returns mapped targets", async () => {
  const testStorage = storage([
    row(),
    row({
      publication_target_id: "target-2",
      platform: "instagram",
      target_type: "instagram_business_account",
      display_name: "Jumping Jax Instagram",
      external_target_id: "instagram-business-123",
      capabilities: ["image_post", "video_post", "caption_text"],
    }),
  ]);
  configurePublicationTargetStoreTestDependencies(testStorage);

  const result = await listPublicationTargets();

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(
      result.value.map((item) => item.targetId),
      ["target-1", "target-2"],
    );
  }
});

await test("list enabled filters enabled targets", async () => {
  const testStorage = storage([
    row(),
    row({
      publication_target_id: "target-2",
      enabled: false,
    }),
  ]);
  configurePublicationTargetStoreTestDependencies(testStorage);

  const result = await listEnabledPublicationTargets();

  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value.map((item) => item.targetId), ["target-1"]);
});

await test("storage errors return explicit result", async () => {
  const testStorage = storage();
  testStorage.failNext = true;
  configurePublicationTargetStoreTestDependencies(testStorage);

  const result = await listPublicationTargets();

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "storage_error");
});

await test("rows are validated before returning", async () => {
  const testStorage = storage([
    row({
      metadata: {
        publishStatus: "published",
      },
    }),
  ]);
  configurePublicationTargetStoreTestDependencies(testStorage);

  const result = await listPublicationTargets();

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "validation_failed");
});

await test("module exports no publish schedule or approve authority", () => {
  const forbidden = [
    "publishPublicationTarget",
    "schedulePublicationTarget",
    "approvePublicationTarget",
    "createPublicationTargetApproval",
    "recordPublicationTargetMetrics",
    "writePublicationTargetLedger",
  ];

  for (const name of forbidden) {
    assert.equal(name in targetStoreExports, false);
  }
});

await test("typescript store module has no API UI or route imports", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "social-publication-target-store.ts"),
    "utf8",
  );

  assert.equal(source.includes("next/"), false);
  assert.equal(source.includes("react"), false);
  assert.equal(source.includes("/api/"), false);
  assert.equal(source.includes("app/"), false);
});

await test("typescript store module has no external API calls", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "social-publication-target-store.ts"),
    "utf8",
  );

  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes("axios"), false);
  assert.equal(source.includes("openai"), false);
  assert.equal(source.includes("facebook.com"), false);
  assert.equal(source.includes("instagram.com"), false);
  assert.equal(source.includes("graph.facebook"), false);
});
