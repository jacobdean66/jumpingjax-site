import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  mapSocialPublicationTargetRowToDefinition,
  validateSocialPublicationTargetRow,
  type SocialPublicationTargetRow,
} from "./social-publication-target-persistence";
import * as persistenceExports from "./social-publication-target-persistence";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
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
    capabilities: ["image_post", "video_post", "caption_text"],
    media_constraints: {
      supportedMediaTypes: ["image", "video"],
      maxImageCount: 1,
      maxVideoCount: 1,
      maxVideoDurationSeconds: 90,
      supportedAspectRatios: ["1:1", "4:5", "9:16"],
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

function codes(result: ReturnType<typeof validateSocialPublicationTargetRow>): string[] {
  return result.ok ? [] : result.errors.map((error) => error.code);
}

await test("accepts a valid persistence row", () => {
  assert.deepEqual(validateSocialPublicationTargetRow(row()), {
    ok: true,
    errors: [],
  });
});

await test("rejects an unknown platform", () => {
  assert.deepEqual(codes(validateSocialPublicationTargetRow(row({ platform: "threads" }))), [
    "platform_unknown",
  ]);
});

await test("rejects missing external target id", () => {
  assert.deepEqual(
    codes(validateSocialPublicationTargetRow(row({ external_target_id: " " }))),
    ["required_field_missing"],
  );
});

await test("rejects missing display name", () => {
  assert.deepEqual(
    codes(validateSocialPublicationTargetRow(row({ display_name: "" }))),
    ["required_field_missing"],
  );
});

await test("rejects secrets and tokens in json storage", () => {
  const result = validateSocialPublicationTargetRow(
    row({
      metadata: {
        accessToken: "secret-token",
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ["secret_storage_forbidden"]);
});

await test("rejects publish schedule metrics learning and approval state fields", () => {
  const result = validateSocialPublicationTargetRow(
    row({
      metadata: {
        publishStatus: "published",
        scheduledFor: "2026-07-01T12:00:00.000Z",
        metrics: {
          impressions: 10,
        },
        learningSignal: "promote",
        approvalStatus: "approved",
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), [
    "publish_state_storage_forbidden",
    "schedule_state_storage_forbidden",
    "metrics_state_storage_forbidden",
    "metrics_state_storage_forbidden",
    "learning_state_storage_forbidden",
    "approval_state_storage_forbidden",
  ]);
});

await test("maps row to domain target definition", () => {
  const definition = mapSocialPublicationTargetRowToDefinition(row());

  assert.equal(definition.targetId, "target-1");
  assert.equal(definition.platform, "facebook");
  assert.equal(definition.targetType, "facebook_page");
  assert.equal(definition.displayName, "Jumping Jax Facebook Page");
  assert.equal(definition.externalId, "facebook-page-123");
  assert.equal(definition.enabled, true);
  assert.equal(definition.ownerManaged, true);
  assert.deepEqual(definition.capabilities.capabilityKinds, [
    "image_post",
    "video_post",
    "caption_text",
  ]);
  assert.equal(definition.capabilities.grantsPublishingPermission, false);
  assert.equal(definition.capabilities.publishesNothing, true);
});

await test("rejects invalid capability and constraint shapes", () => {
  const result = validateSocialPublicationTargetRow(
    row({
      capabilities: ["image_post", "publish_now"],
      media_constraints: {},
      copy_constraints: {
        maxCaptionCharacters: "2200",
        supportsHashtags: true,
        supportsLinks: false,
      },
    } as Partial<SocialPublicationTargetRow>),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), [
    "capabilities_invalid",
    "media_constraints_invalid",
    "copy_constraints_invalid",
  ]);
});

await test("module exports no repository read or write functions", () => {
  const forbidden = [
    "createSocialPublicationTarget",
    "insertSocialPublicationTarget",
    "updateSocialPublicationTarget",
    "deleteSocialPublicationTarget",
    "getSocialPublicationTarget",
    "listSocialPublicationTargets",
  ];

  for (const name of forbidden) {
    assert.equal(name in persistenceExports, false);
  }
});

await test("typescript persistence module has no Supabase API or UI imports", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "social-publication-target-persistence.ts",
    ),
    "utf8",
  );

  assert.equal(source.includes("createServiceRoleClient"), false);
  assert.equal(source.includes("supabase"), false);
  assert.equal(source.includes("next/"), false);
  assert.equal(source.includes("react"), false);
  assert.equal(source.includes("/api/"), false);
});

await test("migration creates dormant configured targets table only", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../supabase/migrations/20260629130000_create_social_publication_targets.sql",
    ),
    "utf8",
  );

  assert.match(source, /create table if not exists public\.social_publication_targets/);
  assert.match(source, /publication_target_id uuid primary key/);
  assert.match(source, /platform text not null/);
  assert.match(source, /external_target_id text not null/);
  assert.doesNotMatch(source, /access_token|refresh_token|api_key|secret/i);
  assert.doesNotMatch(source, /publish_attempt|scheduled_for|metrics|learning|approval_status/i);
});
