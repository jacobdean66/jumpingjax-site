import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  APPROVAL_READY_STATUSES,
  evaluateStatusTransitionFromStoredPost,
  isApprovalReadyStatus,
  statusTransitionDecision,
  statusTransitionDeniedBody,
} from "./status-transition-gate";
import type { ComplianceGateResult } from "./agent-compliance-gate";
import {
  billableModelProtectionBlock,
  getAgentProtectionMode,
  paidGenerationProtectionBlock,
} from "./agent-protection-mode";
import { createOpenAiJsonClient } from "./llm-json-client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function routeSource(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), "utf8");
}

function compliance(
  decision: "allow" | "quarantine" | "block",
): ComplianceGateResult {
  return {
    deterministic: true,
    modelApproved: false,
    resultState: decision === "allow" ? "compliant" : "not-evaluated",
    decision,
    allowedToProceed: decision === "allow",
    summary: `test ${decision}`,
    blockingCodes: [],
    hardClaimFindings: [],
    evaluationId: null,
    specificationId: null,
  };
}

/* ------------------------------------------------------------------ */
/* P0 — approval/schedule transition gate                              */
/* ------------------------------------------------------------------ */

test("P0: blocked output cannot be approved or scheduled and denial mutates nothing", () => {
  for (const status of APPROVAL_READY_STATUSES) {
    const decision = statusTransitionDecision({
      requestedStatus: status,
      compliance: compliance("block"),
    });
    assert.equal(decision.eligible, false);

    const denied = statusTransitionDeniedBody(decision);
    assert.equal(denied.ok, false);
    assert.equal(denied.code, "status_transition_denied");
    assert.equal(denied.publication.published, false);
    assert.match(denied.publication.note, /unchanged/i);
  }
});

test("P0: quarantined output cannot be approved or scheduled", () => {
  const decision = statusTransitionDecision({
    requestedStatus: "scheduled",
    compliance: compliance("quarantine"),
  });
  assert.equal(decision.eligible, false);
  assert.match(decision.reason, /quarantin/i);
});

test("P0: missing compliance evidence fails closed for approval-ready transitions", () => {
  const decision = statusTransitionDecision({
    requestedStatus: "approved",
    compliance: null,
  });
  assert.equal(decision.eligible, false);
  assert.match(decision.reason, /fail closed/i);
});

test("P0: current deterministic allow permits the transition; Jacob remains final approver", () => {
  const decision = statusTransitionDecision({
    requestedStatus: "approved",
    compliance: compliance("allow"),
  });
  assert.equal(decision.eligible, true);
  assert.match(decision.reason, /Jacob/);
});

test("P0: non-approval statuses (draft/rejected/failed) are not gated", () => {
  for (const status of ["draft", "rejected", "failed"]) {
    assert.equal(isApprovalReadyStatus(status), false);
    const decision = statusTransitionDecision({
      requestedStatus: status,
      compliance: null,
    });
    assert.equal(decision.eligible, true);
  }
});

test("P0: stored-post evaluation recomputes server-side and fails closed on hard claims", () => {
  const post = {
    id: "post-1",
    title: "Weekend fun",
    caption: "Only $99 today! Book now!",
    prompt: "Bounce house fun for kids",
    campaign_id: null,
    platforms: ["facebook"],
    media_type: "image",
  };
  const result = evaluateStatusTransitionFromStoredPost({
    post: post as never,
    requestedStatus: "approved",
    posts: [],
  });
  assert.equal(result.eligible, false);
  assert.ok(result.compliance);
  assert.notEqual(result.compliance?.decision, "allow");
});

test("P0: client-supplied eligibility flags are ignored — gate only reads stored inputs", () => {
  // The gate API accepts no client compliance/fingerprint/approval inputs.
  const src = readFileSync(
    path.join(ROOT, "src/lib/social-posts/agents/status-transition-gate.ts"),
    "utf8",
  );
  assert.doesNotMatch(src, /body\./);
  assert.doesNotMatch(src, /clientCompliance|clientApproved|trustClient/i);
  assert.match(src, /never trusted/i);
});

test("P0: [id] route wires the gate into every status mutation path (JSON shortcuts, combined update, regenerate carry-over, form POST)", () => {
  const src = routeSource("src/app/api/social-posts/[id]/route.ts");

  // scheduled_for-only shortcut gated before scheduleSocialPost.
  const scheduledIdx = src.indexOf('requestedStatus: "scheduled"');
  const scheduleCallIdx = src.indexOf("await scheduleSocialPost(id, body.scheduled_for)");
  assert.ok(scheduledIdx > -1 && scheduleCallIdx > -1 && scheduledIdx < scheduleCallIdx);

  // status-only shortcut gated for approval-ready statuses.
  assert.match(src, /isApprovalReadyStatus\(requestedStatus\)/);
  assert.match(src, /evaluateStatusTransitionFromStoredPost/);
  assert.match(src, /statusTransitionDeniedBody/);

  // Combined content+status updates are re-gated on the NEW content.
  assert.match(src, /requestedPatchStatus/);

  // Regenerate cannot carry or set approval-ready status without allow.
  assert.match(src, /resultingStatus/);

  // Form POST path uses the same gate.
  const formGateIdx = src.lastIndexOf("evaluateStatusTransitionFromStoredPost");
  const formScheduleIdx = src.lastIndexOf("await scheduleSocialPost(id, scheduledFor)");
  assert.ok(formGateIdx > -1 && formScheduleIdx > -1 && formGateIdx < formScheduleIdx);

  // No status mutation path reads client compliance flags.
  assert.doesNotMatch(src, /body\.compliance/);
  assert.doesNotMatch(src, /body\.allowedToProceed/);
  assert.doesNotMatch(src, /body\.generationReady/);
});

test("P0: combined content+status quarantine result cannot approve atomically", () => {
  const decision = statusTransitionDecision({
    requestedStatus: "approved",
    compliance: compliance("quarantine"),
  });
  assert.equal(decision.eligible, false);
});

/* ------------------------------------------------------------------ */
/* P1 — fail-closed billable model protection                          */
/* ------------------------------------------------------------------ */

test("P1: environment detection fails safe on missing, malformed, or ambiguous env", () => {
  // Missing NODE_ENV entirely → production-like → disabled.
  assert.equal(getAgentProtectionMode({} as NodeJS.ProcessEnv).kind, "disabled");
  // Malformed NODE_ENV → disabled.
  assert.equal(
    getAgentProtectionMode({ NODE_ENV: "prod" } as unknown as NodeJS.ProcessEnv)
      .kind,
    "disabled",
  );
  // Vercel preview builds run NODE_ENV=production → disabled.
  assert.equal(
    getAgentProtectionMode({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
    } as NodeJS.ProcessEnv).kind,
    "disabled",
  );
  // Ambiguous: development NODE_ENV but production Vercel deployment → disabled.
  assert.equal(
    getAgentProtectionMode({
      NODE_ENV: "development",
      VERCEL_ENV: "production",
    } as NodeJS.ProcessEnv).kind,
    "disabled",
  );
  // Affirmative non-production remains process-local.
  assert.equal(
    getAgentProtectionMode({ NODE_ENV: "test" } as NodeJS.ProcessEnv).kind,
    "process-local-nonproduction",
  );
  assert.equal(
    getAgentProtectionMode({ NODE_ENV: "development" } as NodeJS.ProcessEnv).kind,
    "process-local-nonproduction",
  );
  assert.equal(
    getAgentProtectionMode({
      AGENT_ALLOW_PROCESS_LOCAL_PROTECTION: "1",
    } as unknown as NodeJS.ProcessEnv).kind,
    "process-local-nonproduction",
  );
});

test("P1: billable model block and paid media block both fail closed in production", async () => {
  const prodEnv = {
    NODE_ENV: "production",
    VERCEL_ENV: "production",
  } as NodeJS.ProcessEnv;

  const modelBlock = await billableModelProtectionBlock(prodEnv);
  assert.ok(modelBlock);
  assert.equal(modelBlock?.code, "durable_protection_unavailable");
  assert.match(modelBlock?.error ?? "", /Model-backed \(OpenAI\)/);
  // Truthful, non-leaky message.
  assert.doesNotMatch(modelBlock?.error ?? "", /sk-|api[_-]?key|stack|SQL/i);

  const mediaBlock = await paidGenerationProtectionBlock(prodEnv);
  assert.ok(mediaBlock);
  assert.equal(mediaBlock?.code, "durable_protection_unavailable");

  assert.equal(await billableModelProtectionBlock({ NODE_ENV: "test" } as NodeJS.ProcessEnv), null);
});

test("P1: LLM client boundary refuses billable calls in production — provider spy stays at zero", async () => {
  let fetchCalls = 0;
  const spyFetch: typeof fetch = async () => {
    fetchCalls += 1;
    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        model: "test-model",
        choices: [
          { index: 0, message: { role: "assistant", content: '{"ok":true}' }, finish_reason: "stop" },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const prodClient = createOpenAiJsonClient({
    apiKey: "sk-test-not-a-real-key",
    fetchImpl: spyFetch,
    env: { NODE_ENV: "production", VERCEL_ENV: "production" } as NodeJS.ProcessEnv,
  });
  const blocked = await prodClient.completeJson({ system: "s", user: "u" });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.equal(blocked.blockedByProtection, true);
    assert.match(blocked.error, /temporarily unavailable/i);
  }
  assert.equal(fetchCalls, 0);

  // Same client shape in an affirmative non-production env does reach the
  // (mocked) provider — proving the guard, not the client, blocked above.
  const devClient = createOpenAiJsonClient({
    apiKey: "sk-test-not-a-real-key",
    fetchImpl: spyFetch,
    env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
  });
  const allowed = await devClient.completeJson({ system: "s", user: "u" });
  assert.equal(allowed.ok, true);
  assert.equal(fetchCalls, 1);
});

test("P1: every billable model route fails closed before provider work (route wiring)", () => {
  const billableModelRoutes = [
    "src/app/api/social-posts/agent-draft/route.ts",
    "src/app/api/social-posts/[id]/director-preview/route.ts",
    "src/app/api/social-posts/[id]/image-director-preview/route.ts",
  ];
  for (const relPath of billableModelRoutes) {
    const src = routeSource(relPath);
    const blockIdx = src.indexOf("billableModelProtectionBlock()");
    const idemIdx = src.indexOf("beginAgentIdempotentActionAsync({");
    assert.ok(blockIdx > -1, `${relPath} must call billableModelProtectionBlock`);
    assert.ok(
      idemIdx === -1 || blockIdx < idemIdx,
      `${relPath} must fail closed before idempotency/provider work`,
    );
    assert.match(src, /status: 503/);
  }

  // Regenerate branch of [id]/route.ts also fails closed before lookup.
  const idSrc = routeSource("src/app/api/social-posts/[id]/route.ts");
  const regenIdx = idSrc.indexOf('body.action === "regenerate_caption"');
  const regenBlockIdx = idSrc.indexOf("billableModelProtectionBlock()", regenIdx);
  const regenLookupIdx = idSrc.indexOf("await getSocialPostById(id)", regenIdx);
  assert.ok(regenIdx > -1 && regenBlockIdx > -1 && regenLookupIdx > -1);
  assert.ok(regenBlockIdx < regenLookupIdx);

  // Paid media routes keep their existing paid-generation block.
  for (const relPath of [
    "src/app/api/social-posts/[id]/generate-image/route.ts",
    "src/app/api/social-posts/[id]/generate-media/route.ts",
  ]) {
    const src = routeSource(relPath);
    assert.match(src, /paidGenerationProtectionBlock\(\)/);
  }
});

test("P1: protection-mode documentation claims match the enforced scope", () => {
  const src = readFileSync(
    path.join(ROOT, "src/lib/social-posts/agents/agent-protection-mode.ts"),
    "utf8",
  );
  // The claim must cover model-backed calls, not just paid media.
  assert.match(src, /model-backed \(OpenAI\)/i);
  assert.match(src, /agent draft/i);
  assert.match(src, /regeneration/i);
  assert.match(src, /preview/i);
  assert.match(src, /fails safe|fail-closed|fails closed/i);
});

test("P1: retries/regeneration flags/preview variants cannot re-enable billable calls (single boundary)", () => {
  // All OpenAI chat-completion starts in the social-posts change set live in
  // llm-json-client.ts, behind the durable-protection guard.
  const client = readFileSync(
    path.join(ROOT, "src/lib/social-posts/agents/llm-json-client.ts"),
    "utf8",
  );
  const guardIdx = client.indexOf("getAgentProtectionMode(protectionEnv)");
  const durableIdx = client.indexOf("isDurableAgentStoreReady(protectionEnv)");
  const callIdx = client.indexOf("chat.completions.create");
  assert.ok(guardIdx > -1 && callIdx > -1 && guardIdx < callIdx);
  assert.ok(durableIdx > -1 && durableIdx < callIdx);

  // openai-creative-director delegates to the guarded agent path and makes
  // no direct completion call.
  const legacy = readFileSync(
    path.join(ROOT, "src/lib/social-posts/openai-creative-director.ts"),
    "utf8",
  );
  assert.doesNotMatch(legacy, /chat\.completions|responses\.create|images\.generate/);
});
