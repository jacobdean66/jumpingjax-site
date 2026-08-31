import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

test("agent-draft one-click path runs the full orchestrator (not lone strategy agent)", () => {
  const src = read("src/app/api/social-posts/agent-draft/route.ts");
  const summary = read("src/lib/social-posts/agents/social-post-orchestrator.ts");
  assert.match(src, /runSocialPostOrchestrator\(/);
  assert.doesNotMatch(src, /createSocialAgentPlanWithMeta\(/);
  assert.match(src, /buildOrchestrationWorkflowSummary\(/);
  assert.match(summary, /ownerApprovalRequired:\s*true/);
  assert.match(summary, /independentReviewerImplemented:\s*true/);
  assert.match(src, /published:\s*false/);
  assert.match(src, /generationReady:\s*false/);
  // Fail-closed before billable orchestration work.
  const blockIdx = src.indexOf("billableModelProtectionBlock()");
  const orchIdx = src.indexOf("runSocialPostOrchestrator(");
  assert.ok(blockIdx > -1 && orchIdx > -1 && blockIdx < orchIdx);
});

test("regeneration uses orchestrator creative fields but exact-state compliance on next*", () => {
  const src = read("src/app/api/social-posts/[id]/route.ts");
  const regenIdx = src.indexOf('body.action === "regenerate_caption"');
  assert.ok(regenIdx > -1);
  const regen = src.slice(regenIdx, regenIdx + 16000);

  assert.match(regen, /runSocialPostOrchestrator\(/);
  assert.doesNotMatch(regen, /createSocialAgentPlanWithMeta\(/);

  // Hybrid next* fields are computed BEFORE compliance.
  const nextTitleIdx = regen.indexOf("const nextTitle =");
  const nextCaptionIdx = regen.indexOf("const nextCaption =");
  const nextPromptIdx = regen.indexOf("const nextPrompt =");
  const complianceIdx = regen.indexOf("evaluateAgentComplianceGateWithPosts({");
  assert.ok(nextTitleIdx > -1 && nextCaptionIdx > -1 && nextPromptIdx > -1);
  assert.ok(complianceIdx > nextTitleIdx);
  assert.ok(complianceIdx > nextCaptionIdx);
  assert.ok(complianceIdx > nextPromptIdx);

  // Compliance must evaluate next* (exact persisted state), not orchestrator.finalCompliance alone.
  const complianceWindow = regen.slice(complianceIdx, complianceIdx + 900);
  assert.match(complianceWindow, /title:\s*nextTitle/);
  assert.match(complianceWindow, /caption:\s*nextCaption/);
  assert.match(complianceWindow, /generationPrompt:\s*nextPrompt/);
  assert.doesNotMatch(
    complianceWindow,
    /orchestration\.finalCompliance|orchestration\.compliance/,
  );

  // Persist uses the same next* fields evaluated above.
  const persistIdx = regen.indexOf("await updateSocialPostDraft(id,");
  assert.ok(persistIdx > -1, "regenerate path must persist via updateSocialPostDraft");
  assert.ok(persistIdx > complianceIdx);
  const persistWindow = regen.slice(persistIdx, persistIdx + 700);
  assert.match(persistWindow, /title:\s*nextTitle/);
  assert.match(persistWindow, /caption:\s*nextCaption/);
  assert.match(persistWindow, /prompt:\s*nextPrompt/);

  // Resulting media_type still resolved for partial regen.
  assert.match(regen, /resolveResultingMediaType\(/);
});

test("UI Create AI Draft describes multi-agent stages and owner-approval gate", () => {
  const src = read("src/app/admin/social-posts/AgentDraftForm.tsx");
  assert.match(src, /Campaign Strategist/);
  assert.match(src, /Creative Director/);
  assert.match(src, /Independent Reviewer/);
  assert.match(src, /Owner Approval Required/);
  assert.match(src, /owner checkpoint/);
  assert.doesNotMatch(src, /No Independent Reviewer agent exists/);
});

test("orchestration types hard-code max one Creative Director revision", () => {
  const src = read("src/lib/social-posts/agents/orchestration-types.ts");
  assert.match(src, /MAX_CREATIVE_DIRECTOR_REVISIONS\s*=\s*1/);
  assert.match(src, /MAX_MODEL_CALLS_WITH_REVISION\s*=\s*4/);
});
