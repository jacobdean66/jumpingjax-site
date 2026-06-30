import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildPublicationTargetIntegrationSummary,
  buildPublicationTargetIntegrationUnavailable,
} from "./social-publication-target-integration";
import * as integrationExports from "./social-publication-target-integration";
import {
  buildPublicationTargetSelectionSnapshots,
  selectPublicationTargetCandidates,
  type PublicationTargetSelectionManifest,
} from "./social-publication-target-selection";
import type {
  PublicationTargetCapability,
  PublicationTargetDefinition,
} from "./social-publication-targets";

const NOW = "2026-06-30T12:00:00.000Z";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function capability(input: Partial<PublicationTargetCapability> = {}): PublicationTargetCapability {
  return {
    capabilityKinds: ["image_post", "video_post", "caption_text"],
    mediaConstraints: {
      supportedMediaTypes: ["image", "video"],
      maxImageCount: 1,
      maxVideoCount: 1,
      maxVideoDurationSeconds: 90,
      supportedAspectRatios: [],
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

function target(input: Partial<PublicationTargetDefinition> = {}): PublicationTargetDefinition {
  return {
    targetId: "target-facebook-1",
    platform: "facebook",
    targetType: "facebook_page",
    displayName: "Jumping Jax Facebook Page",
    externalId: "facebook-page-123",
    enabled: true,
    ownerManaged: true,
    capabilities: capability(),
    createdAt: NOW,
    updatedAt: NOW,
    metadata: {},
    ...input,
  };
}

function manifest(input: Partial<PublicationTargetSelectionManifest> = {}): PublicationTargetSelectionManifest {
  return {
    content: {
      caption: "Cool off this weekend.",
      mediaType: "image",
      ...input.content,
    },
    assets: {
      approvedImageUrl: null,
      generatedImageUrl: null,
      mediaUrl: null,
      sourceImageUrl: null,
      selected: [{ isRejected: false }],
      approved: [],
      ...input.assets,
    },
    destinations: {
      platforms: ["facebook"],
      ...input.destinations,
    },
  };
}

await test("builds summary from selectable target snapshots", () => {
  const selection = selectPublicationTargetCandidates({
    manifest: manifest(),
    configuredTargets: [target()],
  });
  const snapshotResult = buildPublicationTargetSelectionSnapshots(selection.candidates, {
    socialPostId: "post-1",
  });
  const result = buildPublicationTargetIntegrationSummary({
    selection,
    snapshots: snapshotResult.snapshots,
  });

  assert.equal(result.ok, true);
  assert.equal(result.summary.available, true);
  assert.equal(result.summary.candidateCount, 1);
  assert.equal(result.summary.selectedTargetCount, 1);
  assert.equal(result.summary.targets[0]?.targetId, "target-facebook-1");
  assert.equal(result.summary.targets[0]?.platform, "facebook");
  assert.equal(result.summary.targets[0]?.displayName, "Jumping Jax Facebook Page");
  assert.deepEqual(result.summary.targets[0]?.capabilitySummary.capabilityKinds, [
    "image_post",
    "video_post",
    "caption_text",
  ]);
});

await test("unavailable summary has null and empty safe values", () => {
  const summary = buildPublicationTargetIntegrationUnavailable();

  assert.equal(summary.available, false);
  assert.equal(summary.targets.length, 0);
  assert.equal(summary.issues.length, 0);
  assert.equal(summary.candidateCount, 0);
  assert.equal(summary.selectedTargetCount, 0);
  assert.equal(summary.notPublicationPermission, true);
});

await test("rejected candidates are represented as non-authoritative issues", () => {
  const selection = selectPublicationTargetCandidates({
    manifest: manifest(),
    configuredTargets: [target({ enabled: false })],
  });
  const result = buildPublicationTargetIntegrationSummary({
    selection,
    snapshots: [],
  });

  assert.equal(result.summary.available, false);
  assert.equal(result.summary.candidateCount, 1);
  assert.equal(result.summary.selectedTargetCount, 0);
  assert.deepEqual(
    result.summary.issues.map((issue) => issue.code),
    ["target_disabled"],
  );
  assert.equal(result.summary.issues[0]?.targetId, "target-facebook-1");
  assert.equal(result.summary.issues[0]?.nonAuthoritative, true);
});

await test("preserves computed only authoritative false and not publication permission", () => {
  const result = buildPublicationTargetIntegrationSummary({
    selection: selectPublicationTargetCandidates({
      manifest: manifest(),
      configuredTargets: [target()],
    }),
    snapshots: buildPublicationTargetSelectionSnapshots(
      selectPublicationTargetCandidates({
        manifest: manifest(),
        configuredTargets: [target()],
      }).candidates,
    ).snapshots,
  });

  assert.equal(result.summary.computedOnly, true);
  assert.equal(result.summary.authoritative, false);
  assert.equal(result.summary.grantsPublishingPermission, false);
  assert.equal(result.summary.notPublicationPermission, true);
  assert.equal(result.summary.publishesNothing, true);
  assert.equal(result.summary.schedulesNothing, true);
  assert.equal(result.summary.recordsNoMetrics, true);
  assert.equal(result.summary.performsNoLearning, true);
  assert.equal(result.summary.implementsScheduler, false);
  assert.equal(result.summary.implementsLedger, false);
  assert.equal(result.summary.recordsAttempts, false);
  assert.equal(result.summary.recordsOutcomes, false);
});

await test("does not expose publish schedule or ledger execution helpers", () => {
  const forbidden = [
    "publish",
    "publishToTarget",
    "schedule",
    "scheduleTarget",
    "runScheduler",
    "writeLedger",
    "recordLedgerEntry",
    "recordAttempt",
    "recordOutcome",
  ];

  for (const name of forbidden) {
    assert.equal(name in integrationExports, false);
  }
});

await test("no Supabase API UI or route imports", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "social-publication-target-integration.ts"),
    "utf8",
  );
  const forbidden = [
    "supabase",
    "createServiceRoleClient",
    "next/",
    "react",
    "/api/",
    "app/",
    "social-publication-target-store",
  ];

  for (const value of forbidden) {
    assert.equal(source.includes(value), false);
  }
});

await test("no scheduler ledger metrics or learning implementation", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "social-publication-target-integration.ts"),
    "utf8",
  );
  const forbidden = [
    "setTimeout",
    "cron",
    "insert(",
    "update(",
    "delete(",
    "impressions",
    "analytics",
    "learningSignal",
    "publicationLedger",
  ];

  for (const value of forbidden) {
    assert.equal(source.includes(value), false);
  }
});
