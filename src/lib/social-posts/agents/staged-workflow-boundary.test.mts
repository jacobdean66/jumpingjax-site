import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const route = readFileSync(
  fileURLToPath(new URL("../../../app/api/social-posts/agent-draft/stage/route.ts", import.meta.url)),
  "utf8",
);
const form = readFileSync(
  fileURLToPath(new URL("../../../app/admin/social-posts/AgentDraftForm.tsx", import.meta.url)),
  "utf8",
);

test("owner-gated workflow exposes each bounded stage and never publishes", () => {
  assert.match(route, /buildSocialDraftWorkflowContext/);
  assert.match(route, /campaign_strategist/);
  assert.match(route, /creative_director/);
  assert.match(route, /independent_reviewer/);
  assert.match(route, /final_compliance/);
  assert.match(route, /workflowContextSummary/);
  assert.match(route, /Only an exact compliance allow may be persisted/);
  assert.match(route, /compliance\.hardClaimFindings\.length > 0/);
  assert.match(route, /revisionNeeded/);
  assert.match(route, /verifySocialDraftCheckpointSignature/);
  assert.match(route, /signSocialDraftCheckpoint/);
  assert.match(route, /published:\s*false/);
  assert.doesNotMatch(route, /publishSocial|scheduleSocialPost|generate-image/);
});

test("admin UI requires an explicit owner continuation at every checkpoint", () => {
  assert.match(form, /action:\s*"start"/);
  assert.match(form, /action:\s*"continue"/);
  assert.match(form, /action:\s*"stop"/);
  assert.match(form, /Stop without another agent/);
  assert.match(form, /of 4 model calls used/);
  assert.match(form, /Party theme/);
  assert.match(form, /Workflow inputs passed in/);
  assert.match(form, /checkpoint\.workflowContext\.modules\.map/);
});
