import assert from "node:assert/strict";
import test from "node:test";
import { socialDraftModelClient } from "./n8n-draft-client";
import type { SocialDraftInferenceReceipt } from "../../agent-manager/social-run";

test("records the scoped workflow and the verified n8n execution and request IDs", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      requestId: "draft-verification",
      executionId: "3793",
      model: "deepseek-coder-v2:16b",
      text: '{"caption":"Test draft"}',
    }),
  );
  const previousUrl = process.env.SOCIAL_DRAFT_N8N_URL;
  const previousBearer = process.env.SOCIAL_DRAFT_N8N_BEARER;
  t.after(() => {
    if (previousUrl === undefined) delete process.env.SOCIAL_DRAFT_N8N_URL;
    else process.env.SOCIAL_DRAFT_N8N_URL = previousUrl;
    if (previousBearer === undefined) delete process.env.SOCIAL_DRAFT_N8N_BEARER;
    else process.env.SOCIAL_DRAFT_N8N_BEARER = previousBearer;
  });
  process.env.SOCIAL_DRAFT_N8N_URL = "https://example.invalid/webhook/jjx-social-draft-model-v1";
  process.env.SOCIAL_DRAFT_N8N_BEARER = "fixture-token-for-local-testing-only";

  const receipts: SocialDraftInferenceReceipt[] = [];
  const client = socialDraftModelClient("run-local", "campaign_strategist", (receipt) => receipts.push(receipt));
  const result = await client.completeJson({ system: "test", user: "test", requestId: "draft-verification" });

  assert.equal(result.ok, true);
  assert.deepEqual(receipts, [{
    workflowId: "JjxSocialDraftV1",
    executionId: "3793",
    requestId: "draft-verification",
    model: "deepseek-coder-v2:16b",
  }]);
});
