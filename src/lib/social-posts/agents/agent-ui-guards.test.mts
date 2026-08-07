import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMPLIANCE_WAITING_FOR_PREVIEW_LABEL,
  DURABLE_PROTECTION_UNAVAILABLE_UI_REASON,
  getAgentUiProtectionStatus,
} from "./agent-ui-protection";

const agentDraftForm = readFileSync(
  fileURLToPath(new URL("../../../app/admin/social-posts/AgentDraftForm.tsx", import.meta.url)),
  "utf8",
);
const directorsConsole = readFileSync(
  fileURLToPath(new URL("../../../app/admin/social-posts/DirectorsConsole.tsx", import.meta.url)),
  "utf8",
);
const socialPostsPage = readFileSync(
  fileURLToPath(new URL("../../../app/admin/social-posts/page.tsx", import.meta.url)),
  "utf8",
);
const socialPostsAdminClient = readFileSync(
  fileURLToPath(
    new URL("../../../app/admin/social-posts/SocialPostsAdminClient.tsx", import.meta.url),
  ),
  "utf8",
);

test("getAgentUiProtectionStatus pre-disables model actions when durable protection unavailable", () => {
  const status = getAgentUiProtectionStatus({
    NODE_ENV: "production",
    VERCEL_ENV: "production",
  });
  assert.equal(status.modelActionsDisabled, true);
  assert.equal(status.reason, DURABLE_PROTECTION_UNAVAILABLE_UI_REASON);
  assert.equal(status.complianceWaitingLabel, COMPLIANCE_WAITING_FOR_PREVIEW_LABEL);
  assert.equal(status.mode.kind, "disabled");
});

test("getAgentUiProtectionStatus allows model actions in affirmative local development", () => {
  const status = getAgentUiProtectionStatus({
    NODE_ENV: "development",
  });
  assert.equal(status.modelActionsDisabled, false);
  assert.equal(status.reason, null);
  assert.equal(status.mode.kind, "process-local-nonproduction");
});

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

test("AgentDraftForm pre-disables Create AI Draft when durable protection unavailable", () => {
  assert.match(agentDraftForm, /agentUiProtection/);
  assert.match(agentDraftForm, /modelActionsDisabled/);
  assert.match(agentDraftForm, /disabled=\{pending \|\| modelActionsDisabled\}/);
  assert.match(agentDraftForm, /Create AI Draft unavailable/);
  assert.match(agentDraftForm, /complianceWaitingLabel/);
  assert.match(agentDraftForm, /role="status"/);
  assert.match(agentDraftForm, /if \(modelActionsDisabled \|\| inFlightRef\.current \|\| pending\)/);
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

test("DirectorsConsole pre-disables Preview Final Prompt when durable protection unavailable", () => {
  assert.match(directorsConsole, /agentUiProtection/);
  assert.match(directorsConsole, /modelActionsDisabled/);
  assert.match(directorsConsole, /Preview Final Prompt unavailable/);
  assert.match(directorsConsole, /Preview Image Prompt unavailable/);
  assert.match(
    directorsConsole,
    /modelActionsDisabled \|\| previewLoading \|\| previewRateLimited/,
  );
  assert.match(directorsConsole, /complianceWaitingLabel/);
  assert.match(
    directorsConsole,
    /modelActionsDisabled \|\|\s*videoPreviewInFlightRef\.current/,
  );
});

test("DirectorsConsole keeps generation safety guards when protection is blocked", () => {
  assert.match(directorsConsole, /!imageGenerationAllowed/);
  assert.match(directorsConsole, /!videoGenerationAllowed/);
  assert.match(directorsConsole, /Requires fresh preview with compliance allow/);
});

test("DirectorsConsole and draft forms use ~44px mobile tap targets", () => {
  assert.match(directorsConsole, /CollapsibleSection[\s\S]*min-h-11/);
  assert.match(
    directorsConsole,
    /Copy Prompt[\s\S]*min-h-11|min-h-11[\s\S]*Copy Prompt/,
  );
  assert.match(directorsConsole, /className="flex min-h-11 w-full items-center justify-between/);
  assert.match(
    directorsConsole,
    /className="ml-auto min-h-11 rounded-full bg-slate-950 px-4 py-2/,
  );
  assert.match(socialPostsPage, /size-5 shrink-0/);
  assert.match(socialPostsPage, /inline-flex min-h-11 items-center gap-2/);
  assert.match(socialPostsAdminClient, /size-5 shrink-0/);
  assert.match(socialPostsAdminClient, /inline-flex min-h-11 items-center gap-2/);
});

test("Social Posts page wires server protection status into client UI", () => {
  assert.match(socialPostsPage, /getAgentUiProtectionStatus/);
  assert.match(socialPostsPage, /agentUiProtection=\{agentUiProtection\}/);
  assert.match(socialPostsAdminClient, /agentUiProtection/);
  assert.doesNotMatch(socialPostsPage, /Staff sign in|Staff Login/);
});
