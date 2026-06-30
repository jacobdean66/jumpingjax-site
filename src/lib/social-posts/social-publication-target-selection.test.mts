import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildPublicationTargetSelectionSnapshots,
  selectPublicationTargetCandidates,
  type PublicationTargetCandidate,
} from "./social-publication-target-selection";
import * as selectionExports from "./social-publication-target-selection";
import { validatePublicationTargetSelectionSnapshot } from "./social-publication-targets";
import type {
  PublicationTargetCapability,
  PublicationTargetDefinition,
  PublicationTargetSelectionSnapshot,
} from "./social-publication-targets";
import type { PublicationTargetSelectionManifest } from "./social-publication-target-selection";

const NOW = "2026-06-30T12:00:00.000Z";

type TestFn = () => void | Promise<void>;

type ManifestInput = {
  destinations?: Partial<PublicationTargetSelectionManifest["destinations"]>;
  content?: Partial<PublicationTargetSelectionManifest["content"]>;
  assets?: Partial<PublicationTargetSelectionManifest["assets"]>;
};

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

function manifest(input: ManifestInput = {}): PublicationTargetSelectionManifest {
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
      selected: [
        {
          isRejected: false,
        },
      ],
      approved: [],
      ...input.assets,
    },
    destinations: {
      platforms: ["facebook"],
      ...input.destinations,
    },
  };
}

function select(
  targets: readonly PublicationTargetDefinition[],
  input: ManifestInput = {},
): readonly PublicationTargetCandidate[] {
  return selectPublicationTargetCandidates({
    manifest: manifest(input),
    configuredTargets: targets,
  }).candidates;
}

await test("matching platform produces selectable candidate", () => {
  const [candidate] = select([target()]);

  assert.equal(candidate?.selectable, true);
  assert.equal(candidate?.requestedPlatform, "facebook");
  assert.deepEqual(candidate?.issues, []);
  assert.equal(candidate?.authoritative, false);
  assert.equal(candidate?.grantsPublishingPermission, false);
});

await test("disabled target rejected", () => {
  const [candidate] = select([target({ enabled: false })]);

  assert.equal(candidate?.selectable, false);
  assert.deepEqual(candidate?.issues.map((issue) => issue.code), ["target_disabled"]);
});

await test("platform mismatch rejected", () => {
  const [candidate] = select([
    target({
      targetId: "target-instagram-1",
      platform: "instagram",
      targetType: "instagram_business_account",
      displayName: "Jumping Jax Instagram",
      externalId: "instagram-123",
    }),
  ]);

  assert.equal(candidate?.selectable, false);
  assert.deepEqual(candidate?.issues.map((issue) => issue.code), ["platform_mismatch"]);
});

await test("capability mismatch rejected", () => {
  const [candidate] = select(
    [
      target({
        capabilities: capability({
          mediaConstraints: {
            ...capability().mediaConstraints,
            supportedMediaTypes: ["video"],
            maxImageCount: 0,
          },
        }),
      }),
    ],
    {
      content: {
        mediaType: "image",
      },
    },
  );

  assert.equal(candidate?.selectable, false);
  assert.deepEqual(candidate?.issues.map((issue) => issue.code), ["capability_mismatch"]);
});

await test("multiple matching targets are deterministic", () => {
  const candidates = select([
    target({
      targetId: "target-facebook-b",
      displayName: "Zulu Facebook Page",
      externalId: "facebook-b",
    }),
    target({
      targetId: "target-facebook-a",
      displayName: "Alpha Facebook Page",
      externalId: "facebook-a",
    }),
  ]);

  assert.deepEqual(
    candidates.map((candidate) => candidate.target.targetId),
    ["target-facebook-a", "target-facebook-b"],
  );
});

await test("snapshots include only safe target identity and capability summary", () => {
  const result = selectPublicationTargetCandidates({
    manifest: manifest(),
    configuredTargets: [
      target({
        metadata: {
          accessToken: "must-not-copy",
          publishStatus: "published",
        },
      }),
    ],
  });
  const snapshots = buildPublicationTargetSelectionSnapshots(result.candidates, {
    socialPostId: "post-1",
  });

  assert.equal(snapshots.ok, true);
  assert.equal(snapshots.snapshots.length, 1);

  const [snapshot] = snapshots.snapshots;
  assert.equal(snapshot?.targetId, "target-facebook-1");
  assert.equal(snapshot?.source, "publication_target_selection_snapshot");
  assert.equal(snapshot?.authoritative, false);
  assert.equal(snapshot?.grantsPublishingPermission, false);
  assert.deepEqual(snapshot?.metadata, {});
  assert.equal(JSON.stringify(snapshot).includes("must-not-copy"), false);
  assert.equal(JSON.stringify(snapshot).includes("publishStatus"), false);
});

await test("rejects forbidden snapshot state", () => {
  const snapshot: PublicationTargetSelectionSnapshot = {
    ...buildPublicationTargetSelectionSnapshots(select([target()])).snapshots[0],
    metadata: {
      approvalStatus: "approved",
      accessToken: "secret",
    },
  } as PublicationTargetSelectionSnapshot;

  const validation = validatePublicationTargetSelectionSnapshot(snapshot);

  assert.equal(validation.ok, false);
  if (!validation.ok) {
    assert.deepEqual(
      validation.errors.map((error) => error.code),
      ["selection_forbidden_secret", "selection_approval_state_forbidden"],
    );
  }
});

await test("no Supabase API UI or route imports", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "social-publication-target-selection.ts"),
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

await test("no publish schedule or approve exports", () => {
  const forbidden = [
    "publishPublicationTarget",
    "schedulePublicationTarget",
    "approvePublicationTarget",
    "requestOwnerApproval",
    "decideOwnerApproval",
    "writePublicationLedger",
    "recordPublicationMetrics",
  ];

  for (const name of forbidden) {
    assert.equal(name in selectionExports, false);
  }
});
