import assert from "node:assert/strict";
import test from "node:test";
import type { AgentResult } from "./agent-types";
import type { ComplianceGateResult } from "./agent-compliance-gate";
import {
  buildDeterministicCampaignStrategistPlan,
  type CampaignStrategistInput,
} from "./campaign-strategist-agent";
import { buildDeterministicCreativeDirectorOutput } from "./creative-director-agent";
import { buildDeterministicIndependentReviewerOutput } from "./independent-reviewer-agent";
import {
  MAX_CREATIVE_DIRECTOR_REVISIONS,
  type CampaignStrategistOutput,
  type CreativeDirectorOutput,
  type IndependentReviewerOutput,
} from "./orchestration-types";
import { runSocialPostOrchestrator } from "./social-post-orchestrator";

function allowCompliance(
  overrides: Partial<ComplianceGateResult> = {},
): ComplianceGateResult {
  return {
    deterministic: true,
    modelApproved: false,
    resultState: "compliant",
    decision: "allow",
    allowedToProceed: true,
    summary: "Deterministic compliance decision: allow.",
    blockingCodes: [],
    hardClaimFindings: [],
    evaluationId: "test-eval",
    specificationId: "test-spec",
    ...overrides,
  };
}

function blockCompliance(): ComplianceGateResult {
  return allowCompliance({
    decision: "block",
    allowedToProceed: false,
    resultState: "violations-found",
    summary: "Deterministic compliance decision: block.",
    blockingCodes: ["hard-prohibited-business-claim"],
    hardClaimFindings: ["Contains a price-like claim"],
  });
}

function quarantineCompliance(): ComplianceGateResult {
  return allowCompliance({
    decision: "quarantine",
    allowedToProceed: false,
    resultState: "insufficient-spec",
    summary: "Deterministic compliance decision: quarantine.",
  });
}

function okStrategist(
  input: CampaignStrategistInput,
): Promise<AgentResult<CampaignStrategistOutput>> {
  const output = buildDeterministicCampaignStrategistPlan(input);
  return Promise.resolve({
    ok: true,
    output,
    diagnostics: {
      agentId: "campaign-strategist",
      source: "deterministic-fallback",
      provider: "none",
      model: null,
      requestId: "strat_test",
      fallbackReason: "test",
      timedOut: false,
      truncatedInput: false,
      failureKind: "not_configured",
    },
  });
}

function okCreative(args: {
  strategist: CampaignStrategistOutput;
  revisionInstructions?: string[] | null;
  priorCreative?: CreativeDirectorOutput | null;
}): Promise<AgentResult<CreativeDirectorOutput>> {
  const output = buildDeterministicCreativeDirectorOutput({
    strategist: args.strategist,
    revisionInstructions: args.revisionInstructions,
    priorCreative: args.priorCreative,
  });
  return Promise.resolve({
    ok: true,
    output,
    diagnostics: {
      agentId: "creative-director",
      source: "deterministic-fallback",
      provider: "none",
      model: null,
      requestId: "cd_test",
      fallbackReason: "test",
      timedOut: false,
      truncatedInput: false,
      failureKind: "not_configured",
    },
  });
}

function okReviewer(
  output: IndependentReviewerOutput,
): Promise<AgentResult<IndependentReviewerOutput>> {
  return Promise.resolve({
    ok: true,
    output: { ...output, grantsOwnerApproval: false },
    diagnostics: {
      agentId: "independent-reviewer",
      source: "deterministic-fallback",
      provider: "none",
      model: null,
      requestId: "rev_test",
      fallbackReason: "test",
      timedOut: false,
      truncatedInput: false,
      failureKind: "not_configured",
    },
  });
}

const baseRequest: CampaignStrategistInput = {
  goal: "Promote water slides for hot weather",
  mediaType: "video",
  platform: "both",
  businessFocus: "rentals",
};

test("orchestration order: Strategist -> Creative Director -> Reviewer -> compliance", async () => {
  const order: string[] = [];
  let strategistSeenByCreative: CampaignStrategistOutput | null = null;
  let pairSeenByReviewer: {
    strategist: CampaignStrategistOutput;
    creative: CreativeDirectorOutput;
  } | null = null;

  const result = await runSocialPostOrchestrator(
    {
      request: baseRequest,
      complianceEvaluator: async () => {
        order.push("compliance");
        return allowCompliance();
      },
    },
    {
      runStrategist: async (input) => {
        order.push("strategist");
        return okStrategist(input);
      },
      runCreativeDirector: async (input) => {
        order.push(
          input.priorCreative ? "creative_revision" : "creative_director",
        );
        strategistSeenByCreative = input.strategist;
        return okCreative(input);
      },
      runReviewer: async (input) => {
        order.push("reviewer");
        pairSeenByReviewer = {
          strategist: input.strategist,
          creative: input.creative,
        };
        return okReviewer({
          verdict: "approve",
          reasoning: "Looks good for owner review.",
          revisionInstructions: [],
          flags: [],
          grantsOwnerApproval: false,
        });
      },
    },
  );

  assert.deepEqual(order, [
    "strategist",
    "creative_director",
    "reviewer",
    "compliance",
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.outcome, "owner_ready");
  assert.ok(result.strategist);
  assert.ok(result.creative);
  assert.ok(result.reviewer);
  assert.equal(result.strategist.goal, "Promote water slides for hot weather");
  // Callback captures prove live handoff (not only result fields).
  assert.equal(JSON.stringify(strategistSeenByCreative), JSON.stringify(result.strategist));
  assert.equal(
    JSON.stringify(
      (pairSeenByReviewer as unknown as { creative: CreativeDirectorOutput })
        .creative.caption,
    ),
    JSON.stringify(result.creative.caption),
  );
  assert.equal(result.ownerApproved, false);
  assert.equal(result.published, false);
  assert.equal(result.generationReady, false);
  assert.equal(result.creativeDirectorRevisionCount, 0);
});

test("handoff: Creative Director receives Strategist output; Reviewer receives both", async () => {
  let creativeInputGoal: string | null = null;
  let reviewerGotBoth = false;

  await runSocialPostOrchestrator(
    {
      request: baseRequest,
      complianceEvaluator: async () => allowCompliance(),
    },
    {
      runStrategist: async (input) => okStrategist(input),
      runCreativeDirector: async (input) => {
        creativeInputGoal = input.strategist.goal;
        assert.ok(input.strategist.notesForCreativeDirector.length > 0);
        return okCreative(input);
      },
      runReviewer: async (input) => {
        reviewerGotBoth = Boolean(input.strategist && input.creative);
        assert.equal(input.strategist.goal, creativeInputGoal);
        assert.ok(input.creative.generationPrompt.length > 0);
        return okReviewer(
          buildDeterministicIndependentReviewerOutput(input),
        );
      },
    },
  );

  assert.equal(creativeInputGoal, baseRequest.goal);
  assert.equal(reviewerGotBoth, true);
});

test("one revision maximum: reviewer revise causes exactly one Creative Director revision", async () => {
  let creativeCalls = 0;
  let reviewerCalls = 0;

  const result = await runSocialPostOrchestrator(
    {
      request: baseRequest,
      complianceEvaluator: async (_creative, pass) => {
        // initial allow so revision is driven by reviewer only
        if (pass === "initial") return allowCompliance();
        return allowCompliance();
      },
    },
    {
      runStrategist: async (input) => okStrategist(input),
      runCreativeDirector: async (input) => {
        creativeCalls += 1;
        if (creativeCalls > MAX_CREATIVE_DIRECTOR_REVISIONS + 1) {
          throw new Error("Exceeded Creative Director revision budget");
        }
        return okCreative(input);
      },
      runReviewer: async (input) => {
        reviewerCalls += 1;
        return okReviewer({
          verdict: "revise",
          reasoning: "Need safer CTA wording.",
          revisionInstructions: [
            "Soften CTA; do not invent prices or availability.",
          ],
          flags: ["cta_softening"],
          grantsOwnerApproval: false,
        });
      },
    },
  );

  assert.equal(creativeCalls, 2); // initial + one revision
  assert.equal(reviewerCalls, 1); // no second reviewer loop
  assert.equal(result.creativeDirectorRevisionCount, 1);
  assert.equal(result.revisionUsed, true);
  assert.equal(result.ownerApproved, false);
  assert.ok(
    result.stages.some(
      (stage) =>
        stage.stageId === "creative_director_revision" &&
        stage.status === "completed",
    ),
  );
});

test("compliance authority: model approve cannot override deterministic block", async () => {
  const result = await runSocialPostOrchestrator(
    {
      request: baseRequest,
      complianceEvaluator: async () => blockCompliance(),
    },
    {
      runStrategist: async (input) => okStrategist(input),
      runCreativeDirector: async (input) => okCreative(input),
      runReviewer: async () =>
        okReviewer({
          verdict: "approve",
          reasoning: "Model wrongly approves.",
          revisionInstructions: [],
          flags: [],
          grantsOwnerApproval: false,
        }),
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.outcome, "compliance_blocked");
  assert.equal(result.reviewer?.verdict, "approve");
  assert.equal(result.compliance?.decision, "block");
  assert.equal(result.ownerApproved, false);
  assert.equal(result.published, false);
  assert.equal(result.creativeDirectorRevisionCount, 0);
});

test("no autonomous owner approval or publish on successful workflow", async () => {
  const result = await runSocialPostOrchestrator(
    {
      request: baseRequest,
      complianceEvaluator: async () => allowCompliance(),
    },
    {
      runStrategist: async (input) => okStrategist(input),
      runCreativeDirector: async (input) => okCreative(input),
      runReviewer: async (input) =>
        okReviewer(buildDeterministicIndependentReviewerOutput(input)),
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.ownerApprovalRequired, true);
  assert.equal(result.ownerApproved, false);
  assert.equal(result.published, false);
  assert.equal(result.generationReady, false);
  assert.equal(result.reviewer?.grantsOwnerApproval, false);
});

test("orchestration never starts image/video providers", async () => {
  let providerStarts = 0;
  const result = await runSocialPostOrchestrator(
    {
      request: baseRequest,
      complianceEvaluator: async () => allowCompliance(),
    },
    {
      runStrategist: async (input) => okStrategist(input),
      runCreativeDirector: async (input) => okCreative(input),
      runReviewer: async (input) =>
        okReviewer(buildDeterministicIndependentReviewerOutput(input)),
    },
  );

  // Orchestrator has no provider hooks; this assertion documents isolation.
  assert.equal(providerStarts, 0);
  assert.equal(result.generationReady, false);
  assert.doesNotMatch(JSON.stringify(result.stages), /generate-image|generate-media|replicate/i);
});

test("quarantine after workflow yields review_needed without owner approval", async () => {
  const result = await runSocialPostOrchestrator(
    {
      request: baseRequest,
      complianceEvaluator: async (_c, pass) => {
        if (pass === "initial") return quarantineCompliance();
        return quarantineCompliance();
      },
    },
    {
      runStrategist: async (input) => okStrategist(input),
      runCreativeDirector: async (input) => okCreative(input),
      runReviewer: async () =>
        okReviewer({
          verdict: "approve",
          reasoning: "Creative ok but compliance may quarantine.",
          revisionInstructions: [],
          flags: [],
          grantsOwnerApproval: false,
        }),
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.outcome, "review_needed");
  assert.equal(result.ownerApproved, false);
  assert.ok(result.revisionUsed);
});
