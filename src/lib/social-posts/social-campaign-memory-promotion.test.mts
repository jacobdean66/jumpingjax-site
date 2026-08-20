import assert from "node:assert/strict";

import {
  buildCampaignMemoryCandidates,
  configureCampaignMemoryPromotionTestDependencies,
  listCampaignMemoryCandidateEvidence,
  promoteCampaignMemoryCandidate,
  retractSocialCampaignMemory,
  type CampaignMemoryCandidate,
} from "./social-campaign-memory-promotion";
import type {
  AttachSocialCampaignMemoryEvidenceInput,
  CreateSocialCampaignMemoryVersionInput,
  ListSocialCampaignMemoriesInput,
  SocialCampaignMemory,
  SocialCampaignMemoryEvidence,
} from "./social-campaign-memories";
import type {
  DecisionStage,
  DecisionType,
  SocialPostDecision,
} from "./social-post-decisions";

const NOW = "2026-06-28T00:00:00.000Z";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  configureCampaignMemoryPromotionTestDependencies(null);
  try {
    await fn();
    console.log(`ok - ${name}`);
  } finally {
    configureCampaignMemoryPromotionTestDependencies(null);
  }
}

function decision(input: {
  id: string;
  type: DecisionType;
  stage?: DecisionStage;
  campaignId?: string | null;
  postId?: string;
  assetId?: string | null;
  assetFamilyId?: string | null;
  provider?: string | null;
  model?: string | null;
  outputSnapshot?: Record<string, unknown>;
}): SocialPostDecision {
  return {
    id: input.id,
    social_post_id: input.postId ?? `post-${input.id}`,
    asset_id: input.assetId ?? `asset-${input.id}`,
    asset_family_id: input.assetFamilyId ?? `family-${input.id}`,
    campaign_id: input.campaignId ?? "summer-campaign",
    created_at: NOW,
    decision_stage: input.stage ?? "image_review",
    decision_type: input.type,
    decision: `${input.type} decision`,
    rationale: null,
    input_snapshot: {},
    output_snapshot:
      input.outputSnapshot ??
      (input.stage === "video_review"
        ? { media_url: `https://example.test/video-${input.id}.mp4` }
        : { generated_image_url: `https://example.test/image-${input.id}.png` }),
    model: input.model ?? "model-a",
    provider: input.provider ?? "openai",
    created_by: "test",
  };
}

function memory(input: {
  id: string;
  memoryKey?: string;
  status?: SocialCampaignMemory["status"];
  version?: number;
  supersedesMemoryId?: string | null;
  outputSummary?: Record<string, unknown>;
}): SocialCampaignMemory {
  return {
    id: input.id,
    campaign_id: "summer-campaign",
    memory_key: input.memoryKey ?? "memory-key",
    memory_type: "image_pattern",
    memory_text: "Memory text",
    recommendation: "Recommendation",
    confidence_score: 0.8,
    support_count: 5,
    contradiction_count: 0,
    status: input.status ?? "active",
    version: input.version ?? 1,
    supersedes_memory_id: input.supersedesMemoryId ?? null,
    algorithm_version: "campaign-memory-promotion-v1",
    input_summary: {},
    output_summary: input.outputSummary ?? {},
    created_at: NOW,
    updated_at: NOW,
    promoted_at: NOW,
    created_by: "learning_agent",
  };
}

function evidence(
  input: AttachSocialCampaignMemoryEvidenceInput,
): SocialCampaignMemoryEvidence[] {
  return input.evidence.map((item, index) => ({
    id: `evidence-${index}`,
    memory_id: input.memoryId,
    decision_id: item.decisionId,
    social_post_id: item.socialPostId,
    asset_id: item.assetId ?? null,
    asset_family_id: item.assetFamilyId ?? null,
    campaign_id: item.campaignId ?? null,
    evidence_role: item.evidenceRole ?? "supporting",
    weight: item.weight ?? 1,
    created_at: NOW,
  }));
}

async function promotableImageCandidate(): Promise<CampaignMemoryCandidate> {
  const candidates = await buildCampaignMemoryCandidates({
    decisions: [
      decision({
        id: "accepted-1",
        type: "accepted",
        postId: "post-a",
        assetFamilyId: "family-a",
      }),
      decision({
        id: "accepted-2",
        type: "accepted",
        postId: "post-b",
        assetFamilyId: "family-b",
      }),
      decision({
        id: "accepted-3",
        type: "accepted",
        postId: "post-c",
        assetFamilyId: "family-b",
      }),
      decision({
        id: "accepted-4",
        type: "accepted",
        postId: "post-d",
        assetFamilyId: "family-c",
      }),
      decision({
        id: "accepted-5",
        type: "accepted",
        postId: "post-e",
        assetFamilyId: "family-c",
      }),
    ],
  });

  const candidate = candidates.find(
    (item) => item.supportDecisionType === "accepted",
  );
  assert(candidate);
  assert.equal(candidate.isPromotable, true);
  return candidate;
}

await test("builds deterministic campaign candidates with thresholds and confidence", async () => {
  const decisions = [
    decision({
      id: "accepted-1",
      type: "accepted",
      postId: "post-a",
      assetFamilyId: "family-a",
    }),
    decision({
      id: "accepted-2",
      type: "accepted",
      postId: "post-b",
      assetFamilyId: "family-b",
    }),
    decision({
      id: "accepted-3",
      type: "accepted",
      postId: "post-c",
      assetFamilyId: "family-b",
    }),
    decision({
      id: "accepted-4",
      type: "accepted",
      postId: "post-d",
      assetFamilyId: "family-c",
    }),
    decision({
      id: "accepted-5",
      type: "accepted",
      postId: "post-e",
      assetFamilyId: "family-c",
    }),
    decision({
      id: "rejected-1",
      type: "rejected",
      postId: "post-f",
      assetFamilyId: "family-d",
    }),
  ];

  const candidates = await buildCampaignMemoryCandidates({ decisions });
  const acceptedCandidates = candidates.filter(
    (candidate) => candidate.supportDecisionType === "accepted",
  );
  assert.equal(acceptedCandidates.length, 1);

  const accepted = acceptedCandidates[0];
  assert.equal(accepted.isPromotable, true);
  assert.equal(accepted.supportCount, 5);
  assert.equal(accepted.contradictionCount, 1);
  assert.equal(accepted.distinctPostCount, 5);
  assert.equal(accepted.distinctAssetFamilyCount, 3);
  assert.equal(accepted.confidenceScore, 5 / 8);
  assert.equal(accepted.confidenceLabel, "low");
  assert.deepEqual(accepted.contradictionDecisionTypes, ["rejected"]);
  assert.equal(
    accepted.memoryKey,
    "campaign:summer-campaign:stage:image_review:type:image_pattern:pattern:generated-image-openai",
  );

  const evidenceItems = listCampaignMemoryCandidateEvidence(accepted);
  assert.equal(evidenceItems.length, 6);
  assert.equal(
    evidenceItems.filter((item) => item.evidenceRole === "supporting").length,
    5,
  );
  assert.equal(
    evidenceItems.filter((item) => item.evidenceRole === "contradicting")
      .length,
    1,
  );
});

await test("applies global support thresholds separately from campaign thresholds", async () => {
  const sevenGlobalDecisions = Array.from({ length: 7 }, (_, index) =>
    decision({
      id: `global-${index}`,
      type: "accepted",
      campaignId: null,
      postId: `global-post-${index}`,
      assetFamilyId: index === 0 ? "family-a" : "family-b",
    }),
  );
  const blocked = await buildCampaignMemoryCandidates({
    decisions: sevenGlobalDecisions,
    global: true,
  });
  const blockedAccepted = blocked.find(
    (candidate) => candidate.supportDecisionType === "accepted",
  );
  assert(blockedAccepted);
  assert.equal(blockedAccepted.isPromotable, false);
  assert.deepEqual(blockedAccepted.blockedReasons, [
    "requires at least 8 supporting decisions",
  ]);

  const promoted = await buildCampaignMemoryCandidates({
    decisions: [
      ...sevenGlobalDecisions,
      decision({
        id: "global-7",
        type: "accepted",
        campaignId: null,
        postId: "global-post-7",
        assetFamilyId: "family-c",
      }),
    ],
    global: true,
  });
  const promotedAccepted = promoted.find(
    (candidate) => candidate.supportDecisionType === "accepted",
  );
  assert(promotedAccepted);
  assert.equal(promotedAccepted.isPromotable, true);
  assert.equal(
    promotedAccepted.memoryKey,
    "campaign:global:stage:image_review:type:image_pattern:pattern:generated-image-openai",
  );
});

await test("groups selected video candidates deterministically", async () => {
  const candidates = await buildCampaignMemoryCandidates({
    decisions: Array.from({ length: 5 }, (_, index) =>
      decision({
        id: `video-${index}`,
        type: "selected",
        stage: "video_review",
        postId: `video-post-${index}`,
        assetFamilyId: index === 0 ? "video-family-a" : "video-family-b",
        provider: "runway",
      }),
    ),
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].isPromotable, true);
  assert.equal(candidates[0].memoryType, "video_pattern");
  assert.equal(candidates[0].supportDecisionType, "selected");
  assert.equal(candidates[0].confidenceScore, 5 / 7);
  assert.equal(
    candidates[0].memoryKey,
    "campaign:summer-campaign:stage:video_review:type:video_pattern:pattern:selected-video-runway",
  );
});

await test("rejects promotion without evidence before creating memory", async () => {
  const candidate = await promotableImageCandidate();
  let createCalls = 0;
  configureCampaignMemoryPromotionTestDependencies({
    createMemoryVersion: async () => {
      createCalls += 1;
      return memory({ id: "created" });
    },
  });

  await assert.rejects(
    () =>
      promoteCampaignMemoryCandidate({
        ...candidate,
        supportDecisions: [],
        contradictionDecisions: [],
      }),
    /Cannot promote a campaign memory without evidence\./,
  );
  assert.equal(createCalls, 0);
});

await test("retracts newly created memory when evidence attachment fails", async () => {
  const candidate = await promotableImageCandidate();
  const created = memory({
    id: "created-memory",
    memoryKey: candidate.memoryKey,
    version: 1,
  });
  const updates: Array<{
    memoryId: string;
    status: "superseded" | "retracted";
    outputSummary: Record<string, unknown>;
  }> = [];

  configureCampaignMemoryPromotionTestDependencies({
    listMemories: async (input?: ListSocialCampaignMemoriesInput) => {
      if (input?.memoryKey) return [];
      return [created];
    },
    createMemoryVersion: async () => created,
    attachMemoryEvidence: async () => [],
    updateMemoryStatus: async (input) => {
      updates.push(input);
      return {
        ...created,
        status: input.status,
        output_summary: input.outputSummary,
      };
    },
  });

  await assert.rejects(
    () => promoteCampaignMemoryCandidate(candidate),
    /Campaign memory evidence attachment was incomplete\./,
  );
  assert.equal(updates.length, 1);
  assert.equal(updates[0].memoryId, "created-memory");
  assert.equal(updates[0].status, "retracted");
  assert.match(
    String(
      (updates[0].outputSummary.retraction as Record<string, unknown>).reason,
    ),
    /Promotion evidence attachment failed/,
  );
});

await test("supersedes existing active memory only after evidence attaches", async () => {
  const candidate = await promotableImageCandidate();
  const active = memory({
    id: "active-memory",
    memoryKey: candidate.memoryKey,
    version: 3,
  });
  const createInputs: CreateSocialCampaignMemoryVersionInput[] = [];
  const updates: Array<{
    memoryId: string;
    status: "superseded" | "retracted";
    outputSummary: Record<string, unknown>;
  }> = [];

  configureCampaignMemoryPromotionTestDependencies({
    listMemories: async () => [active],
    createMemoryVersion: async (input) => {
      createInputs.push(input);
      return memory({
        id: "new-memory",
        memoryKey: input.memoryKey,
        version: input.version,
        supersedesMemoryId: input.supersedesMemoryId,
      });
    },
    attachMemoryEvidence: async (input) => evidence(input),
    updateMemoryStatus: async (input) => {
      updates.push(input);
      return {
        ...active,
        status: input.status,
        output_summary: input.outputSummary,
      };
    },
  });

  const result = await promoteCampaignMemoryCandidate(candidate);
  assert.equal(result.memory.id, "new-memory");
  assert.equal(result.evidence.length, candidate.supportCount);
  assert.equal(createInputs.length, 1);
  const createInput = createInputs[0]!;
  assert.equal(createInput.version, 4);
  assert.equal(createInput.supersedesMemoryId, "active-memory");
  assert.equal(updates.length, 1);
  assert.equal(updates[0].memoryId, "active-memory");
  assert.equal(updates[0].status, "superseded");
  assert.equal(updates[0].outputSummary.superseded_by_memory_id, "new-memory");
});

await test("retraction preserves history and marks memory retracted", async () => {
  const existing = memory({
    id: "memory-to-retract",
    outputSummary: { existing: true },
  });
  const updateInputs: Array<{
    memoryId: string;
    status: "superseded" | "retracted";
    outputSummary: Record<string, unknown>;
  }> = [];

  configureCampaignMemoryPromotionTestDependencies({
    listMemories: async () => [existing],
    updateMemoryStatus: async (input) => {
      updateInputs.push(input);
      return {
        ...existing,
        status: input.status,
        output_summary: input.outputSummary,
      };
    },
  });

  const retracted = await retractSocialCampaignMemory(
    "memory-to-retract",
    "No longer valid",
  );
  assert.equal(retracted.status, "retracted");
  assert.equal(updateInputs.length, 1);
  const updateInput = updateInputs[0]!;
  assert.equal(updateInput.status, "retracted");
  assert.equal(updateInput.outputSummary.existing, true);
  assert.deepEqual(
    (updateInput.outputSummary.retraction as Record<string, unknown>).reason,
    "No longer valid",
  );
});
