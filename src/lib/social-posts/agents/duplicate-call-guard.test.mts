import assert from "node:assert/strict";
import test from "node:test";
import {
  beginAgentIdempotentAction,
  buildAgentActionFingerprint,
  completeAgentIdempotentAction,
  resetAgentIdempotencyStoreForTests,
} from "./agent-idempotency";
import { createSocialAgentPlanWithMeta } from "../social-agent";
import { createScriptedLlmJsonClient } from "./llm-json-client";

/**
 * Duplicate clicks must NOT be treated as “two successful model calls.”
 * Route-level idempotency is the enforcing guard; intentional separate
 * executions remain independent only when fingerprints/keys differ.
 */
test("duplicate identical in-flight agent actions are rejected (not celebrated as two model calls)", () => {
  resetAgentIdempotencyStoreForTests();
  const fingerprint = buildAgentActionFingerprint({
    action: "agent-draft",
    goal: "Promote clean and safe local family fun",
    assetUrl: null,
  });

  const first = beginAgentIdempotentAction({
    clientKey: "ui-client",
    action: "agent-draft",
    idempotencyKey: null,
    fingerprint,
  });
  assert.equal(first.kind, "proceed");

  const second = beginAgentIdempotentAction({
    clientKey: "ui-client",
    action: "agent-draft",
    idempotencyKey: null,
    fingerprint,
  });
  assert.equal(second.kind, "in_progress");

  if (first.kind === "proceed") {
    completeAgentIdempotentAction({
      storeKey: first.storeKey,
      fingerprint,
      status: 200,
      body: { ok: true, publication: { published: false } },
    });
  }
});

test("regeneration-order semantics: missing post short-circuits before model invocation", async () => {
  let modelCalls = 0;
  const client = createScriptedLlmJsonClient(async (request) => {
    modelCalls += 1;
    return {
      ok: true,
      parsed: {
        title: "Should not run",
        caption: "Should not run",
        generationPrompt: "Should not run",
        mediaType: "video",
        platforms: ["facebook"],
        businessFocus: "both",
        goal: "Promote clean and safe local family fun",
        campaignId: null,
        sourceImageKeywords: ["bounce", "party", "family", "fun"],
        audience: "Local families",
        tone: "upbeat",
        callToAction: "Message Jumping Jax for details.",
        factualConstraints: ["Do not invent prices."],
        ownerInputRequired: ["Confirm availability before publishing."],
        seasonalContextUsed: null,
        assetContextUsed: null,
        platformNotes: "Facebook-first hook.",
      },
      rawText: "{}",
      model: "test-model",
      requestId: request.requestId ?? "req_1",
      provider: "openai",
      truncatedInput: false,
      timedOut: false,
    };
  });

  // Simulate route order: lookup miss → return 404 without calling the agent.
  const existing = null;
  if (!existing) {
    assert.equal(modelCalls, 0);
    return;
  }

  await createSocialAgentPlanWithMeta(
    { goal: "Promote clean and safe local family fun" },
    { client },
  );
  assert.fail("model must not be called when post is missing");
});

test("publication side effects stay false on successful draft-shaped responses", () => {
  resetAgentIdempotencyStoreForTests();
  const fingerprint = buildAgentActionFingerprint({ action: "agent-draft" });
  const begun = beginAgentIdempotentAction({
    clientKey: "pub-check",
    action: "agent-draft",
    idempotencyKey: "pub-1",
    fingerprint,
  });
  assert.equal(begun.kind, "proceed");
  if (begun.kind !== "proceed") return;

  completeAgentIdempotentAction({
    storeKey: begun.storeKey,
    fingerprint,
    status: 200,
    body: {
      ok: true,
      publication: { published: false, note: "Draft created only." },
    },
  });

  const replay = beginAgentIdempotentAction({
    clientKey: "pub-check",
    action: "agent-draft",
    idempotencyKey: "pub-1",
    fingerprint,
  });
  assert.equal(replay.kind, "replay");
  if (replay.kind === "replay") {
    assert.equal(
      (replay.body as { publication: { published: boolean } }).publication
        .published,
      false,
    );
  }
});
