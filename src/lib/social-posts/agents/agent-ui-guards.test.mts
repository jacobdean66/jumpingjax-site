import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const agentDraftForm = readFileSync(
  fileURLToPath(new URL("../../../app/admin/social-posts/AgentDraftForm.tsx", import.meta.url)),
  "utf8",
);
const directorsConsole = readFileSync(
  fileURLToPath(new URL("../../../app/admin/social-posts/DirectorsConsole.tsx", import.meta.url)),
  "utf8",
);

test("AgentDraftForm exposes mobile-usable agent states and duplicate-submit guard", () => {
  assert.match(agentDraftForm, /inFlightRef/);
  assert.match(agentDraftForm, /Social Strategy \/ Copy Agent/);
  assert.match(agentDraftForm, /min-h-11/);
  assert.match(agentDraftForm, /aria-busy=\{pending\}/);
  assert.match(agentDraftForm, /Nothing is published/);
  assert.match(agentDraftForm, /No Independent Reviewer/);
  assert.match(agentDraftForm, /deterministic fallback|model-backed/);
  assert.match(agentDraftForm, /complianceDecision|Compliance:/);
  assert.match(agentDraftForm, /QUARANTINE|generation-ready|generationReadyReason/);
});

test("DirectorsConsole shows Image and Video Director agent status without hover-only controls", () => {
  assert.match(directorsConsole, /Image Director Agent/);
  assert.match(directorsConsole, /Video Director Agent/);
  assert.match(directorsConsole, /imagePreviewInFlightRef/);
  assert.match(directorsConsole, /videoPreviewInFlightRef/);
  assert.match(directorsConsole, /min-h-11/);
  assert.doesNotMatch(directorsConsole, /onMouseEnter=\{/);
  assert.match(directorsConsole, /Preview never generates/);
  assert.match(directorsConsole, /No Independent Reviewer/);
  assert.match(directorsConsole, /Approved catalog assets only/);
  assert.match(directorsConsole, /imageGenerationAllowed/);
  assert.match(directorsConsole, /videoGenerationAllowed/);
  assert.match(directorsConsole, /complianceDecision|Compliance:/);
});
