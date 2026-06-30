import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  evaluateCopyCompatibility,
  evaluateMediaCompatibility,
  evaluatePublicationTargetCapabilities,
  type PublicationTargetCapabilityEvaluation,
  type PublicationTargetMediaShape,
} from "./social-publication-target-capabilities";
import * as capabilityExports from "./social-publication-target-capabilities";
import type {
  PublicationTargetCapability,
  PublicationTargetDefinition,
} from "./social-publication-targets";

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

function media(input: Partial<PublicationTargetMediaShape> = {}): PublicationTargetMediaShape {
  return {
    mediaType: "image",
    hasMedia: true,
    imageCount: 1,
    videoCount: 0,
    videoDurationSeconds: null,
    aspectRatio: "1:1",
    ...input,
  };
}

function evaluate(
  input: Partial<Parameters<typeof evaluatePublicationTargetCapabilities>[0]> = {},
): PublicationTargetCapabilityEvaluation {
  const definition = input.target ?? target();

  return evaluatePublicationTargetCapabilities({
    target: definition,
    requestedPlatform: input.requestedPlatform ?? definition.platform,
    media: input.media ?? media(),
    copy: input.copy ?? {
      caption: "Book the weekend bounce house before the calendar fills.",
    },
  });
}

function codes(result: PublicationTargetCapabilityEvaluation): string[] {
  return result.issues.map((issue) => issue.code);
}

await test("image-supported target accepts image media", () => {
  const result = evaluate({
    media: media({ mediaType: "image", hasMedia: true }),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
  assert.equal(result.grantsPublishingPermission, false);
  assert.equal(result.publishesNothing, true);
});

await test("video-supported target accepts video media", () => {
  const result = evaluate({
    media: media({
      mediaType: "video",
      hasMedia: true,
      imageCount: 0,
      videoCount: 1,
      videoDurationSeconds: 30,
      aspectRatio: "9:16",
    }),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

await test("unsupported media kind fails", () => {
  const result = evaluate({
    target: target({
      capabilities: capability({
        capabilityKinds: ["image_post", "caption_text"],
        mediaConstraints: {
          ...capability().mediaConstraints,
          supportedMediaTypes: ["image"],
          maxVideoCount: 0,
        },
      }),
    }),
    media: media({
      mediaType: "video",
      hasMedia: true,
      imageCount: 0,
      videoCount: 1,
    }),
  });

  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), [
    "media_type_unsupported",
    "video_count_exceeded",
  ]);
});

await test("caption length constraints fail deterministically", () => {
  const result = evaluate({
    target: target({
      capabilities: capability({
        copyConstraints: {
          maxCaptionCharacters: 10,
          supportsHashtags: true,
          supportsLinks: true,
        },
      }),
    }),
    copy: {
      caption: "This caption is too long.",
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ["caption_too_long"]);
});

await test("required media missing fails", () => {
  const result = evaluate({
    media: media({ hasMedia: false, imageCount: 0 }),
  });

  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ["media_required"]);
});

await test("platform and target mismatch fails", () => {
  const result = evaluate({
    requestedPlatform: "instagram",
  });

  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ["platform_mismatch"]);
});

await test("disabled target fails if passed in", () => {
  const result = evaluate({
    target: target({ enabled: false }),
  });

  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ["target_disabled"]);
});

await test("media helper checks duration and aspect ratio", () => {
  const issues = evaluateMediaCompatibility(
    media({
      mediaType: "video",
      hasMedia: true,
      imageCount: 0,
      videoCount: 1,
      videoDurationSeconds: 120,
      aspectRatio: "16:9",
    }),
    capability(),
  );

  assert.deepEqual(
    issues.map((issue) => issue.code),
    ["video_duration_exceeded", "aspect_ratio_unsupported"],
  );
});

await test("copy helper requires caption text", () => {
  const issues = evaluateCopyCompatibility({ caption: " " }, capability());

  assert.deepEqual(
    issues.map((issue) => issue.code),
    ["caption_required"],
  );
});

await test("target module exports no publish schedule or approve authority helpers", () => {
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
    assert.equal(name in capabilityExports, false);
  }
});

await test("target capability module has no Supabase API UI or route imports", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "social-publication-target-capabilities.ts",
    ),
    "utf8",
  );
  const forbidden = [
    "supabase",
    "createServiceRoleClient",
    "next/",
    "react",
    "/api/",
    "social-owner-approval-request-flow",
    "social-owner-approval-decision-flow",
    "social-publication-readiness",
    "social-publication-manifest",
  ];

  for (const value of forbidden) {
    assert.equal(source.includes(value), false);
  }
});
