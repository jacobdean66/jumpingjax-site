import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildPublicationTargetSelectionSnapshot,
  isPublicationTargetPlatform,
  PUBLICATION_TARGET_CAPABILITY_KINDS,
  PUBLICATION_TARGET_PLATFORMS,
  PUBLICATION_TARGET_TYPES,
  validatePublicationTargetCapabilities,
  validatePublicationTargetDefinition,
  validatePublicationTargetSelectionSnapshot,
  type PublicationTargetCapability,
  type PublicationTargetDefinition,
  type PublicationTargetSelectionSnapshot,
} from "./social-publication-targets";
import * as targetExports from "./social-publication-targets";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function capability(
  input: Partial<PublicationTargetCapability> = {},
): PublicationTargetCapability {
  return {
    capabilityKinds: ["image_post", "video_post", "caption_text"],
    mediaConstraints: {
      supportedMediaTypes: ["image", "video"],
      maxImageCount: 1,
      maxVideoCount: 1,
      maxVideoDurationSeconds: 90,
      supportedAspectRatios: ["1:1", "4:5", "9:16"],
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
    ...input,
  };
}

function target(
  input: Partial<PublicationTargetDefinition> = {},
): PublicationTargetDefinition {
  return {
    targetId: "target-facebook-page-1",
    platform: "facebook",
    targetType: "facebook_page",
    displayName: "Jumping Jax Facebook Page",
    externalId: "facebook-page-123",
    enabled: true,
    ownerManaged: true,
    capabilities: capability(),
    createdAt: "2026-06-29T12:00:00.000Z",
    updatedAt: "2026-06-29T12:00:00.000Z",
    metadata: {},
    ...input,
  };
}

function snapshot(
  input: Partial<PublicationTargetSelectionSnapshot> = {},
): PublicationTargetSelectionSnapshot {
  return {
    targetId: "target-facebook-page-1",
    platform: "facebook",
    targetType: "facebook_page",
    displayName: "Jumping Jax Facebook Page",
    externalId: "facebook-page-123",
    capabilitySummary: capability(),
    source: "publication_target_selection_snapshot",
    computedOnly: true,
    authoritative: false,
    grantsPublishingPermission: false,
    publishesNothing: true,
    schedulesNothing: true,
    recordsNoMetrics: true,
    performsNoLearning: true,
    metadata: {},
    references: {
      socialPostId: "post-1",
      proposalId: "proposal-1",
      approvalId: "approval-1",
    },
    ...input,
  };
}

function codes(result: ReturnType<typeof validatePublicationTargetDefinition>): string[] {
  return result.ok ? [] : result.errors.map((error) => error.code);
}

await test("defines supported target vocabularies", () => {
  assert.deepEqual([...PUBLICATION_TARGET_PLATFORMS], ["facebook", "instagram"]);
  assert.deepEqual([...PUBLICATION_TARGET_TYPES], [
    "facebook_page",
    "instagram_business_account",
  ]);
  assert.deepEqual([...PUBLICATION_TARGET_CAPABILITY_KINDS], [
    "image_post",
    "video_post",
    "caption_text",
  ]);
});

await test("accepts a valid target definition", () => {
  assert.deepEqual(validatePublicationTargetDefinition(target()), {
    ok: true,
    errors: [],
  });
});

await test("rejects an unknown platform", () => {
  const result = validatePublicationTargetDefinition(
    target({ platform: "threads" as PublicationTargetDefinition["platform"] }),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ["platform_unknown"]);
});

await test("rejects a missing display name", () => {
  const result = validatePublicationTargetDefinition(
    target({ displayName: " " }),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ["display_name_required"]);
});

await test("keeps configured target distinct from platform", () => {
  const definition = target();

  assert.equal(isPublicationTargetPlatform(definition.platform), true);
  assert.notEqual(definition.targetId, definition.platform);
  assert.notEqual(definition.displayName.toLowerCase(), definition.platform);
  assert.equal(definition.targetType, "facebook_page");
});

await test("accepts valid capabilities", () => {
  assert.deepEqual(validatePublicationTargetCapabilities(capability()), {
    ok: true,
    errors: [],
  });
});

await test("rejects invalid capability shape", () => {
  const result = validatePublicationTargetCapabilities(
    capability({
      capabilityKinds: [
        "image_post",
        "publish_now" as PublicationTargetCapability["capabilityKinds"][number],
      ],
      grantsPublishingPermission: true as false,
      mediaConstraints: {
        supportedMediaTypes: [],
        maxImageCount: -1,
        maxVideoCount: 1,
        maxVideoDurationSeconds: null,
        supportedAspectRatios: [],
      },
    }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      result.errors.map((error) => error.code),
      [
        "capability_kind_unknown",
        "capability_permission_forbidden",
        "media_constraint_invalid",
      ],
    );
  }
});

await test("accepts a valid selection snapshot", () => {
  assert.deepEqual(validatePublicationTargetSelectionSnapshot(snapshot()), {
    ok: true,
    errors: [],
  });
});

await test("builds a target selection snapshot from a target definition", () => {
  const definition = target();
  const built = buildPublicationTargetSelectionSnapshot(definition, {
    socialPostId: "post-1",
  });

  assert.equal(built.targetId, definition.targetId);
  assert.equal(built.platform, definition.platform);
  assert.equal(built.displayName, definition.displayName);
  assert.equal(built.references.socialPostId, "post-1");
  assert.equal(built.grantsPublishingPermission, false);
});

await test("selection snapshot rejects secrets and tokens", () => {
  const result = validatePublicationTargetSelectionSnapshot(
    snapshot({
      metadata: {
        accessToken: "secret-token",
      },
    }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      result.errors.map((error) => error.code),
      ["selection_forbidden_secret"],
    );
  }
});

await test("selection snapshot rejects publish state", () => {
  const result = validatePublicationTargetSelectionSnapshot(
    snapshot({
      metadata: {
        publishStatus: "published",
      },
    }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      result.errors.map((error) => error.code),
      ["selection_publish_state_forbidden"],
    );
  }
});

await test("selection snapshot rejects scheduler ledger metrics learning and approval state", () => {
  const result = validatePublicationTargetSelectionSnapshot(
    snapshot({
      metadata: {
        scheduledFor: "2026-07-01T12:00:00.000Z",
        ledgerEntryId: "ledger-1",
        metrics: {
          impressions: 10,
        },
        learningSignal: "promote",
        approvalStatus: "approved",
      },
    }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      result.errors.map((error) => error.code),
      [
        "selection_scheduler_state_forbidden",
        "selection_ledger_state_forbidden",
        "selection_metrics_state_forbidden",
        "selection_metrics_state_forbidden",
        "selection_learning_state_forbidden",
        "selection_approval_state_forbidden",
      ],
    );
  }
});

await test("target module exports no publish schedule or approve helpers", () => {
  const forbidden = [
    "publish",
    "publishToTarget",
    "schedule",
    "scheduleTarget",
    "approve",
    "approveTarget",
    "requestOwnerApproval",
    "decideOwnerApproval",
  ];

  for (const name of forbidden) {
    assert.equal(name in targetExports, false);
  }
});

await test("target module has no forbidden imports", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "social-publication-targets.ts"),
    "utf8",
  );
  const importLines = source
    .split("\n")
    .filter((line) => line.startsWith("import "));

  assert.deepEqual(importLines, []);
});
